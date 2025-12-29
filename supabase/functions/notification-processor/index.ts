import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { generateModernDailySummaryEmail } from './_templates/enhanced-daily-summary-modern.ts';
import { generateEmptyDailySummaryEmail } from './_templates/enhanced-daily-summary-empty.ts';
import type { Activity as TemplateActivity, Session as TemplateSession } from './_templates/enhanced-email-base.ts';
import { createEmailLocalization } from '../_shared/email-i18n.ts';
import {
  getErrorMessage,
  getErrorStack,
} from '../_shared/error-utils.ts';
import {
  createResendClient,
  type ResendClient,
} from '../_shared/resend-utils.ts';
import { getMessagingGuard } from "../_shared/messaging-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]
  | undefined;

type JsonObject = { [key: string]: Json | undefined };

type NotificationDeliveryMethod = 'immediate' | 'scheduled';
type NotificationStatus = 'pending' | 'processing' | 'failed' | 'sent' | 'cancelled';
type NotificationType =
  | 'daily-summary'
  | 'project-milestone'
  | 'workflow-message'
  | 'new-assignment'
  | string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenericSupabaseClient = SupabaseClient<any, any, any>;

interface NotificationRow {
  id: string;
  notification_type: NotificationType;
  delivery_method: NotificationDeliveryMethod;
  status: NotificationStatus;
  organization_id: string;
  user_id: string;
  retry_count: number;
  metadata: Json | null;
  scheduled_for: string | null;
  created_at: string;
  error_message?: string | null;
  email_id?: string | null;
}

type NotificationMetadata = JsonObject;

interface NotificationUpdatePayload {
  status: NotificationStatus;
  updated_at: string;
  sent_at?: string;
  error_message?: string | null;
  retry_count?: number;
  email_id?: string | null;
}

interface NotificationProcessSuccess {
  id: string;
  success: true;
  result: NotificationHandlerResult;
}

interface NotificationProcessFailure {
  id: string;
  success: false;
  error: string;
}

type NotificationProcessOutcome = NotificationProcessSuccess | NotificationProcessFailure;

interface ProcessAggregateResult {
  processed: number;
  results: NotificationProcessOutcome[];
}

type NotificationHandlerResult = Record<string, unknown> | null;

type MinimalSupabaseClient = Pick<GenericSupabaseClient, 'from'>;

interface ScheduleNotificationsResult {
  organizations_processed: number;
  notifications_scheduled: number;
  scheduled_for_date: string;
}

interface RetryFailedResult {
  retried_count: number;
}

interface OrganizationMemberRow {
  organization_id: string;
  user_id: string;
  status: string | null;
}

interface UserNotificationPreference {
  user_id: string;
  notification_global_enabled: boolean | null;
  notification_daily_summary_enabled: boolean | null;
  notification_scheduled_time: string | null;
}

interface OrganizationNotificationPreference {
  organization_id: string;
  notification_global_enabled: boolean | null;
  notification_daily_summary_enabled: boolean | null;
  timezone: string | null;
}

interface UserLanguagePreferenceRow {
  language_code: string | null;
}

interface OrganizationSettingsRow {
  organization_id?: string;
  photography_business_name?: string | null;
  primary_brand_color?: string | null;
  date_format?: string | null;
  time_format?: string | null;
  timezone?: string | null;
  email?: string | null;
  phone?: string | null;
  notification_global_enabled?: boolean | null;
  notification_daily_summary_enabled?: boolean | null;
  notification_new_assignment_enabled?: boolean | null;
  notification_project_milestone_enabled?: boolean | null;
}

interface ActivityRow {
  id: string;
  content: string | null;
  type: string | null;
  completed: boolean | null;
  reminder_date: string | null;
  reminder_time: string | null;
  lead_id: string | null;
  project_id: string | null;
  leads: { name?: string | null } | null;
  projects: { name?: string | null } | null;
}

interface SessionRow {
  id: string;
  location: string | null;
  session_date: string | null;
  session_time: string | null;
  status?: string | null;
  leads: { name?: string | null } | null;
  projects: { name?: string | null } | null;
}

