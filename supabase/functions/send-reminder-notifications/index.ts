import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

// Import enhanced email templates
import { generateOverdueEmail } from './_templates/enhanced-overdue-template.ts';
import { generateSessionEmail } from './_templates/enhanced-session-template.ts';
import { generateDailySummaryEmail } from './_templates/enhanced-daily-summary-template.ts';
import { generateTaskNudgeEmail } from './_templates/enhanced-task-nudge-template.ts';
import { generateWeeklyRecapEmail, WeeklyStats } from './_templates/weekly-recap-template.ts';
import { EmailTemplateData, Lead, Project, Session, Todo, Activity } from './_templates/enhanced-email-base.ts';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderRequest {
  type: 'overdue' | 'delivery' | 'session' | 'daily_summary' | 'task_nudge' | 'weekly_recap' | 'project_milestone' | 'lead_conversion';
  organizationId?: string;
  userId?: string;
  isTest?: boolean;
}

interface UserProfile {
  email: string;
  full_name: string;
  user_id: string;
  permissions: string[];
  active_organization_id: string;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Get user permissions for role-based filtering
async function getUserPermissions(userId: string, organizationId: string): Promise<string[]> {
  try {
    // Get user's organization membership
    const { data: membership } = await supabase
      .from('organization_members')
      .select(`
        system_role,
        custom_role_id,
        custom_roles!inner(
          role_permissions!inner(
            permissions!inner(name)
          )
        )
      `)
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single();

    let userPermissions: string[] = [];

    // If user is Owner, they have all permissions
    if (membership?.system_role === 'Owner') {
      const { data: allPermissions } = await supabase
        .from('permissions')
        .select('name');
      
      userPermissions = allPermissions?.map(p => p.name) || [];
    } else if (membership?.custom_role_id) {
      // Get permissions from custom role
      const { data: rolePermissions } = await supabase
        .from('role_permissions')
        .select(`
          permissions!inner(name)
        `)
        .eq('role_id', membership.custom_role_id);

      userPermissions = rolePermissions?.map(rp => rp.permissions.name) || [];
    }

    return userPermissions;
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return [];
  }
}

async function getEnabledUsersForNotification(type: string, sendTime?: string, isTest?: boolean): Promise<UserProfile[]> {
  console.log(`Getting enabled users for notification type: ${type}, sendTime: ${sendTime}, isTest: ${isTest}`);
  
  const notificationFieldMap: { [key: string]: string } = {
    'overdue': 'notification_overdue_reminder_enabled',
    'delivery': 'notification_delivery_reminder_enabled',
    'session': 'notification_session_reminder_enabled',
    'daily_summary': 'notification_daily_summary_enabled',
    'task_nudge': 'notification_task_nudge_enabled',
    'weekly_recap': 'notification_weekly_recap_enabled',
    'project_milestone': 'notification_project_milestone_enabled',
    'lead_conversion': 'notification_lead_conversion_enabled'
  };

  const timeFieldMap: { [key: string]: string } = {
    'delivery': 'notification_delivery_reminder_send_at',
    'session': 'notification_session_reminder_send_at',
    'daily_summary': 'notification_daily_summary_send_at',
    'weekly_recap': 'notification_weekly_recap_send_at'
  };

  let query = supabase
    .from('user_settings')
    .select(`
      user_id,
      active_organization_id,
      ${notificationFieldMap[type]},
      ${timeFieldMap[type] || 'user_id'},
      date_format,
      time_format
    `);

  // Only filter by enabled status if NOT testing
  if (!isTest) {
    query = query.eq(notificationFieldMap[type], true);
    
    // Only add time filter if applicable
    if (sendTime && timeFieldMap[type]) {
      query = query.eq(timeFieldMap[type], sendTime);
    }
  }

  const { data: enabledUsers, error } = await query;

  if (error) {
    console.error('Error fetching enabled users:', error);
    return [];
  }

  // Get user profiles with email and permissions
  const userIds = enabledUsers?.map(u => u.user_id) || [];
  if (userIds.length === 0) return [];

  const { data: users } = await supabase.auth.admin.listUsers();
  const enabledUserProfiles: UserProfile[] = [];

  for (const user of users.users) {
    if (!userIds.includes(user.id)) continue;
    
    const userSetting = enabledUsers.find(u => u.user_id === user.id);
    if (!userSetting?.active_organization_id) continue;

    const permissions = await getUserPermissions(user.id, userSetting.active_organization_id);
    
    enabledUserProfiles.push({
      user_id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || user.email || 'User',
      permissions,
      active_organization_id: userSetting.active_organization_id
    });
  }

  console.log(`Found ${enabledUserProfiles.length} enabled users for ${type}`);
  return enabledUserProfiles;
}

async function getOverdueItemsWithRelationships(userId: string, organizationId: string, permissions: string[]): Promise<{leads: Lead[], activities: Activity[]}> {
  const today = new Date().toISOString().split('T')[0];
  
  let overdueLeads: Lead[] = [];
  let overdueActivities: Activity[] = [];

  // Check permissions for leads
  if (permissions.includes('manage_all_leads') || permissions.includes('view_assigned_leads')) {
    let leadsQuery = supabase
      .from('leads')
      .select('id, name, email, phone, due_date, status, assignees')
      .eq('organization_id', organizationId)
      .lt('due_date', today);

    // If user doesn't have manage_all_leads, filter to assigned leads only
    if (!permissions.includes('manage_all_leads')) {
      leadsQuery = leadsQuery.or(`user_id.eq.${userId},assignees.cs.{${userId}}`);
    }

    const { data: leads } = await leadsQuery;
    overdueLeads = leads || [];
  }

  // Get overdue activities with relationships
  const { data: activities } = await supabase
    .from('activities')
    .select(`
      id, content, reminder_date, type,
      leads!inner(name, email),
      projects!inner(name, id)
    `)
    .eq('organization_id', organizationId)
    .eq('completed', false)
    .lt('reminder_date', today);

  overdueActivities = activities || [];

  return { leads: overdueLeads, activities: overdueActivities };
}

async function getUpcomingSessionsWithRelationships(userId: string, organizationId: string, permissions: string[], isTest?: boolean): Promise<Session[]> {
  const today = new Date().toISOString().split('T')[0];
  
  // For testing, look for sessions in a wider range
  let startDate, endDate;
  if (isTest) {
    const pastMonth = new Date();
    pastMonth.setDate(pastMonth.getDate() - 30);
    startDate = pastMonth.toISOString().split('T')[0];
    
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    endDate = nextMonth.toISOString().split('T')[0];
  } else {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    startDate = today;
    endDate = tomorrow.toISOString().split('T')[0];
  }

  // Check if user has session permissions
  if (!permissions.includes('manage_sessions') && !permissions.includes('view_assigned_projects')) {
    return [];
  }

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(`
      id, session_date, session_time, notes,
      leads!inner(name, email, phone),
      projects!inner(name, id)
    `)
    .eq('organization_id', organizationId)
    .gte('session_date', startDate)
    .lte('session_date', endDate);

  if (error) {
    console.error(`Error fetching sessions:`, error);
  }

  return sessions || [];
}

async function getPendingTodosWithRelationships(userId: string, organizationId: string, permissions: string[]): Promise<Todo[]> {
  // Check if user can view projects
  if (!permissions.includes('manage_all_projects') && !permissions.includes('view_assigned_projects')) {
    return [];
  }

  let todosQuery = supabase
    .from('todos')
    .select(`
      id, content, created_at,
      projects!inner(name, id, assignees, user_id)
    `)
    .eq('is_completed', false);

  // If user doesn't have manage_all_projects, filter to assigned projects only
  if (!permissions.includes('manage_all_projects')) {
    todosQuery = todosQuery.or(`projects.user_id.eq.${userId},projects.assignees.cs.{${userId}}`);
  }

  const { data: todos } = await todosQuery;
  return todos || [];
}

async function getWeeklyStats(userId: string, organizationId: string, permissions: string[]): Promise<WeeklyStats> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const stats: WeeklyStats = {
    leadsAdded: 0,
    leadsConverted: 0,
    leadsLost: 0,
    projectsCreated: 0,
    projectsCompleted: 0,
    sessionsCompleted: 0,
    sessionsScheduled: 0,
    totalRevenue: 0,
    recentLeads: [],
    recentProjects: [],
    upcomingSessions: []
  };

