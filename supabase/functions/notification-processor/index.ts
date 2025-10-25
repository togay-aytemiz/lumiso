import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { generateModernDailySummaryEmail } from './_templates/enhanced-daily-summary-modern.ts';
import { generateEmptyDailySummaryEmail } from './_templates/enhanced-daily-summary-empty.ts';
import { createEmailLocalization } from '../_shared/email-i18n.ts';
import {
  getErrorMessage,
  getErrorStack,
} from '../_shared/error-utils.ts';
import {
  createResendClient,
  type ResendClient,
} from '../_shared/resend-utils.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let createSupabaseClient = createClient;
const defaultResendClient: ResendClient = createResendClient(Deno.env.get("RESEND_API_KEY"));
let resendClient: ResendClient = defaultResendClient;

export function setSupabaseClientFactoryForTests(factory: typeof createClient) {
  createSupabaseClient = factory;
}

export function resetSupabaseClientFactoryForTests() {
  createSupabaseClient = createClient;
}

export function setResendClientForTests(client: ResendClient) {
  resendClient = client;
}

export function resetResendClientForTests() {
  resendClient = defaultResendClient;
}

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

export const handler = async (req: Request): Promise<Response> => {
  console.log('Unified notification processor started');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const adminSupabase = createSupabaseClient(
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

  } catch (error: unknown) {
    console.error('Error in notification processor:', error);
    return new Response(JSON.stringify({
      error: getErrorMessage(error),
      stack: getErrorStack(error),
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

// Process all pending immediate notifications
export async function processPendingNotifications(supabase: any, organizationId?: string, force = false) {
  console.log('Processing pending immediate notifications...');

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('delivery_method', 'immediate')
    .eq('status', 'pending')
    .lt('retry_count', 3); // Maximum 3 retries

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
    throw new Error(`Error fetching pending notifications: ${getErrorMessage(error)}`);
  }

  console.log(`Found ${notifications?.length || 0} pending immediate notifications`);

  const results = [];
  for (const notification of notifications || []) {
    try {
      const result = await processSpecificNotification(supabase, notification.id, notification);
      results.push({ id: notification.id, success: true, result });
    } catch (error: unknown) {
      console.error(`Error processing notification ${notification.id}:`, error);
      const errorMessage = getErrorMessage(error);
      results.push({ id: notification.id, success: false, error: errorMessage });
      
      // Update notification status to failed
      await updateNotificationStatus(supabase, notification.id, 'failed', errorMessage);
    }
  }

  return {
    processed: notifications?.length || 0,
    results
  };
}

// Process scheduled notifications that are due
export async function processScheduledNotifications(supabase: any, organizationId?: string, force = false) {
  console.log('Processing scheduled notifications...');

  const now = new Date();
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('delivery_method', 'scheduled')
    .eq('status', 'pending')
    .lt('retry_count', 3); // Maximum 3 retries

  if (!force) {
    // Only process notifications scheduled for now or earlier
    query = query.lte('scheduled_for', now.toISOString());
  }

  if (organizationId && !force) {
    query = query.eq('organization_id', organizationId);
  }

  const { data: notifications, error } = await query.limit(100);

  if (error) {
    throw new Error(`Error fetching scheduled notifications: ${getErrorMessage(error)}`);
  }

  console.log(`Found ${notifications?.length || 0} scheduled notifications to process`);

  const results = [];
  for (const notification of notifications || []) {
    try {
      const result = await processSpecificNotification(supabase, notification.id, notification);
      results.push({ id: notification.id, success: true, result });
    } catch (error: unknown) {
      console.error(`Error processing scheduled notification ${notification.id}:`, error);
      const errorMessage = getErrorMessage(error);
      results.push({ id: notification.id, success: false, error: errorMessage });
      
      // Update notification status to failed with retry logic
      await updateNotificationStatus(
        supabase,
        notification.id,
        'failed',
        errorMessage,
        notification.retry_count + 1,
      );
    }
  }

  return {
    processed: notifications?.length || 0,
    results
  };
}

// Process a specific notification
export async function processSpecificNotification(supabase: any, notificationId: string, notificationData?: any) {
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

  // Check if notifications are globally enabled before processing
  const isEnabled = await checkNotificationEnabled(supabase, notificationData.user_id, notificationData.organization_id, notificationData.notification_type);
  if (!isEnabled) {
    console.log(`Notifications disabled for user ${notificationData.user_id}, skipping ${notificationData.notification_type}`);
    await updateNotificationStatus(supabase, notificationId, 'cancelled', 'Notifications disabled');
    return { skipped: true, reason: 'Notifications disabled' };
  }

  // Route to appropriate processor based on type
  let result;
  
  switch (notificationData.notification_type) {
    case 'daily-summary':
      result = await processDailySummary(supabase, notificationData);
      break;
    case 'project-milestone':
      result = await processProjectMilestone(supabase, notificationData);
      break;
    case 'workflow-message':
      result = await processWorkflowMessage(supabase, notificationData);
      break;
    default:
      throw new Error(`Unsupported notification type: ${notificationData.notification_type}`);
  }

  // Mark as sent on success
  await updateNotificationStatus(supabase, notificationId, 'sent', null, 0, result?.id);
  
  return result;
}

// Process daily summary notification
export async function processDailySummary(supabase: any, notification: any) {
  console.log(`Processing daily summary for user ${notification.user_id}`);

  // Get user data
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(notification.user_id);
  if (userError || !userData.user) {
    throw new Error(`Failed to get user: ${userError?.message || 'User not found'}`);
  }

  const { data: languagePreference } = await supabase
    .from('user_language_preferences')
    .select('language_code')
    .eq('user_id', notification.user_id)
    .maybeSingle();

  const localization = createEmailLocalization(languagePreference?.language_code);
  const t = localization.t;

  // Get user settings and organization settings
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', notification.user_id)
    .maybeSingle();

  // Get organization settings for branding and timezone
  const { data: orgSettings } = await supabase
    .from('organization_settings')
    .select('photography_business_name, primary_brand_color, date_format, time_format, timezone')
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

  // Get overdue activities
  const { data: overdueActivities } = await supabase
    .from('activities')
    .select(`
      id, content, reminder_date, reminder_time,
      lead_id, project_id,
      leads(name),
      projects(name)
    `)
    .eq('organization_id', notification.organization_id)
    .lt('reminder_date', today)
    .eq('completed', false);

  // Get past sessions needing action
  const { data: pastSessions } = await supabase
    .from('sessions')
    .select(`
      id, location, session_date, session_time,
      leads(name), projects(name)
    `)
    .eq('organization_id', notification.organization_id)
    .lt('session_date', today);

  const templateData = {
    userFullName: userData.user.email?.split('@')[0] || 'User',
    businessName: orgSettings?.photography_business_name || 'Lumiso',
    brandColor: orgSettings?.primary_brand_color || '#1EB29F',
    dateFormat: orgSettings?.date_format || 'DD/MM/YYYY',
    timeFormat: orgSettings?.time_format || '12-hour',
    timezone: orgSettings?.timezone || 'UTC',
    baseUrl: 'https://my.lumiso.app',
    language: localization.language,
    localization,
  };

  // Check if there's any activity
  const hasActivity = (activities && activities.length > 0) || (sessions && sessions.length > 0);
  
  let emailHtml;
  if (hasActivity) {
    emailHtml = generateModernDailySummaryEmail(
      sessions || [], 
      activities || [], 
      { leads: [], activities: overdueActivities || [] }, 
      pastSessions || [],
      templateData
    );
  } else {
    emailHtml = generateEmptyDailySummaryEmail(
      { leads: [], activities: overdueActivities || [] }, 
      pastSessions || [],
      templateData
    );
  }

  // Send email
  const subject = hasActivity
    ? t('dailySummary.subject.defaultWithData')
    : t('dailySummary.subject.defaultEmpty');

  const emailResponse = await resendClient.emails.send({
    from: `Lumiso <daily-summary@lumiso.app>`,
    to: [userData.user.email!],
    subject,
    html: emailHtml,
  });

  if (emailResponse.error) {
    throw new Error(`Failed to send daily summary: ${emailResponse.error.message}`);
  }

  console.log(`Daily summary sent successfully to ${userData.user.email}`);
  return emailResponse.data;
}

// Process project milestone notification
export async function processProjectMilestone(supabase: any, notification: any) {
  const metadata = notification.metadata || {};
  const { project_id, old_status, new_status, changed_by_user_id } = metadata;

  if (!project_id) {
    throw new Error('project_id required in metadata for milestone notification');
  }

  console.log(`Processing milestone: ${project_id} from ${old_status} to ${new_status}`);
  
  // Use the send-reminder-notifications function for actual processing
  const { data, error } = await supabase.functions.invoke('send-reminder-notifications', {
    body: {
      type: 'project-milestone',
      project_id,
      old_status,
      new_status,
      changed_by_user_id,
      organizationId: notification.organization_id
    }
  });

  if (error) {
    throw new Error(`Failed to process milestone: ${getErrorMessage(error)}`);
  }

  return data;
}


// Process workflow message notification
export async function processWorkflowMessage(supabase: any, notification: any) {
  const metadata = notification.metadata || {};
  const { template_id, entity_data } = metadata;

  if (!template_id) {
    throw new Error('template_id required in metadata for workflow-message notification');
  }

  console.log(`Processing workflow message with template ${template_id} for user ${notification.user_id}`);

  // Get user data
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(notification.user_id);
  if (userError || !userData.user) {
    throw new Error(`Failed to get user: ${userError?.message || 'User not found'}`);
  }

  // Fetch the message template and its email channel view
  const { data: template, error: templateError } = await supabase
    .from('message_templates')
    .select(`
      *,
      template_channel_views!inner(
        channel,
        subject,
        content,
        html_content
      )
    `)
    .eq('id', template_id)
    .eq('template_channel_views.channel', 'email')
    .single();

  if (templateError || !template) {
    throw new Error(`Template not found: ${template_id}`);
  }

  // Get organization settings for branding
  const { data: orgSettings } = await supabase
    .from('organization_settings')
    .select('photography_business_name, primary_brand_color, email')
    .eq('organization_id', notification.organization_id)
    .maybeSingle();

  // Prepare template variables
  const variables = {
    customer_name: entity_data?.customer_name || entity_data?.client_name || 'Valued Client',
    customer_email: entity_data?.customer_email || entity_data?.client_email || '',
    session_type: entity_data?.project_name || 'Session',
    session_date: entity_data?.session_date || '',
    session_time: entity_data?.session_time || '',
    session_location: entity_data?.location || 'Studio',
    project_name: entity_data?.project_name || '',
    studio_name: orgSettings?.photography_business_name || 'Lumiso',
    studio_phone: orgSettings?.phone || ''
  };

  // Replace placeholders in subject and content
  let subject = template.template_channel_views[0].subject || template.name;
  let htmlContent = template.template_channel_views[0].html_content || template.template_channel_views[0].content;
  
  // Simple placeholder replacement
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    subject = subject.replace(new RegExp(placeholder, 'g'), value);
    htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), value);
  });

  // Send email using Resend
  const emailResponse = await resendClient.emails.send({
    from: `${orgSettings?.photography_business_name || 'Lumiso'} <hello@updates.lumiso.app>`,
    to: [variables.customer_email],
    subject: subject,
    html: htmlContent,
  });

  if (emailResponse.error) {
    throw new Error(`Failed to send workflow message: ${emailResponse.error.message}`);
  }

  console.log(`Workflow message sent successfully to ${variables.customer_email}`);
  return emailResponse.data;
}