interface NotificationUserKeyRow {
  organization_id: string;
  user_id: string;
}

interface ScheduledNotificationInsert {
  organization_id: string;
  user_id: string;
  notification_type: 'daily-summary';
  delivery_method: NotificationDeliveryMethod;
  status: NotificationStatus;
  scheduled_for: string;
  metadata: NotificationMetadata;
}

interface ProjectMilestoneMetadata extends JsonObject {
  project_id?: string | null;
  old_status?: string | null;
  new_status?: string | null;
  changed_by_user_id?: string | null;
}

interface WorkflowEntityData extends JsonObject {
  customer_name?: string | null;
  client_name?: string | null;
  customer_email?: string | null;
  client_email?: string | null;
  session_type_name?: string | null;
  project_name?: string | null;
  session_date?: string | null;
  session_time?: string | null;
  location?: string | null;
}

interface WorkflowMessageMetadata extends JsonObject {
  template_id?: string | null;
  entity_data?: WorkflowEntityData | null;
}

interface UserNotificationSettingsRow {
  notification_global_enabled: boolean | null;
  notification_daily_summary_enabled: boolean | null;
  notification_new_assignment_enabled: boolean | null;
  notification_project_milestone_enabled: boolean | null;
}

interface OrganizationNotificationSettingsRow {
  notification_global_enabled: boolean | null;
  notification_daily_summary_enabled: boolean | null;
  notification_new_assignment_enabled: boolean | null;
  notification_project_milestone_enabled: boolean | null;
}

interface TemplateChannelViewRow {
  channel: string;
  subject: string | null;
  content: string | null;
  html_content: string | null;
}

interface MessageTemplateRow {
  id: string;
  name: string | null;
  template_channel_views: TemplateChannelViewRow[];
}

const FALLBACK_DATE = new Date().toISOString().split('T')[0];

const ensureName = (value: string | null | undefined, fallback: string): string =>
  value && value.trim().length > 0 ? value : fallback;

function mapSessionRowToTemplate(row: SessionRow): TemplateSession {
  return {
    id: row.id,
    session_date: row.session_date ?? FALLBACK_DATE,
    session_time: row.session_time,
    location: row.location,
    leads: row.leads
      ? { name: ensureName(row.leads.name ?? null, 'Client') }
      : null,
    projects: row.projects
      ? { name: ensureName(row.projects.name ?? null, 'Project') }
      : null,
  };
}

function mapActivityRowToTemplate(row: ActivityRow): TemplateActivity {
  return {
    id: row.id,
    content: ensureName(row.content ?? null, 'Reminder'),
    reminder_date: row.reminder_date ?? FALLBACK_DATE,
    reminder_time: row.reminder_time,
    lead_id: row.lead_id,
    project_id: row.project_id,
    leads: row.leads
      ? { name: ensureName(row.leads.name ?? null, 'Lead') }
      : null,
    projects: row.projects
      ? { name: ensureName(row.projects.name ?? null, 'Project') }
      : null,
  };
}

