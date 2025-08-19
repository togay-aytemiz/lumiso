import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

// Import email templates
import { generateOverdueEmail } from './_templates/overdue-template.ts';
import { generateSessionEmail } from './_templates/session-template.ts';
import { generateDeliveryEmail } from './_templates/delivery-template.ts';
import { generateDailySummaryEmail } from './_templates/daily-summary-template.ts';
import { generateTaskNudgeEmail } from './_templates/task-nudge-template.ts';
import { EmailTemplateData } from './_templates/email-base.ts';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderRequest {
  type: 'overdue' | 'delivery' | 'session' | 'daily_summary' | 'task_nudge';
  organizationId?: string;
  userId?: string;
  isTest?: boolean; // Add test flag
}

interface UserProfile {
  email: string;
  full_name: string;
  user_id: string;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function getEnabledUsersForNotification(type: string, sendTime?: string, isTest?: boolean) {
  console.log(`Getting enabled users for notification type: ${type}, sendTime: ${sendTime}, isTest: ${isTest}`);
  
  const notificationFieldMap: { [key: string]: string } = {
    'overdue': 'notification_overdue_reminder_enabled',
    'delivery': 'notification_delivery_reminder_enabled',
    'session': 'notification_session_reminder_enabled',
    'daily_summary': 'notification_daily_summary_enabled',
    'task_nudge': 'notification_task_nudge_enabled'
  };

  const timeFieldMap: { [key: string]: string } = {
    'delivery': 'notification_delivery_reminder_send_at',
    'session': 'notification_session_reminder_send_at',
    'daily_summary': 'notification_daily_summary_send_at'
  };

  let query = supabase
    .from('user_settings')
    .select(`
      user_id,
      ${notificationFieldMap[type]},
      ${timeFieldMap[type] || 'user_id'}
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

  // Get user profiles with email
  const userIds = enabledUsers?.map(u => u.user_id) || [];
  if (userIds.length === 0) return [];

  const { data: users } = await supabase.auth.admin.listUsers();
  const enabledUserProfiles = users.users
    .filter(user => userIds.includes(user.id))
    .map(user => ({
      user_id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || user.email || 'User'
    }));

  console.log(`Found ${enabledUserProfiles.length} enabled users for ${type}`);
  return enabledUserProfiles;
}

async function getOverdueItems(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  // Get overdue leads
  const { data: overdueLeads } = await supabase
    .from('leads')
    .select('id, name, due_date')
    .eq('user_id', userId)
    .lt('due_date', today);

  // Get overdue activities
  const { data: overdueActivities } = await supabase
    .from('activities')
    .select('id, content, reminder_date')
    .eq('user_id', userId)
    .eq('completed', false)
    .lt('reminder_date', today);

  return {
    leads: overdueLeads || [],
    activities: overdueActivities || []
  };
}

async function getUpcomingSessions(userId: string, isTest?: boolean) {
  const today = new Date().toISOString().split('T')[0];
  
  // For testing, look for sessions in a wider range (past 30 days to next 30 days)
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

  console.log(`Querying sessions for user ${userId} between ${startDate} and ${endDate} (test mode: ${isTest})`);

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(`
      id,
      session_date,
      session_time,
      notes,
      leads (name, email)
    `)
    .eq('user_id', userId)
    .gte('session_date', startDate)
    .lte('session_date', endDate);

  if (error) {
    console.error(`Error fetching sessions for user ${userId}:`, error);
  }

  console.log(`Raw sessions query result for user ${userId}:`, sessions);
  return sessions || [];
}

async function getPendingDeliveries(userId: string, isTest?: boolean) {
  console.log(`Querying projects for delivery follow-up for user ${userId} (test mode: ${isTest})`);
  
  // Get projects that might need delivery follow-up
  const { data: projects, error } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      created_at,
      leads (name, email)
    `)
    .eq('user_id', userId);

  if (error) {
    console.error(`Error fetching projects for user ${userId}:`, error);
  }

  console.log(`Raw projects query result for user ${userId}:`, projects);

  // For testing, use a shorter time period (1 day) to find more projects
  // For production, use 7 days as before
  const daysAgo = isTest ? 1 : 7;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
  
  console.log(`Looking for projects older than ${daysAgo} days (before ${cutoffDate.toISOString()})`);
  
  const pendingDeliveries = projects?.filter(project => {
    const projectDate = new Date(project.created_at);
    const isOld = projectDate < cutoffDate;
    console.log(`Project ${project.name}: created ${projectDate.toISOString()}, is old: ${isOld}`);
    return isOld;
  }) || [];

  return pendingDeliveries;
}

async function getPendingTodos(userId: string) {
  const { data: todos } = await supabase
    .from('todos')
    .select('id, content, created_at')
    .eq('user_id', userId)
    .eq('is_completed', false);

  return todos || [];
}

async function getUserBrandingSettings(userId: string): Promise<EmailTemplateData> {
  // Get user settings and organization settings
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('active_organization_id, photography_business_name, logo_url, primary_brand_color')
    .eq('user_id', userId)
    .single();

  let orgSettings = null;
  if (userSettings?.active_organization_id) {
    const { data } = await supabase
      .from('organization_settings')
      .select('photography_business_name, logo_url, primary_brand_color')
      .eq('organization_id', userSettings.active_organization_id)
      .single();
    orgSettings = data;
  }

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
    baseUrl: baseUrl
  };
}

