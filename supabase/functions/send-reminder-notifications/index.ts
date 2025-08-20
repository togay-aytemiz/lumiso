import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

// Import simplified email templates for MVP
import { generateDailySummaryEmailSimplified } from './_templates/simplified-daily-summary-template.ts';
import { generateWeeklyRecapEmailSimplified } from './_templates/simplified-weekly-recap-template.ts';
import { WeeklyStats } from './_templates/weekly-recap-template.ts';
import { EmailTemplateData, Lead, Project, Session, Todo, Activity } from './_templates/enhanced-email-base.ts';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderRequest {
  type: 'daily-summary' | 'weekly-recap' | 'new-assignment' | 'project-milestone';
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

async function getEnabledUsersForNotification(type: string, sendTime?: string, isTest?: boolean, testUserId?: string): Promise<UserProfile[]> {
  console.log(`Getting enabled users for notification type: ${type}, sendTime: ${sendTime}, isTest: ${isTest}, testUserId: ${testUserId}`);
  
  const notificationFieldMap: { [key: string]: string } = {
    'daily-summary': 'notification_daily_summary_enabled',
    'weekly-recap': 'notification_weekly_recap_enabled',
    'new-assignment': 'notification_new_assignment_enabled',
    'project-milestone': 'notification_project_milestone_enabled'
  };

  const timeFieldMap: { [key: string]: string } = {
    'daily-summary': 'notification_scheduled_time',
    'weekly-recap': 'notification_scheduled_time'
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

  // For testing, only get the specific test user
  if (isTest && testUserId) {
    query = query.eq('user_id', testUserId);
    console.log(`Test mode: sending only to user ${testUserId}`);
  } else {
    // Normal mode: filter by enabled status and time
    query = query.eq(notificationFieldMap[type], true);
    
    if (sendTime && timeFieldMap[type]) {
      query = query.eq(timeFieldMap[type], sendTime);
    }
  }

  const { data: enabledUsers, error } = await query;
  
  console.log(`Query result: ${enabledUsers?.length || 0} users found, error:`, error);

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

  const baseUrl = 'https://rifdykpdubrowzbylffe.supabase.co';

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

// Enhanced notification sending functions - simplified for MVP
import { formatDate } from './_templates/enhanced-email-base.ts';

async function sendDailySummary(user: UserProfile, isTest?: boolean) {
  console.log(`=== Starting daily summary for user ${user.email} ===`);
  
  // Get overdue sessions first (from today's date perspective)
  const today = new Date().toISOString().split('T')[0];
  console.log(`Today's date: ${today}`);
  
  // Get template data first to have date format available
  const templateData = await getUserBrandingSettings(user.user_id, user.active_organization_id);
  console.log(`Template data:`, JSON.stringify(templateData, null, 2));
  
  // Get overdue sessions (scheduled in past but still active lifecycle)
  const { data: overdueSessions, error: sessionsError } = await supabase
    .from('sessions')
    .select(`
      id, session_date, session_time, notes,
      leads!inner(name, email, phone),
      projects!inner(name, id),
      session_statuses!inner(lifecycle)
    `)
    .eq('organization_id', user.active_organization_id)
    .lt('session_date', today)
    .eq('session_statuses.lifecycle', 'active');

  console.log(`Overdue sessions query result:`, { data: overdueSessions, error: sessionsError });

  console.log(`Getting data for user: ${user.email} (${user.user_id}) in org: ${user.active_organization_id}`);

  // Get overdue reminders with lead/project relationships - debug version
  const { data: overdueReminders, error: remindersError } = await supabase
    .from('activities')
    .select(`
      id, 
      content, 
      reminder_date, 
      type,
      leads!left(name, email, phone),
      projects!left(name, id)
    `)
    .eq('organization_id', user.active_organization_id)
    .eq('completed', false)
    .not('reminder_date', 'is', null)
    .lt('reminder_date', today);

  console.log(`Overdue reminders query result:`, { data: overdueReminders, error: remindersError, today, org_id: user.active_organization_id });

  console.log(`Overdue reminders query result (fixed):`, { data: overdueReminders, error: remindersError });

  // Get upcoming reminders due within next 24 hours
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  // Get today's reminders (not tomorrow's)
  const todayEnd = today + ' 23:59:59';
  
  const { data: upcomingReminders, error: upcomingError } = await supabase
    .from('activities')
    .select(`
      id, 
      content, 
      reminder_date, 
      type,
      leads!left(name, email, phone),
      projects!left(name, id)
    `)
    .eq('organization_id', user.active_organization_id)
    .eq('completed', false)
    .not('reminder_date', 'is', null)
    .gte('reminder_date', today)
    .lte('reminder_date', todayEnd);

  console.log(`Today's reminders query result:`, { data: upcomingReminders, error: upcomingError, today, todayEnd });

  const [upcomingSessions, pendingTodos] = await Promise.all([
    getUpcomingSessionsWithRelationships(user.user_id, user.active_organization_id, user.permissions),
    getPendingTodosWithRelationships(user.user_id, user.active_organization_id, user.permissions)
  ]);

  console.log(`Additional data - Sessions: ${upcomingSessions?.length || 0}, Todos: ${pendingTodos?.length || 0}`);

  // Structure data for new daily summary format
  const overdueItems = {
    leads: [], // No overdue leads in daily summary per requirements
    activities: overdueReminders || []
  };

  const emailContent = generateDailySummaryEmailSimplified(
    upcomingSessions, 
    overdueSessions || [], 
    overdueReminders || [], 
    upcomingReminders || [], 
    pendingTodos, 
    templateData
  );
  const todayFormatted = formatDate(new Date().toISOString(), templateData.dateFormat);
  console.log(`Formatted date: ${todayFormatted} using format: ${templateData.dateFormat}`);
  
  const subject = isTest ? `📊 TEST: Daily Summary - ${todayFormatted}` : `📊 Daily Summary - ${todayFormatted}`;

  const { error } = await resend.emails.send({
    from: 'Lumiso <onboarding@resend.dev>',
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

async function sendWeeklyRecap(user: UserProfile, isTest?: boolean) {
  // Only send to Owners
  const { data: membership } = await supabase
    .from('organization_members')
    .select('system_role')
    .eq('user_id', user.user_id)
    .eq('organization_id', user.active_organization_id)
    .eq('status', 'active')
    .single();

  if (membership?.system_role !== 'Owner') {
    console.log(`Weekly recap skipped for ${user.email} - not an Owner`);
    return;
  }

  const weeklyStats = await getWeeklyStats(user.user_id, user.active_organization_id, user.permissions);
  
  // Get aging projects (stuck in active lifecycle too long)
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const monthAgoStr = monthAgo.toISOString().split('T')[0];
  
  const { data: agingProjects } = await supabase
    .from('projects')
    .select(`
      id, name, created_at,
      project_statuses!inner(lifecycle)
    `)
    .eq('organization_id', user.active_organization_id)
    .eq('project_statuses.lifecycle', 'active')
    .lt('created_at', monthAgoStr);

  const templateData = await getUserBrandingSettings(user.user_id, user.active_organization_id);
  const emailContent = generateWeeklyRecapEmailSimplified(weeklyStats, agingProjects || [], templateData);
  const subject = isTest ? `📈 TEST: Weekly Business Recap - Your Photography Success Story` : `📈 Weekly Business Recap - Your Photography Success Story`;

  const { error } = await resend.emails.send({
    from: 'Lumiso <onboarding@resend.dev>',
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

    // Get current time for time-based notifications (only if not testing)
    const now = new Date();
    const currentTime = isTest ? undefined : `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Get enabled users based on notification type
    const enabledUsers = await getEnabledUsersForNotification(type, currentTime, isTest, userId);
    
    if (enabledUsers.length === 0) {
      const timeMsg = isTest ? "testing" : `time ${currentTime}`;
      return new Response(JSON.stringify({ 
        message: `No users enabled for ${type} notifications during ${timeMsg}` 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Process each user with rate limiting (max 2 requests per second for Resend)
    const results = [];
    for (let i = 0; i < enabledUsers.length; i++) {
      const user = enabledUsers[i];
      
      // Add delay between requests to respect rate limits (500ms = 2 per second)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      try {
        let result;
        switch (type) {
          case 'daily-summary':
            result = await sendDailySummary(user, isTest);
            break;
          case 'weekly-recap':
            result = await sendWeeklyRecap(user, isTest);
            break;
          case 'new-assignment':
            // Immediate notification - handled separately
            console.log(`New assignment notification for ${user.email} - handled by immediate notification system`);
            result = undefined;
            break;
          case 'project-milestone':
            // Immediate notification - handled separately  
            console.log(`Project milestone notification for ${user.email} - handled by immediate notification system`);
            result = undefined;
            break;
          default:
            throw new Error(`Unknown notification type: ${type}`);
        }
        results.push({ status: 'fulfilled', value: result });
      } catch (error) {
        console.error(`Failed to send notification to user ${user.email}:`, error);
        results.push({ status: 'rejected', reason: error });
      }
    }

    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;
    
    // Log failed results for debugging
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to send notification to user ${enabledUsers[index]?.email}:`, result.reason);
      }
    });

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