  // Get leads data if user has permission
  if (permissions.includes('manage_all_leads') || permissions.includes('view_assigned_leads')) {
    let leadsQuery = supabase
      .from('leads')
      .select('id, name, email, phone, status, created_at')
      .eq('organization_id', organizationId)
      .gte('created_at', weekStartStr);

    if (!permissions.includes('manage_all_leads')) {
      leadsQuery = leadsQuery.or(`user_id.eq.${userId},assignees.cs.{${userId}}`);
    }

    const { data: weeklyLeads } = await leadsQuery;
    if (weeklyLeads) {
      stats.leadsAdded = weeklyLeads.length;
      stats.leadsConverted = weeklyLeads.filter(l => l.status === 'Completed').length;
      stats.leadsLost = weeklyLeads.filter(l => l.status === 'Lost').length;
      stats.recentLeads = weeklyLeads.slice(0, 5);
    }
  }

  // Get projects data if user has permission
  if (permissions.includes('manage_all_projects') || permissions.includes('view_assigned_projects')) {
    let projectsQuery = supabase
      .from('projects')
      .select(`
        id, name, description, created_at, base_price,
        leads!inner(name, email, phone),
        project_types(name)
      `)
      .eq('organization_id', organizationId)
      .gte('created_at', weekStartStr);

    if (!permissions.includes('manage_all_projects')) {
      projectsQuery = projectsQuery.or(`user_id.eq.${userId},assignees.cs.{${userId}}`);
    }

    const { data: weeklyProjects } = await projectsQuery;
    if (weeklyProjects) {
      stats.projectsCreated = weeklyProjects.length;
      stats.recentProjects = weeklyProjects.slice(0, 5);
      stats.totalRevenue = weeklyProjects.reduce((sum, p) => sum + (p.base_price || 0), 0);
    }
  }