let createSupabaseClient: typeof createClient = createClient;
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
  metadata?: NotificationMetadata;
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
  ) as GenericSupabaseClient;

  try {
    const { action, notification_id, organizationId, force = false }: ProcessorRequest = await req.json();
    console.log(`Processing action: ${action}`);

    type HandlerResult =
      | ProcessAggregateResult
      | NotificationHandlerResult
      | ScheduleNotificationsResult
      | RetryFailedResult;

    let result: HandlerResult;

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
export async function processPendingNotifications(
  supabase: GenericSupabaseClient,
  organizationId?: string,
  force = false
): Promise<ProcessAggregateResult> {
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

  const { data, error } = await query
    .limit(50); // Process in batches

  const notifications = (data ?? []) as NotificationRow[];

  if (error) {
    throw new Error(`Error fetching pending notifications: ${getErrorMessage(error)}`);
  }

  console.log(`Found ${notifications.length} pending immediate notifications`);

  const results: NotificationProcessOutcome[] = [];
  for (const notification of notifications) {
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
    processed: notifications.length,
    results
  };
}

// Process scheduled notifications that are due
export async function processScheduledNotifications(
  supabase: GenericSupabaseClient,
  organizationId?: string,
  force = false
): Promise<ProcessAggregateResult> {
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

  const { data, error } = await query
    .limit(100);

  const notifications = (data ?? []) as NotificationRow[];

  if (error) {
    throw new Error(`Error fetching scheduled notifications: ${getErrorMessage(error)}`);
  }

  console.log(`Found ${notifications.length} scheduled notifications to process`);

  const results: NotificationProcessOutcome[] = [];
  for (const notification of notifications) {
    try {
      const result = await processSpecificNotification(supabase, notification.id, notification);
      results.push({ id: notification.id, success: true, result });
    } catch (error: unknown) {
      console.error(`Error processing scheduled notification ${notification.id}:`, error);
      const errorMessage = getErrorMessage(error);
      results.push({ id: notification.id, success: false, error: errorMessage });
      
      // Update notification status to failed with retry logic
      const nextRetryCount = (notification.retry_count ?? 0) + 1;
      await updateNotificationStatus(
        supabase,
        notification.id,
        'failed',
        errorMessage,
        nextRetryCount,
      );
    }
  }

  return {
    processed: notifications.length,
    results
  };
}

// Process a specific notification
export async function processSpecificNotification(
  supabase: GenericSupabaseClient,
  notificationId: string,
  notificationData?: NotificationRow
): Promise<NotificationHandlerResult> {
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
    notificationData = data as NotificationRow;
  }

  console.log(`Processing ${notificationData.notification_type} notification for user ${notificationData.user_id}`);

  const guard = await getMessagingGuard(supabase, notificationData.organization_id);
  if (guard?.hardBlocked) {
    console.log(
      `Messaging blocked for org ${notificationData.organization_id} (notification ${notificationId}), skipping`
    );
    await updateNotificationStatus(
      supabase,
      notificationId,
      'cancelled',
      guard.reason ?? 'Messaging blocked for organization'
    );
    return { skipped: true, reason: guard.reason ?? 'Messaging blocked' };
  }

  // Mark as processing
  await updateNotificationStatus(supabase, notificationId, 'processing');

  // Check if notifications are globally enabled before processing
  const isEnabled = await checkNotificationEnabled(supabase, notificationData.user_id, notificationData.organization_id, notificationData.notification_type);
  if (!isEnabled) {
    console.log(`Notifications disabled for user ${notificationData.user_id}, skipping ${notificationData.notification_type}`);
    await updateNotificationStatus(supabase, notificationId, 'cancelled', 'Notifications disabled');
    return { skipped: true, reason: 'Notifications disabled' };
  }

  // Route to appropriate processor based on type
  let result: NotificationHandlerResult;
  
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
  const emailId =
    result && typeof result === 'object' && 'id' in result && typeof (result as { id?: unknown }).id === 'string'
      ? (result as { id: string }).id
      : null;

  await updateNotificationStatus(supabase, notificationId, 'sent', null, 0, emailId);
  
  return result;
}

