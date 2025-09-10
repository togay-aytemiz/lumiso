import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";
import { generateModernDailySummaryEmail } from './_templates/enhanced-daily-summary-modern.ts';
import { generateEmptyDailySummaryEmail } from './_templates/enhanced-daily-summary-empty.ts';
import { generateImmediateNotificationEmail, generateSubject, ImmediateNotificationEmailData, ProjectAssignmentData, LeadAssignmentData, ProjectMilestoneData } from './_templates/immediate-notifications.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface ReminderRequest {
  type: string;
  isTest?: boolean;
  organizationId?: string; // For batch processing
  userId?: string; // For batch processing
  // New assignment specific fields
  entity_type?: 'lead' | 'project';
  entity_id?: string;
  assignee_id?: string;
  assignee_email?: string;
  assignee_name?: string;
  assigner_name?: string;
  // Project milestone specific fields
  project_id?: string;
  old_status?: string;
  new_status?: string;
  milestone_user_id?: string;
  milestone_user_name?: string;
}

const handler = async (req: Request): Promise<Response> => {
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
    console.log('Available types: daily-summary, daily-summary-empty, new-assignment, project-milestone');

    // Handle new-assignment notifications first (simpler path)
    if (requestData.type === 'new-assignment') {
      return await handleNewAssignmentNotification(requestData, adminSupabase);
    }

    // Handle project-milestone notifications
    if (requestData.type === 'project-milestone') {
      return await handleProjectMilestoneNotification(requestData, adminSupabase);
    }

    // Handle daily-summary and daily-summary-empty notifications
    if (!['daily-summary', 'daily-summary-empty'].includes(requestData.type)) {
      console.log(`Unsupported type received: ${requestData.type}`);
      return new Response(JSON.stringify({ message: 'Only daily-summary, daily-summary-empty, new-assignment and project-milestone supported' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Proceeding with type: ${requestData.type}`);
    const { type, isTest = false, organizationId: batchOrgId, userId: batchUserId } = requestData;

    let user: any;
    let organizationId: string;

    // Check if this is batch processing mode (called from process-scheduled-notifications)
    if (batchOrgId && batchUserId) {
      console.log('Batch processing mode - using provided org and user IDs');
      
      // Get user data directly using admin client
      const { data: userData, error: userError } = await adminSupabase.auth.admin.getUserById(batchUserId);
      if (userError || !userData.user) {
        throw new Error(`Failed to get batch user: ${userError?.message || 'User not found'}`);
      }
      user = userData.user;
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

      // Get user's active organization
      const { data: userSettings } = await adminSupabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      organizationId = userSettings?.active_organization_id;
      
      if (!organizationId) {
        throw new Error('No active organization found for user');
      }
    }

    console.log(`Authenticated user: ${user.email}`);
    console.log('Organization ID:', organizationId);

    // Get user profile for display name
    const { data: userProfile } = await adminSupabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle();

    // Extract user's full name - only use full_name since first_name/last_name don't exist
    const userFullName = userProfile?.full_name || 
                         user.user_metadata?.full_name || 
                         user.email?.split('@')[0] || 'there';
    console.log(`User full name: ${userFullName}`);

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

    // Get organization settings for branding and timezone
    const { data: orgSettings } = await adminSupabase
      .from('organization_settings')
      .select('photography_business_name, primary_brand_color, date_format, time_format, timezone')
      .eq('organization_id', organizationId)
      .maybeSingle();

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
      baseUrl: 'https://my.lumiso.app'
    };

    // Transform sessions data
    const sessions = (todaySessions || []).map(session => ({
      id: session.id,
      session_date: session.session_date,
      session_time: session.session_time,
      notes: session.notes,
      location: session.location,
      leads: session.leads,
      projects: session.projects
    }));

    // Transform past sessions that need action
    const pastSessionsNeedingAction = (pastSessions || []).map(session => ({
      id: session.id,
      session_date: session.session_date,
      session_time: session.session_time,
      notes: session.notes,
      location: session.location,
      leads: session.leads,
      projects: session.projects
    }));

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
    const todayFormatted = today.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });

    if (type === 'daily-summary-empty') {
      // Force empty state for testing
      emailHtml = generateEmptyDailySummaryEmail(
        overdueItems,
        pastSessionsNeedingAction,
        templateData
      );
      emailSubject = `🌅 Fresh Start Today - ${todayFormatted}`;
    } else if (sessions.length === 0 && todayReminders.length === 0) {
      // Automatically use empty template when no sessions or reminders
      emailHtml = generateEmptyDailySummaryEmail(
        overdueItems,
        pastSessionsNeedingAction,
        templateData
      );
      emailSubject = `🌅 Fresh Start Today - ${todayFormatted}`;
    } else {
      // Use regular daily summary template
      emailHtml = generateModernDailySummaryEmail(
        sessions,
        todayReminders,
        overdueItems,
        pastSessionsNeedingAction,
        templateData
      );
      emailSubject = `📅 Daily Summary - ${todayFormatted}`;
    }

    // Send email using Resend
    const emailResult = await resend.emails.send({
      from: 'Lumiso <hello@updates.lumiso.app>',
      to: [user.email],
      subject: emailSubject,
      html: emailHtml
    });

    console.log('Email sent successfully:', emailResult);

    return new Response(JSON.stringify({
      message: `Daily summary sent to ${user.email}`,
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

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      successful: 0,
      failed: 1,
      total: 1
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

// Handler for new assignment notifications
async function handleNewAssignmentNotification(requestData: ReminderRequest, adminSupabase: any): Promise<Response> {
  console.log('Handling new assignment notification:', requestData);
  
  try {
    let { 
      entity_type,
      entity_id,
      assignee_id,
      assignee_email,
      assignee_name,
      assigner_name,
      organizationId,
      isTest = false
    } = requestData;

    // Validate required fields
    if (!entity_type || !entity_id || !assignee_email || !organizationId) {
      throw new Error('Missing required fields for assignment notification');
    }

    // Initialize variables for entity details
    let entityName = '';
    let notes = null;
    let projectType = null;
    let status = null;
    let leadName = null;

    // For testing, create mock data
    if (isTest) {
      console.log('Test mode - creating mock assignment data');
      
      // Create a mock assignment for testing
      entity_type = 'lead';
      entity_id = 'test-lead-id';
      assignee_name = 'Test User';
      assigner_name = 'System';
      entityName = 'Sarah & John Wedding - TEST';
      notes = 'This is a test assignment notification. You can safely ignore this email.';
      status = 'New';
      
      console.log(`Test notification will be sent to: ${assignee_email}`);
    } else {
      // Get entity details for real assignments
      if (entity_type === 'lead') {
        const { data: lead } = await adminSupabase
          .from('leads')
          .select('name, notes, status')
          .eq('id', entity_id)
          .maybeSingle();
        
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
          leadName = project.leads?.name;
          
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
      notificationData
    };

    // Generate email HTML and subject
    const emailHtml = generateImmediateNotificationEmail(templateData);
    const emailSubject = generateSubject(notificationData);

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

  } catch (error) {
    console.error('Error in assignment notification:', error);
    
    // Log error in notifications table if possible
    if (requestData.assignee_id && requestData.organizationId) {
      try {
        await adminSupabase
          .from('notifications')
          .update({ 
            status: 'failed', 
            error_message: error.message,
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
      error: error.message,
      successful: 0,
      failed: 1,
      total: 1
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

// Handler for project milestone notifications
async function handleProjectMilestoneNotification(requestData: ReminderRequest, adminSupabase: any): Promise<Response> {
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
        assignees,
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

    // Get organization settings for branding and notification preferences
    const { data: orgSettings } = await adminSupabase
      .from('organization_settings')
      .select('photography_business_name, primary_brand_color, notification_project_milestone_enabled, notification_global_enabled')
      .eq('organization_id', organizationId)
      .maybeSingle();

    let successful = 0;
    let failed = 0;
    let skipped = 0;
    const total = project.assignees?.length || 0;

    // Send notifications to all assigned users
    for (const assigneeId of project.assignees || []) {
      try {
        // Get assignee details
        const { data: assigneeProfile } = await adminSupabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', assigneeId)
          .maybeSingle();

        const { data: assigneeAuth } = await adminSupabase.auth.admin.getUserById(assigneeId);
        
        if (!assigneeAuth?.user?.email) {
          console.log('No email found for assignee:', assigneeId);
          failed++;
          continue;
        }

        const assigneeName = assigneeProfile?.full_name || 
                            assigneeAuth.user.user_metadata?.full_name || 
                            assigneeAuth.user.email.split('@')[0];

        // Get user-level notification settings (takes precedence over org settings)
        const { data: userSettings } = await adminSupabase
          .from('user_settings')
          .select('notification_project_milestone_enabled, notification_global_enabled')
          .eq('user_id', assigneeId)
          .maybeSingle();

        // Check if milestone notifications are disabled - user settings override org settings
        const globalEnabled = (userSettings?.notification_global_enabled ?? orgSettings?.notification_global_enabled) ?? true;
        const milestoneEnabled = (userSettings?.notification_project_milestone_enabled ?? orgSettings?.notification_project_milestone_enabled) ?? true;

        if (!globalEnabled || !milestoneEnabled) {
          console.log(`Milestone notifications disabled for user ${assigneeId} - Global: ${globalEnabled}, Milestone: ${milestoneEnabled}`);
          
          // Update notification to skipped
          await adminSupabase
            .from('notifications')
            .update({ status: 'skipped', updated_at: new Date().toISOString() })
            .eq('user_id', assigneeId)
            .eq('notification_type', 'project-milestone')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1);

          skipped++;
          continue;
        }

        // Generate unified milestone notification
        const notificationData: ProjectMilestoneData = {
          type: 'project-milestone' as const,
          organizationId: organizationId,
          triggeredByUser: {
            name: changedByUserName,
            id: milestone_user_id || ''
          },
          project: {
            id: project.id,
            name: project.name,
            type: project.project_types?.name || undefined,
            oldStatus: old_status || 'Previous Status',
            newStatus: currentStatusName,
            lifecycle: lifecycle as 'completed' | 'cancelled',
            notes: project.description || undefined,
            leadName: leadName || undefined
          },
          assignee: {
            name: assigneeName,
            email: assigneeAuth.user.email
          }
        };

        const emailData: ImmediateNotificationEmailData = {
          user: {
            fullName: assigneeName,
            email: assigneeAuth.user.email
          },
          business: {
            businessName: orgSettings?.photography_business_name || 'Lumiso',
            brandColor: orgSettings?.primary_brand_color || '#1EB29F'
          },
          notificationData
        };
        
        const emailHtml = generateImmediateNotificationEmail(emailData);
        const emailSubject = generateSubject(notificationData);

        // Send the email
        const emailResult = await resend.emails.send({
          from: 'Lumiso <hello@updates.lumiso.app>',
          to: [assigneeAuth.user.email],
          subject: emailSubject,
          html: emailHtml
        });

        console.log(`Milestone notification sent to ${assigneeAuth.user.email}:`, emailResult);

        // Update notification status to sent
        await adminSupabase
          .from('notifications')
          .update({ 
            status: 'sent', 
            updated_at: new Date().toISOString(),
            email_id: emailResult.data?.id || null 
          })
          .eq('user_id', assigneeId)
          .eq('notification_type', 'project-milestone')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1);

        successful++;

      } catch (error) {
        console.error(`Error sending milestone notification to ${assigneeId}:`, error);
        
        // Log error in notifications table
        try {
          await adminSupabase
            .from('notifications')
            .update({ 
              status: 'failed', 
              error_message: error.message,
              updated_at: new Date().toISOString(),
              retry_count: 1
            })
            .eq('user_id', assigneeId)
            .eq('notification_type', 'project-milestone')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1);
        } catch (logError) {
          console.error('Failed to update error log:', logError);
        }

        failed++;
      }
    }

    return new Response(JSON.stringify({
      message: `Project milestone notifications processed for ${project.name}`,
      successful,
      failed,
      skipped,
      total,
      projectName: project.name,
      newStatus: currentStatusName,
      lifecycle
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error('Error in project milestone notification:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      successful: 0,
      failed: 1,
      total: 1
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

serve(handler);