  // Get sessions data if user has permission
  if (permissions.includes('manage_sessions')) {
    const { data: weeklySessions } = await supabase
      .from('sessions')
      .select(`
        id, session_date, session_time, notes,
        leads!inner(name, email, phone),
        projects!inner(name, id)
      `)
      .eq('organization_id', organizationId)
      .gte('session_date', weekStartStr);

    if (weeklySessions) {
      stats.sessionsCompleted = weeklySessions.filter(s => 
        new Date(s.session_date) < new Date()
      ).length;
      
      stats.sessionsScheduled = weeklySessions.filter(s => 
        new Date(s.session_date) >= new Date()
      ).length;
    }

    // Get next week's sessions
    const nextWeekStart = new Date();
    nextWeekStart.setDate(nextWeekStart.getDate() + 1);
    const nextWeekEnd = new Date();
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 8);

    const { data: upcomingSessions } = await supabase
      .from('sessions')
      .select(`
        id, session_date, session_time, notes,
        leads!inner(name, email, phone),
        projects!inner(name, id)
      `)
      .eq('organization_id', organizationId)
      .gte('session_date', nextWeekStart.toISOString().split('T')[0])
      .lte('session_date', nextWeekEnd.toISOString().split('T')[0]);

    stats.upcomingSessions = upcomingSessions || [];
  }

  return stats;
}

async function getUserBrandingSettings(userId: string, organizationId: string): Promise<EmailTemplateData> {
  // Get user settings and organization settings
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('photography_business_name, logo_url, primary_brand_color, date_format, time_format')
    .eq('user_id', userId)
    .single();

  const { data: orgSettings } = await supabase
    .from('organization_settings')
    .select('photography_business_name, logo_url, primary_brand_color')
    .eq('organization_id', organizationId)
    .single();

  // Get user profile for full name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', userId)
    .single();

  const baseUrl = Deno.env.get('SITE_URL') || Deno.env.get('SUPABASE_URL')?.replace('/auth/v1', '');

  return {
    userFullName: profile?.full_name || 'User',
    businessName: orgSettings?.photography_business_name || userSettings?.photography_business_name || 'Photography CRM',
    logoUrl: orgSettings?.logo_url || userSettings?.logo_url,
    brandColor: orgSettings?.primary_brand_color || userSettings?.primary_brand_color || '#1EB29F',
    baseUrl: baseUrl,
    dateFormat: userSettings?.date_format || 'DD/MM/YYYY',
    timeFormat: userSettings?.time_format || '12-hour'
  };
}

// Enhanced notification sending functions
async function sendOverdueReminder(user: UserProfile) {
  const overdueItems = await getOverdueItemsWithRelationships(user.user_id, user.active_organization_id, user.permissions);
  
  if (overdueItems.leads.length === 0 && overdueItems.activities.length === 0) {
    console.log(`No overdue items for user ${user.email}`);
    return;
  }

  const templateData = await getUserBrandingSettings(user.user_id, user.active_organization_id);
  const emailContent = generateOverdueEmail(overdueItems, templateData);
  const subject = `🚨 ${overdueItems.leads.length + overdueItems.activities.length} Overdue Items Need Attention`;

  const { error } = await resend.emails.send({
    from: 'Lumiso <notifications@resend.dev>',
    to: [user.email],
    subject: subject,
    html: emailContent,
  });

  if (error) {
    console.error(`Failed to send overdue reminder to ${user.email}:`, error);
    throw error;
  }

  console.log(`Sent overdue reminder to ${user.email}`);
}

async function sendSessionReminder(user: UserProfile, isTest?: boolean) {
  const upcomingSessions = await getUpcomingSessionsWithRelationships(user.user_id, user.active_organization_id, user.permissions, isTest);
  
  if (upcomingSessions.length === 0) {
    console.log(`No upcoming sessions for user ${user.email}`);
    return;
  }

  const templateData = await getUserBrandingSettings(user.user_id, user.active_organization_id);
  const emailContent = generateSessionEmail(upcomingSessions, templateData);
  const subject = `📸 ${upcomingSessions.length} Photography Session${upcomingSessions.length === 1 ? '' : 's'} Coming Up`;

  const { error } = await resend.emails.send({
    from: 'Lumiso <notifications@resend.dev>',
    to: [user.email],
    subject: subject,
    html: emailContent,
  });

  if (error) {
    console.error(`Failed to send session reminder to ${user.email}:`, error);
    throw error;
  }

  console.log(`Sent session reminder to ${user.email}`);
}