// Process daily summary notification
export async function processDailySummary(
  supabase: GenericSupabaseClient,
  notification: NotificationRow
): Promise<NotificationHandlerResult> {
  console.log(`Processing daily summary for user ${notification.user_id}`);

  // Get user data
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(notification.user_id);
  if (userError || !userData.user) {
    throw new Error(`Failed to get user: ${userError?.message || 'User not found'}`);
  }

  const { data: languagePreferenceData } = await supabase
    .from('user_language_preferences')
    .select('language_code')
    .eq('user_id', notification.user_id)
    .maybeSingle();

  const languagePreference = languagePreferenceData as UserLanguagePreferenceRow | null;

  const localization = createEmailLocalization(languagePreference?.language_code ?? undefined);
  const t = localization.t;

  // Get organization settings for branding and timezone
  const { data: orgSettingsData } = await supabase
    .from('organization_settings')
    .select('photography_business_name, primary_brand_color, date_format, time_format, timezone, phone')
    .eq('organization_id', notification.organization_id)
    .maybeSingle();
  const orgSettings = orgSettingsData as OrganizationSettingsRow | null;

  // Get activities for today
  const today = new Date().toISOString().split('T')[0];
  const { data: activitiesData } = await supabase
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
  const activities = (activitiesData ?? []) as ActivityRow[];

  // Get sessions for today  
  const { data: sessionsData } = await supabase
    .from('sessions')
    .select(`
      id, location, session_date, session_time, status,
      leads(name), projects(name)
    `)
    .eq('organization_id', notification.organization_id)
    .eq('session_date', today);
  const sessions = (sessionsData ?? []) as SessionRow[];

  // Get overdue activities
  const { data: overdueActivitiesData } = await supabase
    .from('activities')
    .select(`
      id, content, type, completed, reminder_date, reminder_time,
      lead_id, project_id,
      leads(name),
      projects(name)
    `)
    .eq('organization_id', notification.organization_id)
    .lt('reminder_date', today)
    .eq('completed', false);
  const overdueActivities = (overdueActivitiesData ?? []) as unknown as ActivityRow[];

  // Get past sessions needing action
  const { data: pastSessionsData } = await supabase
    .from('sessions')
    .select(`
      id, location, session_date, session_time,
      leads(name), projects(name)
    `)
    .eq('organization_id', notification.organization_id)
    .lt('session_date', today);
  const pastSessions = (pastSessionsData ?? []) as SessionRow[];

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
  const mappedSessions = sessions.map(mapSessionRowToTemplate);
  const mappedActivities = activities.map(mapActivityRowToTemplate);
  const mappedOverdueActivities = overdueActivities.map(mapActivityRowToTemplate);
  const mappedPastSessions = pastSessions.map(mapSessionRowToTemplate);

  const hasActivity = mappedActivities.length > 0 || mappedSessions.length > 0;

  let emailHtml;
  if (hasActivity) {
    emailHtml = generateModernDailySummaryEmail(
      mappedSessions,
      mappedActivities,
      { leads: [], activities: mappedOverdueActivities },
      mappedPastSessions,
      templateData
    );
  } else {
    emailHtml = generateEmptyDailySummaryEmail(
      { leads: [], activities: mappedOverdueActivities },
      mappedPastSessions,
      templateData
    );
  }

  // Send email
  const subject = hasActivity
    ? t('dailySummary.subject.defaultWithData')
    : t('dailySummary.subject.defaultEmpty');

  const emailResponse = await resendClient.emails.send({
    from: `Lumiso <hello@updates.lumiso.app>`,
    to: [userData.user.email!],
    subject,
    html: emailHtml,
  });

  if (emailResponse.error) {
    throw new Error(`Failed to send daily summary: ${emailResponse.error.message}`);
  }

  console.log(`Daily summary sent successfully to ${userData.user.email}`);
  return (emailResponse.data ?? null) as NotificationHandlerResult;
}