// Schedule future notifications (e.g., daily summaries for tomorrow)
export async function scheduleNotifications(supabase: any, organizationId?: string) {
  console.log('Scheduling future notifications...');

  // Fetch active organization members
  let membersQuery = supabase
    .from('organization_members')
    .select('organization_id, user_id')
    .eq('status', 'active');

  if (organizationId) {
    membersQuery = membersQuery.eq('organization_id', organizationId);
  }

  const { data: members, error: membersError } = await membersQuery;

  if (membersError) {
    throw new Error(`Error fetching organization members: ${membersError.message}`);
  }

  if (!members || members.length === 0) {
    console.log('No active organization members found for scheduling');
    return {
      organizations_processed: 0,
      notifications_scheduled: 0,
      scheduled_for_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
  }

  const userIds = Array.from(new Set(members.map((member: any) => member.user_id)));
  const organizationIds = Array.from(new Set(members.map((member: any) => member.organization_id)));

  // Fetch user notification preferences
  const { data: userSettings, error: userSettingsError } = await supabase
    .from('user_settings')
    .select('user_id, notification_global_enabled, notification_daily_summary_enabled, notification_scheduled_time')
    .in('user_id', userIds);

  if (userSettingsError) {
    throw new Error(`Error fetching user settings: ${userSettingsError.message}`);
  }

  type UserNotificationPreference = {
    user_id: string;
    notification_global_enabled: boolean | null;
    notification_daily_summary_enabled: boolean | null;
    notification_scheduled_time: string | null;
  };

  const userSettingsRows: UserNotificationPreference[] = (userSettings || []).map(
    (setting: any) => ({
      user_id: String(setting.user_id),
      notification_global_enabled:
        setting.notification_global_enabled ?? null,
      notification_daily_summary_enabled:
        setting.notification_daily_summary_enabled ?? null,
      notification_scheduled_time: setting.notification_scheduled_time ?? null,
    }),
  );

  const userSettingsMap = new Map(
    userSettingsRows.map((setting) => [setting.user_id, setting]),
  );

  // Fetch organization-level notification settings
  const { data: organizationSettings, error: orgSettingsError } = await supabase
    .from('organization_settings')
    .select('organization_id, notification_global_enabled, notification_daily_summary_enabled, timezone')
    .in('organization_id', organizationIds);

  if (orgSettingsError) {
    throw new Error(`Error fetching organization settings: ${orgSettingsError.message}`);
  }

  type OrganizationNotificationPreference = {
    organization_id: string;
    notification_global_enabled: boolean | null;
    notification_daily_summary_enabled: boolean | null;
    timezone: string | null;
  };

  const organizationSettingsRows: OrganizationNotificationPreference[] = (
    organizationSettings || []
  ).map((setting: any) => ({
    organization_id: String(setting.organization_id),
    notification_global_enabled:
      setting.notification_global_enabled ?? null,
    notification_daily_summary_enabled:
      setting.notification_daily_summary_enabled ?? null,
    timezone: setting.timezone ?? null,
  }));

  const organizationSettingsMap = new Map(
    organizationSettingsRows.map((setting) => [
      setting.organization_id,
      setting,
    ]),
  );

  const now = new Date();
  const tomorrow = new Date(now.getTime());
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const tomorrowDate = tomorrow.toISOString().split('T')[0];
  const tomorrowStart = `${tomorrowDate}T00:00:00Z`;
  const tomorrowEnd = `${tomorrowDate}T23:59:59Z`;

  // Fetch already scheduled notifications for tomorrow
  let existingQuery = supabase
    .from('notifications')
    .select('organization_id, user_id')
    .eq('notification_type', 'daily-summary')
    .eq('delivery_method', 'scheduled')
    .gte('scheduled_for', tomorrowStart)
    .lt('scheduled_for', tomorrowEnd);

  if (organizationId) {
    existingQuery = existingQuery.eq('organization_id', organizationId);
  } else {
    existingQuery = existingQuery.in('organization_id', organizationIds);
  }

  const { data: existingNotifications, error: existingError } = await existingQuery;

  if (existingError) {
    throw new Error(`Error checking existing scheduled notifications: ${existingError.message}`);
  }

  const existingKey = new Set(
    (existingNotifications || []).map((item: any) => `${item.organization_id}:${item.user_id}`)
  );

  const scheduledNotifications: any[] = [];

  for (const member of members || []) {
    const userSetting = userSettingsMap.get(member.user_id);
    if (!userSetting) {
      continue;
    }

    if (userSetting.notification_global_enabled === false) {
      continue;
    }

    if (userSetting.notification_daily_summary_enabled === false) {
      continue;
    }

    const orgSetting = organizationSettingsMap.get(member.organization_id);
    if (orgSetting) {
      if (orgSetting.notification_global_enabled === false) {
        continue;
      }

      if (orgSetting.notification_daily_summary_enabled === false) {
        continue;
      }
    }

    const existingIdentifier = `${member.organization_id}:${member.user_id}`;
    if (existingKey.has(existingIdentifier)) {
      continue;
    }

    const scheduledTimeString = typeof userSetting.notification_scheduled_time === 'string'
      ? userSetting.notification_scheduled_time
      : '09:00';

    const [hourStr = '09', minuteStr = '00'] = scheduledTimeString.split(':');
    const hour = Number.parseInt(hourStr, 10);
    const minute = Number.parseInt(minuteStr, 10);

    const validHour = Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : 9;
    const validMinute = Number.isFinite(minute) && minute >= 0 && minute <= 59 ? minute : 0;

    const scheduledFor = new Date(Date.UTC(
      tomorrow.getUTCFullYear(),
      tomorrow.getUTCMonth(),
      tomorrow.getUTCDate(),
      validHour,
      validMinute,
      0,
      0
    ));

    scheduledNotifications.push({
      organization_id: member.organization_id,
      user_id: member.user_id,
      notification_type: 'daily-summary',
      delivery_method: 'scheduled',
      status: 'pending',
      scheduled_for: scheduledFor.toISOString(),
      metadata: {}
    });
  }

  if (scheduledNotifications.length > 0) {
    const { error: insertError } = await supabase
      .from('notifications')
      .insert(scheduledNotifications);

    if (insertError) {
      throw new Error(`Error scheduling notifications: ${getErrorMessage(insertError)}`);
    }
  }

  return {
    organizations_processed: organizationIds.length,
    notifications_scheduled: scheduledNotifications.length,
    scheduled_for_date: tomorrowDate
  };
}

// Retry failed notifications with exponential backoff
export async function retryFailedNotifications(supabase: any, organizationId?: string) {
  console.log('Retrying failed notifications...');

  // Use the database function to retry failed notifications
  const { data, error } = await supabase.rpc('retry_failed_notifications');

  if (error) {
    throw new Error(`Error retrying notifications: ${getErrorMessage(error)}`);
  }

  console.log(`Retried ${data || 0} failed notifications`);
  
  return {
    retried_count: data || 0
  };
}

// Helper function to update notification status
export async function updateNotificationStatus(
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

// Check if notifications are enabled for user/organization
export async function checkNotificationEnabled(supabase: any, userId: string, organizationId: string, notificationType: string): Promise<boolean> {
  try {
    // Check user settings first
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('notification_global_enabled, notification_daily_summary_enabled, notification_new_assignment_enabled, notification_project_milestone_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    // If user has global disabled, skip
    if (userSettings && userSettings.notification_global_enabled === false) {
      return false;
    }

    // Check specific notification type settings
    if (userSettings) {
      switch (notificationType) {
        case 'daily-summary':
          if (userSettings.notification_daily_summary_enabled === false) return false;
          break;
        case 'new-assignment':
          if (userSettings.notification_new_assignment_enabled === false) return false;
          break;
        case 'project-milestone':
          if (userSettings.notification_project_milestone_enabled === false) return false;
          break;
      }
    }

    // Check organization settings if available
    const { data: orgSettings } = await supabase
      .from('organization_settings')
      .select('notification_global_enabled, notification_daily_summary_enabled, notification_new_assignment_enabled, notification_project_milestone_enabled')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (orgSettings && orgSettings.notification_global_enabled === false) {
      return false;
    }

    // Check org-specific settings
    if (orgSettings) {
      switch (notificationType) {
        case 'daily-summary':
          if (orgSettings.notification_daily_summary_enabled === false) return false;
          break;
        case 'new-assignment':
          if (orgSettings.notification_new_assignment_enabled === false) return false;
          break;
        case 'project-milestone':
          if (orgSettings.notification_project_milestone_enabled === false) return false;
          break;
      }
    }

    return true;
  } catch (error: any) {
    console.error('Error checking notification settings:', error);
    // Default to enabled on error to avoid blocking notifications
    return true;
  }
}

serve(handler);