async function sendOverdueReminder(user: UserProfile) {
  const overdueItems = await getOverdueItems(user.user_id);
  
  if (overdueItems.leads.length === 0 && overdueItems.activities.length === 0) {
    console.log(`No overdue items for user ${user.email}`);
    return;
  }

  const templateData = await getUserBrandingSettings(user.user_id);
  const emailContent = generateOverdueEmail(overdueItems, templateData);
  const subject = `Overdue Items - ${overdueItems.leads.length + overdueItems.activities.length} item(s) need attention`;

  const { error } = await resend.emails.send({
    from: `${templateData.businessName} <notifications@resend.dev>`,
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
  const upcomingSessions = await getUpcomingSessions(user.user_id, isTest);
  
  console.log(`Found ${upcomingSessions.length} upcoming sessions for user ${user.email}`);
  
  if (upcomingSessions.length === 0) {
    console.log(`No upcoming sessions for user ${user.email}`);
    return;
  }

  const templateData = await getUserBrandingSettings(user.user_id);
  const emailContent = generateSessionEmail(upcomingSessions, templateData);
  const subject = `Upcoming Sessions - ${upcomingSessions.length} session(s) scheduled`;

  const { error } = await resend.emails.send({
    from: `${templateData.businessName} <notifications@resend.dev>`,
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

async function sendDeliveryReminder(user: UserProfile, isTest?: boolean) {
  const pendingDeliveries = await getPendingDeliveries(user.user_id, isTest);
  
  console.log(`Found ${pendingDeliveries.length} pending deliveries for user ${user.email}`);
  
  if (pendingDeliveries.length === 0) {
    console.log(`No pending deliveries for user ${user.email}`);
    return;
  }

  const templateData = await getUserBrandingSettings(user.user_id);
  const emailContent = generateDeliveryEmail(pendingDeliveries, templateData);
  const subject = `Delivery Follow-up - ${pendingDeliveries.length} project(s) to review`;

  const { error } = await resend.emails.send({
    from: `${templateData.businessName} <notifications@resend.dev>`,
    to: [user.email],
    subject: subject,
    html: emailContent,
  });

  if (error) {
    console.error(`Failed to send delivery reminder to ${user.email}:`, error);
    throw error;
  }

  console.log(`Sent delivery reminder to ${user.email}`);
}

async function sendDailySummary(user: UserProfile) {
  const [upcomingSessions, pendingTodos, overdueItems] = await Promise.all([
    getUpcomingSessions(user.user_id),
    getPendingTodos(user.user_id),
    getOverdueItems(user.user_id)
  ]);

  const templateData = await getUserBrandingSettings(user.user_id);
  const emailContent = generateDailySummaryEmail(upcomingSessions, pendingTodos, overdueItems, templateData);
  const today = new Date().toLocaleDateString();
  const subject = `Daily Summary - ${today}`;

  const { error } = await resend.emails.send({
    from: `${templateData.businessName} <notifications@resend.dev>`,
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
  const pendingTodos = await getPendingTodos(user.user_id);
  
  console.log(`Found ${pendingTodos.length} pending todos for user ${user.email}`);
  
  if (pendingTodos.length === 0) {
    console.log(`No pending todos for user ${user.email}`);
    return;
  }

  const oldTodos = pendingTodos.filter(todo => {
    const daysSinceCreated = (Date.now() - new Date(todo.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreated > 2; // Nudge for todos older than 2 days
  });

  if (oldTodos.length === 0) {
    console.log(`No old todos to nudge for user ${user.email}`);
    return;
  }

  const templateData = await getUserBrandingSettings(user.user_id);
  const emailContent = generateTaskNudgeEmail(oldTodos, templateData);
  const subject = `Task Nudge - ${oldTodos.length} pending task(s)`;

  const { error } = await resend.emails.send({
    from: `${templateData.businessName} <notifications@resend.dev>`,
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
          case 'delivery':
            return await sendDeliveryReminder(user, isTest);
          case 'session':
            return await sendSessionReminder(user, isTest);
          case 'daily_summary':
            return await sendDailySummary(user);
          case 'task_nudge':
            return await sendTaskNudge(user);
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