// Process project milestone notification
export async function processProjectMilestone(
  supabase: GenericSupabaseClient,
  notification: NotificationRow
): Promise<NotificationHandlerResult> {
  const metadata = (notification.metadata ?? {}) as ProjectMilestoneMetadata;
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
export async function processWorkflowMessage(
  supabase: GenericSupabaseClient,
  notification: NotificationRow
): Promise<NotificationHandlerResult> {
  const metadata = (notification.metadata ?? {}) as WorkflowMessageMetadata;
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
  const { data: templateData, error: templateError } = await supabase
    .from('message_templates')
    .select(`
      id,
      name,
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
  const template = templateData as MessageTemplateRow | null;

  if (templateError || !template) {
    throw new Error(`Template not found: ${template_id}`);
  }

  // Get organization settings for branding
  const { data: orgSettingsData } = await supabase
    .from('organization_settings')
    .select('photography_business_name, primary_brand_color, email, phone')
    .eq('organization_id', notification.organization_id)
    .maybeSingle();
  const orgSettings = orgSettingsData as OrganizationSettingsRow | null;

  // Prepare template variables
  const variables = {
    customer_name: entity_data?.customer_name || entity_data?.client_name || 'Valued Client',
    customer_email: entity_data?.customer_email || entity_data?.client_email || '',
    session_type: entity_data?.session_type_name || entity_data?.project_name || 'Session',
    session_date: entity_data?.session_date || '',
    session_time: entity_data?.session_time || '',
    session_location: entity_data?.location || 'Studio',
    project_name: entity_data?.project_name || '',
    studio_name: orgSettings?.photography_business_name || 'Lumiso',
    studio_phone: orgSettings?.phone || ''
  };

  // Replace placeholders in subject and content
  const channelView = template.template_channel_views?.[0];
  if (!channelView) {
    throw new Error(`Email channel view not found for template ${template_id}`);
  }

  let subject = channelView.subject ?? template.name ?? 'Notification';
  let htmlContent = channelView.html_content ?? channelView.content ?? '';
  
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
    subject,
    html: htmlContent,
  });

  if (emailResponse.error) {
    throw new Error(`Failed to send workflow message: ${emailResponse.error.message}`);
  }

  console.log(`Workflow message sent successfully to ${variables.customer_email}`);
  return (emailResponse.data ?? null) as NotificationHandlerResult;
}

// Schedule future notifications (e.g., daily summaries for tomorrow)
export async function scheduleNotifications(
  supabase: GenericSupabaseClient,
  organizationId?: string
): Promise<ScheduleNotificationsResult> {
  console.log('Scheduling future notifications...');

  // Fetch active organization members
  let membersQuery = supabase
    .from('organization_members')
    .select('organization_id, user_id, status')
    .eq('status', 'active');

  if (organizationId) {
    membersQuery = membersQuery.eq('organization_id', organizationId);
  }
  const { data: memberData, error: membersError } = await membersQuery;
  const members = (memberData ?? []) as OrganizationMemberRow[];

  if (membersError) {
    throw new Error(`Error fetching organization members: ${membersError.message}`);
  }

  if (members.length === 0) {
    console.log('No active organization members found for scheduling');
    return {
      organizations_processed: 0,
      notifications_scheduled: 0,
      scheduled_for_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
  }

  const userIds = Array.from(new Set(members.map((member) => member.user_id)));
  const organizationIds = Array.from(new Set(members.map((member) => member.organization_id)));

  const schedulableOrgIds: string[] = [];
  for (const orgId of organizationIds) {
    const guard = await getMessagingGuard(supabase, orgId);
    if (!guard || guard.shouldScheduleNew) {
      schedulableOrgIds.push(orgId);
    } else {
      console.log(`Skipping scheduling for org ${orgId}: messaging blocked (grace ended)`);
    }
  }

  if (schedulableOrgIds.length === 0) {
    console.log('No organizations eligible for scheduling due to membership status');
    return {
      organizations_processed: 0,
      notifications_scheduled: 0,
      scheduled_for_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
  }

  if (organizationId && !schedulableOrgIds.includes(organizationId)) {
    console.log(`Requested organization ${organizationId} not eligible for scheduling (blocked)`);
    return {
      organizations_processed: 0,
      notifications_scheduled: 0,
      scheduled_for_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
  }

  // Fetch user notification preferences
  const { data: userSettingsData, error: userSettingsError } = await supabase
    .from('user_settings')
    .select('user_id, notification_global_enabled, notification_daily_summary_enabled, notification_scheduled_time')
    .in('user_id', userIds);
  const userSettings = (userSettingsData ?? []) as UserNotificationPreference[];

  if (userSettingsError) {
    throw new Error(`Error fetching user settings: ${userSettingsError.message}`);
  }

  const userSettingsRows: UserNotificationPreference[] = userSettings.map((setting) => ({
    user_id: String(setting.user_id),
    notification_global_enabled: setting.notification_global_enabled ?? null,
    notification_daily_summary_enabled: setting.notification_daily_summary_enabled ?? null,
    notification_scheduled_time: setting.notification_scheduled_time ?? null,
  }));

  const userSettingsMap = new Map(
    userSettingsRows.map((setting) => [setting.user_id, setting]),
  );

  // Fetch organization-level notification settings
  const { data: organizationSettingsData, error: orgSettingsError } = await supabase
    .from('organization_settings')
    .select('organization_id, notification_global_enabled, notification_daily_summary_enabled, timezone')
    .in('organization_id', schedulableOrgIds);
  const organizationSettings = (organizationSettingsData ?? []) as OrganizationNotificationPreference[];

  if (orgSettingsError) {
    throw new Error(`Error fetching organization settings: ${orgSettingsError.message}`);
  }

  const organizationSettingsRows: OrganizationNotificationPreference[] = organizationSettings.map((setting) => ({
    organization_id: String(setting.organization_id),
    notification_global_enabled: setting.notification_global_enabled ?? null,
    notification_daily_summary_enabled: setting.notification_daily_summary_enabled ?? null,
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
    existingQuery = existingQuery.in('organization_id', schedulableOrgIds);
  }

  const { data: existingNotificationsData, error: existingError } = await existingQuery;
  const existingNotifications = (existingNotificationsData ?? []) as NotificationUserKeyRow[];

  if (existingError) {
    throw new Error(`Error checking existing scheduled notifications: ${existingError.message}`);
  }

  const existingKey = new Set(
    existingNotifications.map((item) => `${item.organization_id}:${item.user_id}`)
  );

  const scheduledNotifications: ScheduledNotificationInsert[] = [];

  for (const member of members) {
    if (!schedulableOrgIds.includes(member.organization_id)) {
      continue;
    }
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
      metadata: {} as NotificationMetadata,
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
export async function retryFailedNotifications(
  supabase: GenericSupabaseClient,
  organizationId?: string
): Promise<RetryFailedResult> {
  console.log('Retrying failed notifications...');

  if (organizationId) {
    console.log('Note: retry operates globally; organizationId provided:', organizationId);
  }

  // Use the database function to retry failed notifications
  const { data, error } = await supabase.rpc('retry_failed_notifications');

  if (error) {
    throw new Error(`Error retrying notifications: ${getErrorMessage(error)}`);
  }

  const retriedCount = (data as number | null) ?? 0;

  console.log(`Retried ${retriedCount} failed notifications`);
  
  return {
    retried_count: retriedCount
  };
}

// Helper function to update notification status
export async function updateNotificationStatus(
  supabase: GenericSupabaseClient, 
  notificationId: string, 
  status: NotificationStatus, 
  errorMessage?: string | null, 
  retryCount?: number, 
  emailId?: string | null
) {
  const updates: NotificationUpdatePayload = { 
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
export async function checkNotificationEnabled(
  supabase: MinimalSupabaseClient,
  userId: string,
  organizationId: string,
  notificationType: NotificationType
): Promise<boolean> {
  try {
    // Check user settings first
    const { data: userSettingsData } = await supabase
      .from('user_settings')
      .select('notification_global_enabled, notification_daily_summary_enabled, notification_new_assignment_enabled, notification_project_milestone_enabled')
      .eq('user_id', userId)
      .maybeSingle();
    const userSettings = userSettingsData as UserNotificationSettingsRow | null;

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
    const { data: orgSettingsData } = await supabase
      .from('organization_settings')
      .select('notification_global_enabled, notification_daily_summary_enabled, notification_new_assignment_enabled, notification_project_milestone_enabled')
      .eq('organization_id', organizationId)
      .maybeSingle();
    const orgSettings = orgSettingsData as OrganizationNotificationSettingsRow | null;

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
  } catch (error: unknown) {
    console.error('Error checking notification settings:', error);
    // Default to enabled on error to avoid blocking notifications
    return true;
  }
}

if (import.meta.main) {
  serve(handler);
}
