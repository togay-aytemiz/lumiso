import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { generateModernDailySummaryEmail } from './_templates/enhanced-daily-summary-modern.ts';
import { generateEmptyDailySummaryEmail } from './_templates/enhanced-daily-summary-empty.ts';
import { formatDate } from './_templates/enhanced-email-base.ts';
import { createEmailLocalization } from '../_shared/email-i18n.ts';
import {
  getErrorMessage,
  getErrorStack,
} from '../_shared/error-utils.ts';
import {
  createResendClient,
  type ResendClient,
} from '../_shared/resend-utils.ts';

type SupabaseClientFactory = typeof createClient;
type SupabaseServerClient = SupabaseClient;

let createSupabaseClient: SupabaseClientFactory = createClient;
const defaultResendClient: ResendClient = createResendClient(Deno.env.get("RESEND_API_KEY"));
let resendClient: ResendClient = defaultResendClient;

export function setSupabaseClientFactoryForTests(factory: SupabaseClientFactory) {
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessorRequest {
  action: 'process' | 'test';
  user_id?: string;
}

type UserSettingsRow = {
  user_id: string;
  notification_scheduled_time: string | null;
  notification_daily_summary_enabled: boolean;
  notification_global_enabled: boolean;
};

type LeadRelation = {
  id: string;
  name: string | null;
};

type ProjectRelation = {
  id: string;
  name: string | null;
  project_types?: { name: string | null } | null;
};

type SessionRecord = {
  id: string;
  session_date: string | null;
  session_time: string | null;
  notes: string | null;
  location: string | null;
  leads: LeadRelation | null;
  projects: ProjectRelation | null;
};

type ActivityRecord = {
  id: string;
  content: string | null;
  reminder_date: string | null;
  reminder_time: string | null;
  lead_id: string | null;
  project_id: string | null;
  completed?: boolean;
  type?: string | null;
  user_id?: string | null;
};

type ActivityWithNames = ActivityRecord & {
  leads: { name: string } | null;
  projects: { name: string } | null;
};

type ActivitySummary = {
  id: string;
  content: string | null;
  reminder_date: string | null;
  reminder_time: string | null;
  lead_id: string | null;
  project_id: string | null;
};

type OverdueItems = {
  leads: unknown[];
  activities: ActivitySummary[];
};

type SkippedReasons = {
  noOrganization: number;
  noProfile: number;
  noEmail: number;
  wrongTime: number;
  emailFailed: number;
};

export const handler = async (req: Request): Promise<Response> => {
  console.log('Simple daily notification processor started');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin: SupabaseServerClient = createSupabaseClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { action, user_id }: ProcessorRequest = await req.json().catch(() => ({ action: 'process' }));
    
    // Get current UTC time for processing
    const currentTime = new Date();
    console.log(`Processing at UTC: ${currentTime.toISOString()}`);
    
    // We'll handle timezone conversion per user/organization basis

    // Get users who need daily summaries - we'll check timezone per organization
    let usersQuery = supabaseAdmin
      .from('user_settings')
      .select(`
        user_id, 
        notification_scheduled_time, 
        notification_daily_summary_enabled,
        notification_global_enabled
      `)
      .eq('notification_global_enabled', true)
      .eq('notification_daily_summary_enabled', true);

    if (action === 'test' && user_id) {
      console.log(`Testing for specific user: ${user_id}`);
      usersQuery = usersQuery.eq('user_id', user_id);
    }
    // For scheduled processing, we'll check timezone conversion for each user

    const { data: users, error: usersError } = await usersQuery.returns<UserSettingsRow[]>();

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    console.log(`Found ${users?.length || 0} users to process`);

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `No users with daily summaries enabled`,
          processed: 0,
          timestamp: new Date().toISOString()
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let processed = 0;
    let errors = 0;
    const skippedReasons: SkippedReasons = {
      noOrganization: 0,
      noProfile: 0,
      noEmail: 0,
      wrongTime: 0,
      emailFailed: 0
    };

    for (const userSettings of users) {
      try {
        console.log(`Processing user ${userSettings.user_id} with scheduled time ${userSettings.notification_scheduled_time}`);
        
        // First, get the user's organization ID
        const { data: userOrg, error: orgError } = await supabaseAdmin
          .from('organizations')
          .select('id')
          .eq('owner_id', userSettings.user_id)
          .maybeSingle();

        const organizationId = userOrg?.id;

        if (!organizationId) {
          console.error(`No organization found for user ${userSettings.user_id}`);
          skippedReasons.noOrganization++;
          continue;
        }

        console.log(`Found organization ${organizationId} for user ${userSettings.user_id}`);
        
        // Skip if testing mode and no specific user ID
        if (action !== 'test') {
          // Get organization timezone to check if it's time for this user
          const { data: orgSettings } = await supabaseAdmin
            .from('organization_settings')
            .select('timezone')
            .eq('organization_id', organizationId)
            .maybeSingle();
          
          const orgTimezone = orgSettings?.timezone || 'UTC';
          
          // Convert current UTC time to organization timezone
          const orgTime = new Date().toLocaleString('en-US', { 
            timeZone: orgTimezone,
            hour12: false 
          });
          
          const orgDate = new Date(orgTime);
          const orgHour = String(orgDate.getHours()).padStart(2, '0');
          const orgMinute = String(orgDate.getMinutes()).padStart(2, '0');
          const orgTimeString = `${orgHour}:${orgMinute}`;
          
          console.log(`Organization timezone: ${orgTimezone}, Local time: ${orgTimeString}, Scheduled: ${userSettings.notification_scheduled_time}`);
          
          // Skip if it's not time for this user in their timezone
          if (orgTimeString !== userSettings.notification_scheduled_time) {
            console.log(`Skipping user ${userSettings.user_id} - not their scheduled time (${orgTimeString} vs ${userSettings.notification_scheduled_time})`);
            skippedReasons.wrongTime++;
            continue;
          }
        }
        
        // Get user profile for full name
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('user_id', userSettings.user_id)
          .single();

        if (profileError) {
          console.error(`Error fetching profile for user ${userSettings.user_id}:`, profileError);
          skippedReasons.noProfile++;
          continue;
        }

        // Get user email from auth.users
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userSettings.user_id);
        
        if (userError || !user?.email) {
          console.error(`Error fetching user email for ${userSettings.user_id}:`, userError);
          skippedReasons.noEmail++;
          continue;
        }

        console.log(`Processing email for ${user.email} (Organization: ${organizationId})`);

        // Extract user's full name
        const userFullName = profile?.full_name || 
                             user.user_metadata?.full_name || 
                             user.email?.split('@')[0] || 'there';
        console.log(`User full name: ${userFullName}`);

        const { data: languagePreference } = await supabaseAdmin
          .from('user_language_preferences')
          .select('language_code')
          .eq('user_id', userSettings.user_id)
          .maybeSingle();

        const localization = createEmailLocalization(languagePreference?.language_code);
        const t = localization.t;

        // Get today's date
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        console.log(`Today's date: ${todayStr}`);

        // Get today's sessions with comprehensive data
    const { data: todaySessions, error: todaySessionsError } = await supabaseAdmin
          .from('sessions')
          .select(`
            id,
            session_date,
            session_time,
            notes,
            location,
            leads(id, name),
            projects(id, name, project_types(name))
          `)
          .eq('session_date', todayStr)
          .eq('organization_id', organizationId)
          .order('session_time')
          .returns<SessionRecord[]>();

    // Get past sessions that need action
    const { data: pastSessions, error: pastSessionsError } = await supabaseAdmin
          .from('sessions')
          .select(`
            id,
            session_date,
            session_time,
            notes,
            location,
            leads(id, name),
            projects(id, name, project_types(name))
          `)
          .lt('session_date', todayStr)
          .eq('organization_id', organizationId)
          .order('session_date', { ascending: false })
          .limit(10)
          .returns<SessionRecord[]>(); // Limit past sessions

    // Get overdue activities
    const { data: overdueActivities, error: overdueError } = await supabaseAdmin
          .from('activities')
          .select(`
            id,
            content,
            reminder_date,
            reminder_time,
            completed,
            lead_id,
            project_id
          `)
          .lt('reminder_date::date', todayStr)
          .eq('completed', false)
          .eq('organization_id', organizationId)
          .order('reminder_date', { ascending: false })
          .returns<ActivityRecord[]>();

        // Get today's activities/reminders
        console.log(`Searching for today's reminders on date: ${todayStr}`);
        
    const { data: todayActivities, error: todayActivitiesError } = await supabaseAdmin
          .from('activities')
          .select(`
            id,
            user_id,
            content,
            reminder_date,
            reminder_time,
            type,
            completed,
            lead_id,
            project_id
          `)
          .eq('organization_id', organizationId)
          .eq('completed', false)
          .gte('reminder_date', `${todayStr}T00:00:00`)
          .lte('reminder_date', `${todayStr}T23:59:59`)
          .order('reminder_time')
          .returns<ActivityRecord[]>();

        console.log(`Found ${todayActivities?.length || 0} today's activities:`, todayActivities);

        // Fetch lead and project names for today's activities
        const todayActivitiesWithNames: ActivityWithNames[] = [];
        if (todayActivities && todayActivities.length > 0) {
          for (const activity of todayActivities) {
            let leadName = null;
            let projectName = null;

            // Fetch lead name if lead_id exists
            if (activity.lead_id) {
              const { data: lead } = await supabaseAdmin
                .from('leads')
                .select('name')
                .eq('id', activity.lead_id)
                .maybeSingle<{ name: string | null }>();
              leadName = lead?.name || null;
            }

            // Fetch project name if project_id exists
            if (activity.project_id) {
              const { data: project } = await supabaseAdmin
                .from('projects')
                .select('name')
                .eq('id', activity.project_id)
                .maybeSingle<{ name: string | null }>();
              projectName = project?.name || null;
            }

            todayActivitiesWithNames.push({
              ...activity,
              leads: leadName ? { name: leadName } : null,
              projects: projectName ? { name: projectName } : null
            });
          }
        }

        console.log('Today activities with names:', todayActivitiesWithNames);

        // Get organization settings for branding and timezone
        const { data: orgSettings } = await supabaseAdmin
          .from('organization_settings')
          .select('photography_business_name, primary_brand_color, date_format, time_format, timezone')
          .eq('organization_id', organizationId)
          .maybeSingle();

        // Use Lumiso logo
        console.log('Using Lumiso logo from: https://my.lumiso.app/lumiso-logo.png');

        console.log('Data fetched:', {
          todaySessions: todaySessions?.length || 0,
          pastSessions: pastSessions?.length || 0,
          overdueActivities: overdueActivities?.length || 0,
          todayActivities: todayActivities?.length || 0,
          pendingTodos: 0
        });

        console.log('Today activities data:', todayActivities);
        console.log('Past sessions data:', pastSessions);

        // Prepare data for enhanced email template with timezone support
        const templateData = {
          userFullName,
          businessName: orgSettings?.photography_business_name || 'Lumiso',
          brandColor: orgSettings?.primary_brand_color || '#1EB29F',
          dateFormat: orgSettings?.date_format || 'DD/MM/YYYY',
          timeFormat: orgSettings?.time_format || '12-hour',
          timezone: orgSettings?.timezone || 'UTC',
          baseUrl: 'https://my.lumiso.app',
          language: localization.language,
          localization,
        };

        // Transform sessions data
        const sessions: SessionRecord[] = (todaySessions ?? []).map((session) => ({
          id: session.id,
          session_date: session.session_date,
          session_time: session.session_time,
          notes: session.notes,
          location: session.location,
          leads: session.leads,
          projects: session.projects
        }));

        // Transform past sessions that need action
        const pastSessionsNeedingAction: SessionRecord[] = (pastSessions ?? []).map((session) => ({
          id: session.id,
          session_date: session.session_date,
          session_time: session.session_time,
          notes: session.notes,
          location: session.location,
          leads: session.leads,
          projects: session.projects
        }));

        // Transform today's activities separately from overdue
        const todayReminders: ActivityWithNames[] = (todayActivitiesWithNames ?? []).map((activity) => ({
          id: activity.id,
          content: activity.content,
          reminder_date: activity.reminder_date,
          reminder_time: activity.reminder_time,
          lead_id: activity.lead_id,
          project_id: activity.project_id,
          leads: activity.leads,
          projects: activity.projects
        }));

        // Transform overdue data (only overdue activities, not today's)
        const overdueItems: OverdueItems = {
          leads: [], // No overdue leads for now, focus on activities
          activities: (overdueActivities ?? []).map((activity) => ({
            id: activity.id,
            content: activity.content,
            reminder_date: activity.reminder_date,
            reminder_time: activity.reminder_time,
            lead_id: activity.lead_id,
            project_id: activity.project_id
          }))
        };

        // Generate enhanced email content using the same templates as test system
        let emailHtml: string;
        let emailSubject: string;
        const formattedSubjectDate = formatDate(
          today.toISOString(),
          templateData.dateFormat,
          templateData.timezone,
        );

        if (sessions.length === 0 && todayReminders.length === 0) {
          // Use empty template when no sessions or reminders
          emailHtml = generateEmptyDailySummaryEmail(
            overdueItems,
            pastSessionsNeedingAction,
            templateData
          );
          emailSubject = t('dailySummary.subject.brandedEmpty', {
            date: formattedSubjectDate,
          });
        } else {
          // Use regular daily summary template
          emailHtml = generateModernDailySummaryEmail(
            sessions,
            todayReminders,
            overdueItems,
            pastSessionsNeedingAction,
            templateData
          );
          emailSubject = t('dailySummary.subject.brandedWithData', {
            date: formattedSubjectDate,
          });
        }

        // Send email using Resend with EXACT same sender and subject as test system
        console.log(`Sending daily summary to ${user.email}`);
        
        const emailResult = await resendClient.emails.send({
          from: 'Lumiso <hello@updates.lumiso.app>', // Same sender as test system
          to: [user.email],
          subject: emailSubject, // Same subject format as test system
          html: emailHtml,
        });

        if (emailResult.error) {
          console.error(`Resend error for ${user.email}:`, emailResult.error);
          errors++;
          skippedReasons.emailFailed++;
        } else {
          console.log(`✅ Daily summary sent successfully to ${user.email} (Email ID: ${emailResult.data?.id})`);
          processed++;
        }

      } catch (error) {
        console.error(`❌ Error processing user ${userSettings.user_id}:`, error);
        errors++;
      }
    }

    const totalProcessed = processed + errors + Object.values(skippedReasons).reduce((a, b) => a + b, 0);
    console.log(`\n📊 Processing Summary:
      - Total users checked: ${users.length}
      - Successfully sent: ${processed}
      - Failed to send: ${errors}
      - Skipped (no org): ${skippedReasons.noOrganization}
      - Skipped (no profile): ${skippedReasons.noProfile}
      - Skipped (no email): ${skippedReasons.noEmail}
      - Skipped (wrong time): ${skippedReasons.wrongTime}
      - Skipped (email failed): ${skippedReasons.emailFailed}
    `);

    return new Response(
      JSON.stringify({ 
        success: true,
        processed,
        errors,
        skipped: skippedReasons,
        totalChecked: users.length,
        timestamp: new Date().toISOString(),
        message: `Processed ${processed} daily summaries${errors > 0 ? `, ${errors} failed` : ''}${Object.values(skippedReasons).reduce((a, b) => a + b, 0) > 0 ? `, ${Object.values(skippedReasons).reduce((a, b) => a + b, 0)} skipped` : ''}`
      }),
      { 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: unknown) {
    console.error('Error in simple daily notification processor:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: getErrorMessage(error),
        details: getErrorStack(error)
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
};

serve(handler);
