import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

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

async function getUpcomingSessions(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id,
      session_date,
      session_time,
      notes,
      leads (name, email)
    `)
    .eq('user_id', userId)
    .gte('session_date', today)
    .lte('session_date', tomorrowStr);

  return sessions || [];
}

async function getPendingDeliveries(userId: string) {
  // Get projects that might need delivery follow-up
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      created_at,
      leads (name, email)
    `)
    .eq('user_id', userId);

  // Simple logic: projects older than 7 days might need delivery follow-up
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const pendingDeliveries = projects?.filter(project => 
    new Date(project.created_at) < weekAgo
  ) || [];

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

async function sendOverdueReminder(user: UserProfile) {
  const overdueItems = await getOverdueItems(user.user_id);
  
  if (overdueItems.leads.length === 0 && overdueItems.activities.length === 0) {
    console.log(`No overdue items for user ${user.email}`);
    return;
  }

  const leadsList = overdueItems.leads.map(lead => 
    `• ${lead.name} (Due: ${lead.due_date})`
  ).join('\n');
  
  const activitiesList = overdueItems.activities.map(activity => 
    `• ${activity.content} (Due: ${activity.reminder_date})`
  ).join('\n');

  const emailContent = `
    <h2>Overdue Items Reminder</h2>
    <p>Hi ${user.full_name},</p>
    <p>You have the following overdue items that need your attention:</p>
    
    ${overdueItems.leads.length > 0 ? `
    <h3>Overdue Leads:</h3>
    <ul>
      ${overdueItems.leads.map(lead => `<li>${lead.name} (Due: ${lead.due_date})</li>`).join('')}
    </ul>
    ` : ''}
    
    ${overdueItems.activities.length > 0 ? `
    <h3>Overdue Activities:</h3>
    <ul>
      ${overdueItems.activities.map(activity => `<li>${activity.content} (Due: ${activity.reminder_date})</li>`).join('')}
    </ul>
    ` : ''}
    
    <p>Please review and update these items when you have a chance.</p>
    <p>Best regards,<br>Your Photography CRM</p>
  `;

  const { error } = await resend.emails.send({
    from: "Photography CRM <notifications@resend.dev>",
    to: [user.email],
    subject: `Overdue Items - ${overdueItems.leads.length + overdueItems.activities.length} item(s) need attention`,
    html: emailContent,
  });

  if (error) {
    console.error(`Failed to send overdue reminder to ${user.email}:`, error);
    throw error;
  }

  console.log(`Sent overdue reminder to ${user.email}`);
}

async function sendSessionReminder(user: UserProfile) {
  const upcomingSessions = await getUpcomingSessions(user.user_id);
  
  if (upcomingSessions.length === 0) {
    console.log(`No upcoming sessions for user ${user.email}`);
    return;
  }

  const sessionsList = upcomingSessions.map(session => 
    `• ${session.leads?.name || 'Session'} on ${session.session_date} at ${session.session_time}`
  ).join('\n');

  const emailContent = `
    <h2>Upcoming Sessions Reminder</h2>
    <p>Hi ${user.full_name},</p>
    <p>You have the following sessions coming up:</p>
    
    <ul>
      ${upcomingSessions.map(session => `
        <li>
          <strong>${session.leads?.name || 'Session'}</strong><br>
          Date: ${session.session_date}<br>
          Time: ${session.session_time}<br>
          ${session.notes ? `Notes: ${session.notes}` : ''}
        </li>
      `).join('')}
    </ul>
    
    <p>Make sure you're prepared for these sessions!</p>
    <p>Best regards,<br>Your Photography CRM</p>
  `;

  const { error } = await resend.emails.send({
    from: "Photography CRM <notifications@resend.dev>",
    to: [user.email],
    subject: `Upcoming Sessions - ${upcomingSessions.length} session(s) scheduled`,
    html: emailContent,
  });

  if (error) {
    console.error(`Failed to send session reminder to ${user.email}:`, error);
    throw error;
  }

  console.log(`Sent session reminder to ${user.email}`);
}

async function sendDeliveryReminder(user: UserProfile) {
  const pendingDeliveries = await getPendingDeliveries(user.user_id);
  
  if (pendingDeliveries.length === 0) {
    console.log(`No pending deliveries for user ${user.email}`);
    return;
  }

  const emailContent = `
    <h2>Delivery Follow-up Reminder</h2>
    <p>Hi ${user.full_name},</p>
    <p>The following projects might need delivery follow-up:</p>
    
    <ul>
      ${pendingDeliveries.map(project => `
        <li>
          <strong>${project.name}</strong><br>
          Client: ${project.leads?.name || 'N/A'}<br>
          Created: ${new Date(project.created_at).toLocaleDateString()}
        </li>
      `).join('')}
    </ul>
    
    <p>Consider following up on the delivery status of these projects.</p>
    <p>Best regards,<br>Your Photography CRM</p>
  `;

  const { error } = await resend.emails.send({
    from: "Photography CRM <notifications@resend.dev>",
    to: [user.email],
    subject: `Delivery Follow-up - ${pendingDeliveries.length} project(s) to review`,
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

  const emailContent = `
    <h2>Daily Summary</h2>
    <p>Hi ${user.full_name},</p>
    <p>Here's your daily summary for ${new Date().toLocaleDateString()}:</p>
    
    <h3>Today's Sessions (${upcomingSessions.length})</h3>
    ${upcomingSessions.length > 0 ? `
      <ul>
        ${upcomingSessions.map(session => `
          <li>${session.leads?.name || 'Session'} at ${session.session_time}</li>
        `).join('')}
      </ul>
    ` : '<p>No sessions scheduled for today.</p>'}
    
    <h3>Pending Todos (${pendingTodos.length})</h3>
    ${pendingTodos.length > 0 ? `
      <ul>
        ${pendingTodos.slice(0, 5).map(todo => `<li>${todo.content}</li>`).join('')}
        ${pendingTodos.length > 5 ? `<li>...and ${pendingTodos.length - 5} more</li>` : ''}
      </ul>
    ` : '<p>No pending todos.</p>'}
    
    ${(overdueItems.leads.length > 0 || overdueItems.activities.length > 0) ? `
      <h3>⚠️ Overdue Items (${overdueItems.leads.length + overdueItems.activities.length})</h3>
      <p style="color: #dc2626;">You have overdue items that need attention!</p>
    ` : ''}
    
    <p>Have a productive day!</p>
    <p>Best regards,<br>Your Photography CRM</p>
  `;

  const { error } = await resend.emails.send({
    from: "Photography CRM <notifications@resend.dev>",
    to: [user.email],
    subject: `Daily Summary - ${new Date().toLocaleDateString()}`,
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

  const emailContent = `
    <h2>Task Nudge Reminder</h2>
    <p>Hi ${user.full_name},</p>
    <p>You have some pending tasks that have been waiting for a while:</p>
    
    <ul>
      ${oldTodos.slice(0, 5).map(todo => `<li>${todo.content}</li>`).join('')}
      ${oldTodos.length > 5 ? `<li>...and ${oldTodos.length - 5} more</li>` : ''}
    </ul>
    
    <p>Maybe it's time to tackle some of these? 💪</p>
    <p>Best regards,<br>Your Photography CRM</p>
  `;

  const { error } = await resend.emails.send({
    from: "Photography CRM <notifications@resend.dev>",
    to: [user.email],
    subject: `Task Nudge - ${oldTodos.length} pending task(s)`,
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
            return await sendDeliveryReminder(user);
          case 'session':
            return await sendSessionReminder(user);
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