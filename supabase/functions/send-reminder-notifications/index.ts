import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type User, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { generateModernDailySummaryEmail } from './_templates/enhanced-daily-summary-modern.ts';
import { generateEmptyDailySummaryEmail } from './_templates/enhanced-daily-summary-empty.ts';
import { formatDate, type Session } from './_templates/enhanced-email-base.ts';
import { 
  generateImmediateNotificationEmail, 
  generateSubject,
  type ProjectAssignmentData,
  type LeadAssignmentData,
  type ProjectMilestoneData,
  type ImmediateNotificationEmailData
} from './_templates/immediate-notifications.ts';
import { createEmailLocalization } from '../_shared/email-i18n.ts';
import { getErrorMessage } from '../_shared/error-utils.ts';
import {
  createResendClient,
  type ResendClient,
} from '../_shared/resend-utils.ts';
import { getMessagingGuard } from "../_shared/messaging-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeFirst<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : undefined;
  }
  return value ?? undefined;
}

function normalizeSessionProject(
  project: Session['projects'],
): Session['projects'] | undefined {
  const resolvedProject = normalizeFirst(project);
  if (!resolvedProject) {
    return undefined;
  }

  const normalizedProjectTypes = normalizeFirst(resolvedProject.project_types);

  return {
    ...resolvedProject,
    project_types: normalizedProjectTypes,
  };
}

function normalizeSessionLead(
  lead: Session['leads'],
): Session['leads'] | undefined {
  return normalizeFirst(lead);
}

const defaultResendClient = createResendClient(Deno.env.get("RESEND_API_KEY"));
let resend: ResendClient = defaultResendClient;

export type { ResendClient } from '../_shared/resend-utils.ts';

export function setResendClient(client: ResendClient) {
  resend = client;
}

export function getResendClient(): ResendClient {
  return resend;
}

interface ReminderRequest {
  type: string;
  isTest?: boolean;
  organizationId?: string; // For batch processing
  userId?: string; // For batch processing
  // Project milestone specific fields
  project_id?: string;
  old_status?: string;
  new_status?: string;
  milestone_user_id?: string;
  milestone_user_name?: string;
  // Assignment notification specific fields
  entity_type?: string;
  entity_id?: string;
  assignee_id?: string;
  assignee_email?: string;
  assignee_name?: string;
  assigner_name?: string;
  assigner_id?: string;
  assignee_language?: string;
}