async function sendDailySummary(user: UserProfile) {
  const [upcomingSessions, pendingTodos, overdueItems] = await Promise.all([
    getUpcomingSessionsWithRelationships(user.user_id, user.active_organization_id, user.permissions),
    getPendingTodosWithRelationships(user.user_id, user.active_organization_id, user.permissions),
    getOverdueItemsWithRelationships(user.user_id, user.active_organization_id, user.permissions)
  ]);

  const templateData = await getUserBrandingSettings(user.user_id, user.active_organization_id);
  const emailContent = generateDailySummaryEmail(upcomingSessions, pendingTodos, overdueItems, templateData);
  const today = new Date().toLocaleDateString();
  const subject = `📊 Daily Summary - ${today}`;

  const { error } = await resend.emails.send({
    from: 'Lumiso <notifications@resend.dev>',
    to: [user.email],
    subject: subject,
    html: emailContent,
  });

  if (error) {
    console.error(`Failed to send daily summary to ${user.email}:`, error);
    throw error;
  }

  console.log(`Sent daily summary to ${user.email}`);
}

async function sendTaskNudge(user: UserProfile) {
  const pendingTodos = await getPendingTodosWithRelationships(user.user_id, user.active_organization_id, user.permissions);
  
  if (pendingTodos.length === 0) {
    console.log(`No pending todos for user ${user.email}`);
    return;
  }

  const oldTodos = pendingTodos.filter(todo => {
    const daysSinceCreated = (Date.now() - new Date(todo.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreated > 2;
  });

  if (oldTodos.length === 0) {
    console.log(`No old todos to nudge for user ${user.email}`);
    return;
  }

  const templateData = await getUserBrandingSettings(user.user_id, user.active_organization_id);
  const emailContent = generateTaskNudgeEmail(oldTodos, templateData);
  const subject = `📋 ${oldTodos.length} Pending Task${oldTodos.length === 1 ? '' : 's'} Need Your Attention`;

  const { error } = await resend.emails.send({
    from: 'Lumiso <notifications@resend.dev>',
    to: [user.email],
    subject: subject,
    html: emailContent,
  });

  if (error) {
    console.error(`Failed to send task nudge to ${user.email}:`, error);
    throw error;
  }

  console.log(`Sent task nudge to ${user.email}`);
}

async function sendWeeklyRecap(user: UserProfile) {
  const weeklyStats = await getWeeklyStats(user.user_id, user.active_organization_id, user.permissions);
  
  const templateData = await getUserBrandingSettings(user.user_id, user.active_organization_id);
  const emailContent = generateWeeklyRecapEmail(weeklyStats, templateData);
  const subject = `📈 Weekly Business Recap - Your Photography Success Story`;

  const { error } = await resend.emails.send({
    from: 'Lumiso <notifications@resend.dev>',
    to: [user.email],
    subject: subject,
    html: emailContent,
  });

  if (error) {
    console.error(`Failed to send weekly recap to ${user.email}:`, error);
    throw error;
  }

  console.log(`Sent weekly recap to ${user.email}`);
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, organizationId, userId, isTest }: ReminderRequest = await req.json();
    console.log(`Processing reminder request: ${type}, isTest: ${isTest}`);

    // Get current time for time-based notifications
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Get enabled users based on notification type
    const enabledUsers = await getEnabledUsersForNotification(type, currentTime, isTest);
    
    if (enabledUsers.length === 0) {
      return new Response(JSON.stringify({ 
        message: `No users enabled for ${type} notifications at ${currentTime}` 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Process each user
    const results = await Promise.allSettled(
      enabledUsers.map(async (user) => {
        switch (type) {
          case 'overdue':
            return await sendOverdueReminder(user);
          case 'session':
            return await sendSessionReminder(user, isTest);
          case 'daily_summary':
            return await sendDailySummary(user);
          case 'task_nudge':
            return await sendTaskNudge(user);
          case 'weekly_recap':
            return await sendWeeklyRecap(user);
          default:
            throw new Error(`Unknown notification type: ${type}`);
        }
      })
    );

    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;

    console.log(`Notification batch complete: ${successful} successful, ${failed} failed`);

    return new Response(JSON.stringify({
      message: `Processed ${type} notifications`,
      successful,
      failed,
      total: enabledUsers.length
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in send-reminder-notifications:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);