import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";
import { generateModernDailySummaryEmail } from '../send-reminder-notifications/_templates/enhanced-daily-summary-modern.ts';
import { generateEmptyDailySummaryEmail } from '../send-reminder-notifications/_templates/enhanced-daily-summary-empty.ts';
import { generateImmediateNotificationEmail, generateSubject, ImmediateNotificationEmailData, ProjectAssignmentData, LeadAssignmentData, ProjectMilestoneData } from '../send-reminder-notifications/_templates/immediate-notifications.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface ProcessorRequest {
  action: 'process-pending' | 'process-scheduled' | 'trigger-immediate' | 'schedule-notification' | 'retry-failed';
  notification_id?: string;
  organizationId?: string;
  notification_type?: string;
  metadata?: any;
  scheduled_for?: string;
  user_id?: string;
  force?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Unified notification processor started');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const adminSupabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { action, notification_id, organizationId, force = false }: ProcessorRequest = await req.json();
    console.log(`Processing action: ${action}`);

    let result;

    switch (action) {
      case 'process-pending':
        result = await processPendingNotifications(adminSupabase, organizationId, force);
        break;
      
      case 'process-scheduled':
        result = await processScheduledNotifications(adminSupabase, organizationId, force);
        break;
      
      case 'trigger-immediate':
        if (!notification_id) {
          throw new Error('notification_id required for trigger-immediate');
        }
        result = await processSpecificNotification(adminSupabase, notification_id);
        break;
      
      case 'schedule-notification':
        result = await scheduleNotifications(adminSupabase, organizationId);
        break;
      
      case 'retry-failed':
        result = await retryFailedNotifications(adminSupabase, organizationId);
        break;
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({
      success: true,
      action,
      result,
      processed_at: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in notification processor:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

// Process all pending immediate notifications
async function processPendingNotifications(supabase: any, organizationId?: string, force = false) {
  console.log('Processing pending immediate notifications...');

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('delivery_method', 'immediate')
    .eq('status', 'pending')
    .lt('retry_count', supabase.rpc('notifications.max_retries'));

  if (organizationId && !force) {
    query = query.eq('organization_id', organizationId);
  }

  // Add time window for processing (last 30 minutes to avoid processing very old notifications)
  if (!force) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    query = query.gte('created_at', thirtyMinutesAgo);
  }

  const { data: notifications, error } = await query.limit(50); // Process in batches

  if (error) {
    throw new Error(`Error fetching pending notifications: ${error.message}`);
  }

  console.log(`Found ${notifications?.length || 0} pending immediate notifications`);

  const results = [];
  for (const notification of notifications || []) {
    try {
      const result = await processSpecificNotification(supabase, notification.id, notification);
      results.push({ id: notification.id, success: true, result });
    } catch (error: any) {
      console.error(`Error processing notification ${notification.id}:`, error);
      results.push({ id: notification.id, success: false, error: error.message });
      
      // Update notification status to failed
      await updateNotificationStatus(supabase, notification.id, 'failed', error.message);
    }
  }

  return {
    processed: notifications?.length || 0,
    results
  };
}

// Process scheduled notifications that are due
async function processScheduledNotifications(supabase: any, organizationId?: string, force = false) {
  console.log('Processing scheduled notifications...');

  const now = new Date();
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('delivery_method', 'scheduled')
    .eq('status', 'pending')
    .lt('retry_count', supabase.rpc('notifications.max_retries'));

  if (!force) {
    // Only process notifications scheduled for now or earlier
    query = query.lte('scheduled_for', now.toISOString());
  }

  if (organizationId && !force) {
    query = query.eq('organization_id', organizationId);
  }

  const { data: notifications, error } = await query.limit(100);

  if (error) {
    throw new Error(`Error fetching scheduled notifications: ${error.message}`);
  }

  console.log(`Found ${notifications?.length || 0} scheduled notifications to process`);

  const results = [];
  for (const notification of notifications || []) {
    try {
      const result = await processSpecificNotification(supabase, notification.id, notification);
      results.push({ id: notification.id, success: true, result });
    } catch (error: any) {
      console.error(`Error processing scheduled notification ${notification.id}:`, error);
      results.push({ id: notification.id, success: false, error: error.message });
      
      // Update notification status to failed with retry logic
      await updateNotificationStatus(supabase, notification.id, 'failed', error.message, notification.retry_count + 1);
    }
  }

  return {
    processed: notifications?.length || 0,
    results
  };
}

// Process a specific notification
async function processSpecificNotification(supabase: any, notificationId: string, notificationData?: any) {
  // Mark as processing
  await updateNotificationStatus(supabase, notificationId, 'processing');

  // Get notification data if not provided
  if (!notificationData) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (error || !data) {
      throw new Error(`Notification not found: ${notificationId}`);
    }
    notificationData = data;
  }

  console.log(`Processing ${notificationData.notification_type} notification for user ${notificationData.user_id}`);

  // Route to appropriate processor based on type
  let result;
  
  switch (notificationData.notification_type) {
    case 'daily-summary':
      result = await processDailySummary(supabase, notificationData);
      break;
    case 'project-milestone':
      result = await processProjectMilestone(supabase, notificationData);
      break;
    case 'new-assignment':
      result = await processNewAssignment(supabase, notificationData);
      break;
    default:
      throw new Error(`Unsupported notification type: ${notificationData.notification_type}`);
  }

  // Mark as sent on success
  await updateNotificationStatus(supabase, notificationId, 'sent', null, 0, result.id);
  
  return result;
}

// Process daily summary notification
async function processDailySummary(supabase: any, notification: any) {
  console.log(`Processing daily summary for user ${notification.user_id}`);

  // Get user data
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(notification.user_id);
  if (userError || !userData.user) {
    throw new Error(`Failed to get user: ${userError?.message || 'User not found'}`);
  }

  // Get user settings and organization settings
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', notification.user_id)
    .maybeSingle();

  const { data: orgSettings } = await supabase
    .from('organization_settings')
    .select('*')
    .eq('organization_id', notification.organization_id)
    .maybeSingle();

  // Get activities for today
  const today = new Date().toISOString().split('T')[0];
  const { data: activities } = await supabase
    .from('activities')
    .select(`
      id, content, type, completed, reminder_date, reminder_time,
      lead_id, project_id,
      leads(name),
      projects(name)
    `)
    .eq('organization_id', notification.organization_id)
    .gte('created_at', `${today}T00:00:00Z`)
    .lt('created_at', `${today}T23:59:59Z`);

  // Get sessions for today  
  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, location, session_date, session_time, status,
      leads(name), projects(name)
    `)
    .eq('organization_id', notification.organization_id)
    .eq('session_date', today);

  // Get todos
  const { data: todos } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', notification.user_id)
    .eq('is_completed', false);

  // Check if there's any activity
  const hasActivity = (activities && activities.length > 0) || 
                     (sessions && sessions.length > 0) || 
                     (todos && todos.length > 0);

  let emailHtml;
  if (hasActivity) {
    emailHtml = generateModernDailySummaryEmail({
      userName: userData.user.email?.split('@')[0] || 'User',
      activities: activities || [],
      upcomingSessions: sessions || [],
      todos: todos || [],
      businessName: orgSettings?.photography_business_name || 'Your Business',
      logoUrl: orgSettings?.logo_url || 'https://my.lumiso.app/lumiso-logo.png'
    });
  } else {
    emailHtml = generateEmptyDailySummaryEmail({
      userName: userData.user.email?.split('@')[0] || 'User',
      businessName: orgSettings?.photography_business_name || 'Your Business',
      logoUrl: orgSettings?.logo_url || 'https://my.lumiso.app/lumiso-logo.png'
    });
  }

  // Send email
  const emailResponse = await resend.emails.send({
    from: `${orgSettings?.photography_business_name || 'Lumiso'} <daily-summary@lumiso.app>`,
    to: [userData.user.email!],
    subject: hasActivity ? 'Your Daily Summary' : 'Daily Summary - Nothing scheduled today',
    html: emailHtml,
  });

  if (emailResponse.error) {
    throw new Error(`Failed to send daily summary: ${emailResponse.error.message}`);
  }

  console.log(`Daily summary sent successfully to ${userData.user.email}`);
  return emailResponse.data;
}

// Process project milestone notification
async function processProjectMilestone(supabase: any, notification: any) {
  const metadata = notification.metadata || {};
  const { project_id, old_status, new_status, changed_by_user_id } = metadata;

  if (!project_id) {
    throw new Error('project_id required in metadata for milestone notification');
  }

  // Use existing project milestone logic from send-reminder-notifications
  // This would call the same logic as handleProjectMilestoneNotification
  // For brevity, I'll reference the existing function
  console.log(`Processing milestone: ${project_id} from ${old_status} to ${new_status}`);
  
  // TODO: Extract milestone processing logic from send-reminder-notifications
  // For now, delegate to the existing function
  const result = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-reminder-notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
    },
    body: JSON.stringify({
      type: 'project-milestone',
      project_id,
      old_status,
      new_status,
      changed_by_user_id,
      organizationId: notification.organization_id
    })
  });

  if (!result.ok) {
    throw new Error(`Failed to process milestone: ${result.statusText}`);
  }

  return await result.json();
}

// Process new assignment notification
async function processNewAssignment(supabase: any, notification: any) {
  const metadata = notification.metadata || {};
  const { entity_type, entity_id, assigner_name } = metadata;

  if (!entity_type || !entity_id) {
    throw new Error('entity_type and entity_id required in metadata for assignment notification');
  }

  // Get assignee info
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(notification.user_id);
  if (userError || !userData.user) {
    throw new Error(`Failed to get assignee: ${userError?.message || 'User not found'}`);
  }

  console.log(`Processing assignment: ${entity_type}:${entity_id} to ${userData.user.email}`);
  
  // TODO: Extract assignment processing logic from send-reminder-notifications
  // For now, delegate to the existing function
  const result = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-reminder-notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
    },
    body: JSON.stringify({
      type: 'new-assignment',
      entity_type,
      entity_id,
      assignee_id: notification.user_id,
      assignee_email: userData.user.email,
      assignee_name: userData.user.email?.split('@')[0],
      assigner_name,
      organizationId: notification.organization_id
    })
  });

  if (!result.ok) {
    throw new Error(`Failed to process assignment: ${result.statusText}`);
  }

  return await result.json();
}

// Schedule future notifications (e.g., daily summaries for tomorrow)
async function scheduleNotifications(supabase: any, organizationId?: string) {
  console.log('Scheduling future notifications...');

  // Get organizations with daily summary enabled
  let query = supabase
    .from('organization_settings')
    .select(`
      organization_id,
      notification_scheduled_time,
      organizations!inner(
        id,
        organization_members!inner(
          user_id,
          status
        )
      )
    `)
    .eq('notification_daily_summary_enabled', true)
    .eq('organizations.organization_members.status', 'active');

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data: organizations, error: orgsError } = await query;

  if (orgsError) {
    throw new Error(`Error fetching organizations: ${orgsError.message}`);
  }

  const scheduledNotifications = [];
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  for (const org of organizations || []) {
    for (const member of org.organizations.organization_members) {
      const [hour, minute] = org.notification_scheduled_time.split(':').map(Number);
      
      const scheduledFor = new Date(tomorrow);
      scheduledFor.setHours(hour, minute, 0, 0);

      // Check if notification already scheduled for tomorrow
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('organization_id', org.organization_id)
        .eq('user_id', member.user_id)
        .eq('notification_type', 'daily-summary')
        .eq('delivery_method', 'scheduled')
        .gte('scheduled_for', `${tomorrow.toISOString().split('T')[0]}T00:00:00Z`)
        .lt('scheduled_for', `${tomorrow.toISOString().split('T')[0]}T23:59:59Z`)
        .maybeSingle();

      if (!existing) {
        scheduledNotifications.push({
          organization_id: org.organization_id,
          user_id: member.user_id,
          notification_type: 'daily-summary',
          delivery_method: 'scheduled',
          status: 'pending',
          scheduled_for: scheduledFor.toISOString(),
          metadata: {}
        });
      }
    }
  }

  if (scheduledNotifications.length > 0) {
    const { error: insertError } = await supabase
      .from('notifications')
      .insert(scheduledNotifications);

    if (insertError) {
      throw new Error(`Error scheduling notifications: ${insertError.message}`);
    }
  }

  return {
    organizations_processed: organizations?.length || 0,
    notifications_scheduled: scheduledNotifications.length,
    scheduled_for_date: tomorrow.toISOString().split('T')[0]
  };
}

// Retry failed notifications with exponential backoff
async function retryFailedNotifications(supabase: any, organizationId?: string) {
  console.log('Retrying failed notifications...');

  // Use the database function to retry failed notifications
  const { data, error } = await supabase.rpc('retry_failed_notifications');

  if (error) {
    throw new Error(`Error retrying notifications: ${error.message}`);
  }

  console.log(`Retried ${data || 0} failed notifications`);
  
  return {
    retried_count: data || 0
  };
}

// Helper function to update notification status
async function updateNotificationStatus(
  supabase: any, 
  notificationId: string, 
  status: string, 
  errorMessage?: string | null, 
  retryCount?: number, 
  emailId?: string | null
) {
  const updates: any = { 
    status,
    updated_at: new Date().toISOString()
  };

  if (status === 'sent') {
    updates.sent_at = new Date().toISOString();
  }

  if (errorMessage !== undefined) {
    updates.error_message = errorMessage;
  }

  if (retryCount !== undefined) {
    updates.retry_count = retryCount;
  }

  if (emailId !== undefined) {
    updates.email_id = emailId;
  }

  const { error } = await supabase
    .from('notifications')
    .update(updates)
    .eq('id', notificationId);

  if (error) {
    console.error(`Error updating notification status:`, error);
  }
}

serve(handler);