type AssignmentNotificationRequest = {
  entity_type: "lead" | "project";
  entity_id: string;
  assignee_id?: string | null;
  assignee_email?: string | null;
  assignee_name?: string | null;
  assigner_name?: string | null;
  assigner_id?: string | null;
  organizationId: string;
  assignee_language?: string;
  isTest?: boolean;
};

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Create admin client once at the beginning
  const adminSupabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const requestData: ReminderRequest = await req.json();
    console.log(`Processing ${requestData.type}, test mode: ${requestData.isTest || false}`);
    console.log('Available types: daily-summary, daily-summary-empty, project-milestone, new-assignment');

    // Handle project-milestone notifications
    if (requestData.type === 'project-milestone') {
      return await handleProjectMilestoneNotification(requestData, adminSupabase);
    }

    // Handle assignment notifications
    if (requestData.type === 'new-assignment') {
      if (requestData.entity_type !== 'lead' && requestData.entity_type !== 'project') {
        return new Response(JSON.stringify({ error: 'entity_type must be "lead" or "project"' }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (!requestData.entity_id || !requestData.organizationId) {
        return new Response(JSON.stringify({ error: 'entity_id and organizationId are required for assignment notifications' }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const assignmentRequest: AssignmentNotificationRequest = {
        entity_type: requestData.entity_type,
        entity_id: requestData.entity_id,
        assignee_id: requestData.assignee_id ?? null,
        assignee_email: requestData.assignee_email ?? null,
        assignee_name: requestData.assignee_name ?? null,
        assigner_name: requestData.assigner_name ?? null,
        assigner_id: requestData.assigner_id ?? null,
        organizationId: requestData.organizationId,
        assignee_language: requestData.assignee_language,
        isTest: requestData.isTest,
      };

      return await handleAssignmentNotification(assignmentRequest, adminSupabase);
    }

    // Handle daily-summary and daily-summary-empty notifications
    if (!['daily-summary', 'daily-summary-empty'].includes(requestData.type)) {
      console.log(`Unsupported type received: ${requestData.type}`);
      return new Response(JSON.stringify({ message: 'Only daily-summary, daily-summary-empty, project-milestone, and new-assignment supported' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Proceeding with type: ${requestData.type}`);
    const { type, isTest = false, organizationId: batchOrgId, userId: batchUserId } = requestData;

    let user: User;
    let organizationId: string;
    let userEmail: string;

    // Check if this is batch processing mode (called from process-scheduled-notifications)
    if (batchOrgId && batchUserId) {
      console.log('Batch processing mode - using provided org and user IDs');
      
      // Get user data directly using admin client
      const { data: userData, error: userError } = await adminSupabase.auth.admin.getUserById(batchUserId);
      if (userError || !userData.user) {
        throw new Error(`Failed to get batch user: ${userError?.message || 'User not found'}`);
      }
      user = userData.user;
      if (!user.email) {
        throw new Error('User email is required for assignment notifications');
      }
      userEmail = user.email;
      organizationId = batchOrgId;
      
    } else {
      // Regular auth mode - get authenticated user
      const authHeader = req.headers.get('authorization');
      console.log('Auth header present:', !!authHeader);
      
      if (!authHeader) {
        throw new Error('Authorization header required');
      }

      // Extract token and get user directly with admin client
      const token = authHeader.replace('Bearer ', '');
      console.log('Token length:', token.length);
      
      const { data: { user: authUser }, error: userError } = await adminSupabase.auth.getUser(token);
      console.log('User auth result:', { user: !!authUser, error: userError?.message });
      
      if (userError || !authUser) {
        console.error('Auth error details:', userError);
        throw new Error(`Failed to get authenticated user: ${userError?.message || 'Unknown error'}`);
      }

      user = authUser;
      if (!user.email) {
        throw new Error('User email is required for assignment notifications');
      }
      userEmail = user.email;

      // Get user's active organization
      const { data: userSettings } = await adminSupabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      organizationId = userSettings?.active_organization_id;

      if (!organizationId) {
        const { data: activeMembership } = await adminSupabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('joined_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        organizationId = activeMembership?.organization_id ?? organizationId;
      }

      if (!organizationId) {
        const { data: ownedOrganization } = await adminSupabase
          .from('organizations')
          .select('id')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        organizationId = ownedOrganization?.id ?? organizationId;
      }

      if (!organizationId) {
        throw new Error('No active organization found for user');
      }
    }

    console.log(`Authenticated user: ${userEmail}`);
    console.log('Organization ID:', organizationId);

    const guard = await getMessagingGuard(adminSupabase, organizationId);
    if (guard?.hardBlocked) {
      console.log(`Messaging blocked for org ${organizationId}, skipping ${requestData.type}`);
      return new Response(
        JSON.stringify({ skipped: true, reason: guard.reason ?? 'Messaging blocked' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile for display name
    const { data: userProfile } = await adminSupabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle();

    // Extract user's full name - only use full_name since first_name/last_name don't exist
    const userFullName = userProfile?.full_name || 
                         user.user_metadata?.full_name || 
                         userEmail.split('@')[0] || 'there';
    console.log(`User full name: ${userFullName}`);

    const { data: languagePreference } = await adminSupabase
      .from('user_language_preferences')
      .select('language_code')
      .eq('user_id', user.id)
      .maybeSingle();

    const localization = createEmailLocalization(languagePreference?.language_code ?? undefined);
    const t = localization.t;

    const { data: orgSettings } = await adminSupabase
      .from('organization_settings')
      .select('photography_business_name, primary_brand_color, date_format, time_format, timezone')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (isTest) {
      if (type === 'daily-summary' || type === 'daily-summary-empty') {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const sampleDaily =
          (localization.raw('samples.dailySummary') as Record<string, string>) ||
          {};

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

        const sampleSessions =
          type === 'daily-summary'
            ? [
                {
                  id: 'sample-session',
                  session_date: todayStr,
                  session_time: '09:30',
                  notes:
                    sampleDaily.sessionNotes ||
                    'Prepare warm-toned presets before the shoot.',
                  location:
                    sampleDaily.sessionLocation || 'Downtown studio',
                  leads: { name: sampleDaily.clientName || 'Emily Carter' },
                  projects: {
                    name: sampleDaily.projectName || 'Sunset Wedding',
                    project_types: {
                      name: sampleDaily.projectType || 'Wedding',
                    },
                  },
                },
              ]
            : [];

        const sampleReminders =
          type === 'daily-summary'
            ? [
                {
                  id: 'sample-reminder',
                  content:
                    sampleDaily.reminderContent ||
                    'Send the mood board to the couple.',
                  reminder_date: todayStr,
                  reminder_time: '13:00',
                  leads: { name: sampleDaily.clientName || 'Emily Carter' },
                  projects: {
                    name: sampleDaily.projectName || 'Sunset Wedding',
                  },
                },
              ]
            : [];

        const sampleOverdueActivities = sampleDaily.overdueContent
          ? [
              {
                id: 'sample-overdue',
                content: sampleDaily.overdueContent,
                reminder_date: todayStr,
                reminder_time: '10:00',
                lead_id: null,
                project_id: null,
                leads: {
                  name:
                    sampleDaily.pastSessionClientName ||
                    sampleDaily.clientName ||
                    'Rivera Family',
                },
                projects: {
                  name:
                    sampleDaily.pastSessionProjectName ||
                    sampleDaily.projectName ||
                    'Rivera Family Session',
                },
              },
            ]
          : [];

        const samplePastSessions = sampleDaily.pastSessionProjectName
          ? [
              {
                id: 'sample-past-session',
                session_date: todayStr,
                session_time: '11:00',
                notes: '',
                location:
                  sampleDaily.sessionLocation || 'Downtown studio',
                leads: {
                  name:
                    sampleDaily.pastSessionClientName ||
                    'Rivera Family',
                },
                projects: {
                  name:
                    sampleDaily.pastSessionProjectName ||
                    'Rivera Family Session',
                  project_types: {
                    name: sampleDaily.projectType || 'Wedding',
                  },
                },
              },
            ]
          : [];

        const formattedSubjectDate = formatDate(
          today.toISOString(),
          templateData.dateFormat,
          templateData.timezone,
        );

        const emailHtml =
          type === 'daily-summary-empty'
            ? generateEmptyDailySummaryEmail(
                { leads: [], activities: sampleOverdueActivities },
                samplePastSessions,
                templateData,
              )
            : generateModernDailySummaryEmail(
                sampleSessions,
                sampleReminders,
                { leads: [], activities: sampleOverdueActivities },
                samplePastSessions,
                templateData,
              );

        const subjectKey =
          type === 'daily-summary-empty'
            ? 'dailySummary.subject.brandedEmpty'
            : 'dailySummary.subject.brandedWithData';

        const emailSubject = t(subjectKey, {
          date: formattedSubjectDate,
        });

        const emailResponse = await resend.emails.send({
          from: 'Lumiso <hello@updates.lumiso.app>',
          to: [userEmail],
          subject: emailSubject,
          html: emailHtml,
        });

        if (emailResponse.error) {
          throw new Error(emailResponse.error.message);
        }

        return new Response(
          JSON.stringify({
            message: 'Test daily summary email sent',
            type,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          },
        );
      }

      if (type === 'project-milestone') {
        const sampleImmediate =
          (localization.raw('samples.immediate') as Record<string, string>) ||
          {};

        const notificationData: ProjectMilestoneData = {
          type: 'project-milestone',
          organizationId,
          triggeredByUser: {
            name: sampleImmediate.triggeredByName || userFullName,
            id: 'sample-user',
          },
          project: {
            id: 'sample-project',
            name: sampleImmediate.projectName || 'Spring Garden Wedding',
            type: sampleImmediate.projectType || 'Wedding',
            oldStatus: sampleImmediate.oldStatus || 'Editing',
            newStatus:
              sampleImmediate.newStatusCompleted || 'Completed',
            lifecycle: 'completed',
            notes:
              sampleImmediate.projectNotes ||
              'Plan golden hour portraits on the venue terrace.',
            leadName: sampleImmediate.leadName || 'Elif Kaya',
          },
          assignee: {
            name: userFullName,
            email: userEmail,
          },
        };

        const emailData: ImmediateNotificationEmailData = {
          user: {
            fullName: userFullName,
            email: userEmail,
          },
          business: {
            businessName: orgSettings?.photography_business_name || 'Lumiso',
            brandColor: orgSettings?.primary_brand_color || '#1EB29F',
          },
          notificationData,
          language: localization.language,
          localization,
          baseUrl: 'https://my.lumiso.app',
        };

        const emailHtml = generateImmediateNotificationEmail(emailData);
        const emailSubject = generateSubject(notificationData, t);

        const emailResponse = await resend.emails.send({
          from: 'Lumiso <hello@updates.lumiso.app>',
          to: [userEmail],
          subject: emailSubject,
          html: emailHtml,
        });

        if (emailResponse.error) {
          throw new Error(emailResponse.error.message);
        }

        return new Response(
          JSON.stringify({
            message: 'Test project milestone email sent',
            type,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          },
        );
      }
    }

    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    console.log(`Today's date: ${todayStr}`);

    // Get today's sessions
    const { data: todaySessions, error: todaySessionsError } = await adminSupabase
      .from('sessions')
      .select(`
        id,
        session_date,
        session_time,
        session_type_id,
        session_types:session_type_id (
          id,
          name,
          duration_minutes
        ),
        notes,
        location,
        leads(id, name),
        projects(id, name, project_types(name))
      `)
      .eq('session_date', todayStr)
      .eq('organization_id', organizationId)
      .order('session_time');

    // Get past sessions that need action (simplified - just count them)
    const { data: pastSessions, error: pastSessionsError } = await adminSupabase
      .from('sessions')
      .select(`
        id,
        session_date,
        session_time,
        session_type_id,
        session_types:session_type_id (
          id,
          name,
          duration_minutes
        ),
        notes,
        location,
        leads(id, name),
        projects(id, name, project_types(name))
      `)
      .lt('session_date', todayStr)
      .eq('organization_id', organizationId)
      .order('session_date', { ascending: false });

    if (todaySessionsError) {
      console.error('Error fetching today sessions:', todaySessionsError);
    }
    if (pastSessionsError) {
      console.error('Error fetching past sessions:', pastSessionsError);
    }

    // Get overdue reminders/activities (using date comparison)
    const { data: overdueActivities, error: overdueError } = await adminSupabase
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
      .order('reminder_date', { ascending: false });

    if (overdueError) {
      console.error('Error fetching overdue activities:', overdueError);
    }

    // Get today's reminders/activities - simplified query that MUST work
    console.log(`Searching for today's reminders on date: ${todayStr}`);
    
    const { data: todayActivities, error: todayActivitiesError } = await adminSupabase
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
      .order('reminder_time');

    console.log(`Found ${todayActivities?.length || 0} today's activities:`, todayActivities);

    if (todayActivitiesError) {
      console.error('Error fetching today activities:', todayActivitiesError);
    }

    // Fetch lead and project names for today's activities
    const todayActivitiesWithNames = [];
    if (todayActivities && todayActivities.length > 0) {
      for (const activity of todayActivities) {
        let leadName = null;
        let projectName = null;

        // Fetch lead name if lead_id exists
        if (activity.lead_id) {
          const { data: lead } = await adminSupabase
            .from('leads')
            .select('name')
            .eq('id', activity.lead_id)
            .maybeSingle();
          leadName = lead?.name || null;
        }

        // Fetch project name if project_id exists
        if (activity.project_id) {
          const { data: project } = await adminSupabase
            .from('projects')
            .select('name')
            .eq('id', activity.project_id)
            .maybeSingle();
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

    // Get pending todos - use admin client since todos are user-specific
    const { data: pendingTodos, error: todosError } = await adminSupabase
      .from('todos')
      .select(`
        id,
        content,
        created_at,
        projects(id, name, leads(id, name))
      `)
      .eq('is_completed', false)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (todosError) {
      console.error('Error fetching todos:', todosError);
    }

    console.log('Data fetched:', {
      todaySessions: todaySessions?.length || 0,
      pastSessions: pastSessions?.length || 0,
      overdueActivities: overdueActivities?.length || 0,
      todayActivities: todayActivities?.length || 0,
      pendingTodos: pendingTodos?.length || 0
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
    const sessions = (todaySessions || []).map((session) => {
      const lead = normalizeSessionLead(session.leads);
      const project = normalizeSessionProject(session.projects);

      return {
        id: session.id,
        session_date: session.session_date,
        session_time: session.session_time,
        notes: session.notes,
        location: session.location,
        leads: lead,
        projects: project,
      };
    });

    // Transform past sessions that need action
    const pastSessionsNeedingAction = (pastSessions || []).map((session) => {
      const lead = normalizeSessionLead(session.leads);
      const project = normalizeSessionProject(session.projects);

      return {
        id: session.id,
        session_date: session.session_date,
        session_time: session.session_time,
        notes: session.notes,
        location: session.location,
        leads: lead,
        projects: project,
      };
    });

    // Transform todos data
    const todos = (pendingTodos || []).map(todo => ({
      id: todo.id,
      content: todo.content,
      created_at: todo.created_at,
      projects: todo.projects
    }));

    // Transform today's activities separately from overdue
    const todayReminders = (todayActivitiesWithNames || []).map(activity => ({
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
    const overdueItems = {
      leads: [], // No overdue leads for now, focus on activities
      activities: (overdueActivities || []).map(activity => ({
        id: activity.id,
        content: activity.content,
        reminder_date: activity.reminder_date,
        reminder_time: activity.reminder_time,
        lead_id: activity.lead_id,
        project_id: activity.project_id
      }))
    };

    // Generate enhanced email content using the appropriate template
    let emailHtml: string;
    let emailSubject: string;
    const formattedSubjectDate = formatDate(
      today.toISOString(),
      templateData.dateFormat,
      templateData.timezone,
    );

    if (type === 'daily-summary-empty') {
      // Force empty state for testing
      emailHtml = generateEmptyDailySummaryEmail(
        overdueItems,
        pastSessionsNeedingAction,
        templateData
      );
      emailSubject = t('dailySummary.subject.brandedEmpty', {
        date: formattedSubjectDate,
      });
    } else if (sessions.length === 0 && todayReminders.length === 0) {
      // Automatically use empty template when no sessions or reminders
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

    // Send email using Resend
    const emailResult = await resend.emails.send({
      from: 'Lumiso <hello@updates.lumiso.app>',
      to: [userEmail],
      subject: emailSubject,
      html: emailHtml
    });

    console.log('Email sent successfully:', emailResult);

    return new Response(JSON.stringify({
      message: `Daily summary sent to ${userEmail}`,
      successful: 1,
      failed: 0,
      total: 1,
      organizationId,
      dataCount: {
        sessions: sessions.length,
        pastSessions: pastSessionsNeedingAction.length,
        todos: todos.length,
        overdueActivities: overdueItems.activities.length
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      error: getErrorMessage(error),
      successful: 0,
      failed: 1,
      total: 1
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

// Handler for assignment notifications (lead or project assignments)
export async function handleAssignmentNotification(
  requestData: AssignmentNotificationRequest,
  adminSupabase: SupabaseClient
): Promise<Response> {
  console.log('Handling assignment notification:', requestData);
  
  try {
    const { 
      entity_type, 
      entity_id, 
      assignee_id, 
      assignee_email, 
      assignee_name,
      assigner_name,
      organizationId 
    } = requestData;

    // Initialize variables for entity details
    let entityName = '';
    let notes = '';
    let status = '';
    let leadName = '';
    let projectType = '';

    // Fetch entity details based on type
    if (entity_type === 'lead') {
      console.log('Fetching lead details for ID:', entity_id);
      
      const { data: lead, error: leadError } = await adminSupabase
        .from('leads')
        .select('name, notes, status')
        .eq('id', entity_id)
        .maybeSingle();
      
      if (leadError) {
        console.error('Error fetching lead:', leadError);
      }
      
      if (lead) {
        entityName = lead.name;
        notes = lead.notes;
        status = lead.status;
      }
    } else if (entity_type === 'project') {
        console.log('Fetching project details for ID:', entity_id);
        
        // First get the project details with lead information
        const { data: project, error: projectError } = await adminSupabase
          .from('projects')
          .select(`
            name,
            description,
            project_type_id,
            status_id,
            lead_id,
            leads!projects_lead_id_fkey(name)
          `)
          .eq('id', entity_id)
          .maybeSingle();
        
        if (projectError) {
          console.error('Error fetching project:', projectError);
        }
        
        console.log('Project query result:', project);
        
        if (project) {
          console.log('Found project:', project.name);
          entityName = project.name || `Unnamed Project`;
          notes = project.description;
          const projectLead = normalizeFirst(project.leads);
          leadName = projectLead?.name;
          
          console.log('Project details - Name:', entityName, 'Lead:', leadName);
          
          // Get project type name if available
          if (project.project_type_id) {
            const { data: projectTypeData } = await adminSupabase
              .from('project_types')
              .select('name')
              .eq('id', project.project_type_id)
              .maybeSingle();
            
            if (projectTypeData) {
              projectType = projectTypeData.name;
              console.log('Project type:', projectType);
            }
          }
          
          // Get project status name if available
          if (project.status_id) {
            const { data: statusData } = await adminSupabase
              .from('project_statuses')
              .select('name')
              .eq('id', project.status_id)
              .maybeSingle();
            
            if (statusData) {
              status = statusData.name;
              console.log('Project status:', status);
            }
          }
        } else {
          console.log('No project found for ID:', entity_id);
          // Try to get just the basic project info without joins
          const { data: basicProject } = await adminSupabase
            .from('projects')
            .select('name, description, lead_id')
            .eq('id', entity_id)
            .maybeSingle();
          
          if (basicProject) {
            console.log('Found basic project:', basicProject);
            entityName = basicProject.name || `Unnamed Project`;
            notes = basicProject.description;
            
            // Fetch lead name separately if lead_id exists
            if (basicProject.lead_id) {
              const { data: leadData } = await adminSupabase
                .from('leads')
                .select('name')
                .eq('id', basicProject.lead_id)
                .maybeSingle();
              
              if (leadData) {
                leadName = leadData.name;
                console.log('Lead name fetched separately:', leadName);
              }
            }
          } else {
            console.error('Project not found with ID:', entity_id);
            entityName = `Project ${entity_id}`;
          }
        }
    }

    // Get organization settings for branding AND notification preferences
    const { data: orgSettings } = await adminSupabase
      .from('organization_settings')
      .select('photography_business_name, primary_brand_color, notification_new_assignment_enabled, notification_global_enabled')
      .eq('organization_id', organizationId)
      .maybeSingle();

    // Get user-level notification settings (takes precedence over org settings)
    const { data: userSettings } = await adminSupabase
      .from('user_settings')
      .select('notification_new_assignment_enabled, notification_global_enabled')
      .eq('user_id', assignee_id)
      .maybeSingle();

    // Check if assignment notifications are disabled - user settings override org settings
    const globalEnabled = (userSettings?.notification_global_enabled ?? orgSettings?.notification_global_enabled) ?? true;
    const assignmentEnabled = (userSettings?.notification_new_assignment_enabled ?? orgSettings?.notification_new_assignment_enabled) ?? true;

    if (!globalEnabled || !assignmentEnabled) {
      console.log('Assignment notifications are disabled - Global:', globalEnabled, 'Assignment:', assignmentEnabled);
      
      // Still update the notification to processed status to avoid retries
      if (assignee_id) {
        await adminSupabase
          .from('notifications')
          .update({ status: 'skipped', updated_at: new Date().toISOString() })
          .eq('user_id', assignee_id)
          .eq('notification_type', 'new-assignment')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1);
      }

      return new Response(JSON.stringify({
        message: `Assignment notification skipped - notifications disabled`,
        successful: 0,
        failed: 0,
        total: 1,
        skipped: 1,
        reason: globalEnabled ? 'Assignment notifications disabled' : 'All notifications disabled'
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log('Assignment notifications are enabled - proceeding with email send');

    // Prepare unified notification data
    let notificationData: ProjectAssignmentData | LeadAssignmentData;
    
    if (entity_type === 'project') {
      notificationData = {
        type: 'project-assignment' as const,
        organizationId: organizationId || '',
        triggeredByUser: {
          name: assigner_name || 'System',
          id: requestData.assigner_id || ''
        },
        project: {
          id: entity_id || '',
          name: entityName || 'Unnamed Project',
          type: projectType || undefined,
          status: status || undefined,
          notes: notes || undefined,
          leadName: leadName || undefined
        },
        assignee: {
          name: assignee_name || 'there',
          email: assignee_email || ''
        }
      };
    } else {
      notificationData = {
        type: 'lead-assignment' as const,
        organizationId: organizationId || '',
        triggeredByUser: {
          name: assigner_name || 'System',
          id: requestData.assigner_id || ''
        },
        lead: {
          id: entity_id || '',
          name: entityName || `Lead ${entity_id}`,
          status: status || undefined,
          notes: notes || undefined
        },
        assignee: {
          name: assignee_name || 'there',
          email: assignee_email || ''
        }
      };
    }

    const { data: assigneeLanguage } = assignee_id
      ? await adminSupabase
          .from('user_language_preferences')
          .select('language_code')
          .eq('user_id', assignee_id)
          .maybeSingle()
      : { data: null } as const;

    const localization = createEmailLocalization(assigneeLanguage?.language_code);
    const t = localization.t;

    // Prepare template data
    const templateData: ImmediateNotificationEmailData = {
      user: {
        fullName: assignee_name || 'there',
        email: assignee_email || ''
      },
      business: {
        businessName: orgSettings?.photography_business_name || 'Lumiso',
        brandColor: orgSettings?.primary_brand_color || '#1EB29F'
      },
      notificationData,
      language: localization.language,
      localization,
      baseUrl: 'https://my.lumiso.app'
    };

    // Generate email HTML and subject
    const emailHtml = generateImmediateNotificationEmail(templateData);
    const emailSubject = generateSubject(notificationData, t);

    // Send email using Resend
    const emailResult = await resend.emails.send({
      from: 'Lumiso <hello@updates.lumiso.app>',
      to: [assignee_email || ''],
      subject: emailSubject,
      html: emailHtml
    });

    console.log('Assignment notification sent successfully:', emailResult);

    // Update notification status to sent
    if (assignee_id) {
      await adminSupabase
        .from('notifications')
        .update({ 
          status: 'sent', 
          updated_at: new Date().toISOString(),
          email_id: emailResult.data?.id || null
        })
        .eq('user_id', assignee_id)
        .eq('notification_type', 'new-assignment')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
    }

    return new Response(JSON.stringify({
      message: `Assignment notification sent to ${assignee_email}`,
      successful: 1,
      failed: 0,
      total: 1,
      entityType: entity_type,
      entityName,
      assigneeEmail: assignee_email
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: unknown) {
    console.error('Error in assignment notification:', error);
    
    // Log error in notifications table if possible
    if (requestData.assignee_id && requestData.organizationId) {
      try {
        await adminSupabase
          .from('notifications')
          .update({ 
            status: 'failed', 
            error_message: getErrorMessage(error),
            updated_at: new Date().toISOString(),
            retry_count: 1
          })
          .eq('user_id', requestData.assignee_id)
          .eq('notification_type', 'new-assignment')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1);
      } catch (logError) {
        console.error('Failed to update error log:', logError);
      }
    }

    return new Response(JSON.stringify({
      error: getErrorMessage(error),
      successful: 0,
      failed: 1,
      total: 1
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

// Handler for project milestone notifications
export async function handleProjectMilestoneNotification(
  requestData: ReminderRequest,
  adminSupabase: SupabaseClient
): Promise<Response> {
  console.log('Handling project milestone notification:', requestData);
  
  try {
    const { 
      project_id,
      old_status,
      new_status,
      milestone_user_id,
      milestone_user_name,
      organizationId,
      isTest = false
    } = requestData;

    // Validate required fields
    if (!project_id || !organizationId) {
      throw new Error('Missing required fields for milestone notification');
    }

    console.log('Processing milestone for project:', project_id, 'from', old_status, 'to', new_status);

    // Get the name of the person who made the change
    let changedByUserName = milestone_user_name || 'Someone';
    if (milestone_user_id && !milestone_user_name) {
      try {
        const { data: changedByProfile } = await adminSupabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', milestone_user_id)
          .maybeSingle();

        const { data: changedByAuth } = await adminSupabase.auth.admin.getUserById(milestone_user_id);
        
        if (changedByProfile?.full_name) {
          changedByUserName = changedByProfile.full_name;
        } else if (changedByAuth?.user?.user_metadata?.full_name) {
          changedByUserName = changedByAuth.user.user_metadata.full_name;
        } else if (changedByAuth?.user?.email) {
          changedByUserName = changedByAuth.user.email.split('@')[0];
        }
      } catch (error) {
        console.error('Error fetching changed-by user details:', error);
        // Keep default "Someone" if we can't fetch the user
      }
    }

    // Get project details and assigned users
    const { data: project, error: projectError } = await adminSupabase
      .from('projects')
      .select(`
        id,
        name,
        description,
        project_types(name),
        status_id,
        lead_id
      `)
      .eq('id', project_id)
      .maybeSingle();

    if (projectError || !project) {
      console.error('Error fetching project:', projectError);
      throw new Error('Project not found');
    }

    console.log('Found project for milestone:', project.name);

    // Get lead name separately if lead_id exists
    let leadName = '';
    if (project.lead_id) {
      const { data: leadData } = await adminSupabase
        .from('leads')
        .select('name')
        .eq('id', project.lead_id)
        .maybeSingle();
      
      leadName = leadData?.name || '';
    }

    // Get current status name
    const { data: statusData } = await adminSupabase
      .from('project_statuses')
      .select('name, lifecycle')
      .eq('id', project.status_id)
      .maybeSingle();

    const currentStatusName = statusData?.name || new_status || 'Unknown Status';
    const lifecycle = statusData?.lifecycle || 'active';

    // Only proceed if this is actually a milestone (completed or cancelled)
    if (!['completed', 'cancelled'].includes(lifecycle)) {
      console.log('Status change is not a milestone, skipping notification');
      return new Response(JSON.stringify({
        message: 'Not a milestone status change',
        successful: 0,
        failed: 0,
        total: 0,
        skipped: 1
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log('Milestone notifications disabled in single photographer mode — skipping email delivery');

    return new Response(JSON.stringify({
      message: 'Milestone notifications disabled in single photographer mode',
      successful: 0,
      failed: 0,
      skipped: 1,
      total: 0
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: unknown) {
    console.error('Error in project milestone notification:', error);
    
    return new Response(JSON.stringify({
      error: getErrorMessage(error),
      successful: 0,
      failed: 1,
      total: 1
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

if (import.meta.main) {
  serve(handler);
}
