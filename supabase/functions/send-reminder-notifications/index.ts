import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";
import { generateDailySummaryEmail } from './_templates/enhanced-daily-summary-template.ts';
import { generateAssignmentEmail, AssignmentEmailData } from './_templates/enhanced-assignment-template.ts';

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

    // Handle new-assignment notifications first (simpler path)
    if (requestData.type === 'new-assignment') {
      return await handleNewAssignmentNotification(requestData, adminSupabase);
    }

    // Handle daily-summary notifications
    if (requestData.type !== 'daily-summary') {
      return new Response(JSON.stringify({ message: 'Only daily-summary and new-assignment supported' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

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

    // Get organization settings for branding
    const { data: orgSettings } = await adminSupabase
      .from('organization_settings')
      .select('photography_business_name, primary_brand_color, date_format, time_format')
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

    // Prepare data for enhanced email template
    const templateData = {
      userFullName,
      businessName: orgSettings?.photography_business_name || 'Lumiso',
      brandColor: orgSettings?.primary_brand_color || '#1EB29F',
      dateFormat: orgSettings?.date_format || 'DD/MM/YYYY',
      timeFormat: orgSettings?.time_format || '12-hour',
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

    // Generate enhanced email content using the template
    const emailHtml = generateDailySummaryEmail(
      sessions,
      todayReminders,
      overdueItems,
      pastSessionsNeedingAction,
      templateData
    );

    // Send email using Resend
    const emailResult = await resend.emails.send({
      from: 'Lumiso <hello@updates.lumiso.app>',
      to: [user.email],
      subject: `Daily Summary - ${today.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      })}`,
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
    let dueDate = null;
    let notes = null;
    let projectType = null;
    let status = null;

    // For testing, create mock data
    if (isTest) {
      console.log('Test mode - creating mock assignment data');
      
      // Create a mock assignment for testing
      entity_type = 'lead';
      entity_id = 'test-lead-id';
      assignee_name = 'Test User';
      assigner_name = 'System';
      entityName = 'Sarah & John Wedding - TEST';
      dueDate = new Date().toISOString().split('T')[0]; // Today's date
      notes = 'This is a test assignment notification. You can safely ignore this email.';
      status = 'New';
      
      console.log(`Test notification will be sent to: ${assignee_email}`);
    } else {
      // Get entity details for real assignments
      if (entity_type === 'lead') {
        const { data: lead } = await adminSupabase
          .from('leads')
          .select('name, due_date, notes, status')
          .eq('id', entity_id)
          .maybeSingle();
        
        if (lead) {
          entityName = lead.name;
          dueDate = lead.due_date;
          notes = lead.notes;
          status = lead.status;
        }
      } else if (entity_type === 'project') {
        console.log('Fetching project details for ID:', entity_id);
        
        // First get the project details
        const { data: project, error: projectError } = await adminSupabase
          .from('projects')
          .select(`
            name,
            description,
            project_type_id,
            status_id
          `)
          .eq('id', entity_id)
          .maybeSingle();
        
        if (projectError) {
          console.error('Error fetching project:', projectError);
        }
        
        if (project) {
          console.log('Found project:', project.name);
          entityName = project.name;
          notes = project.description;
          
          // Get project type name if available
          if (project.project_type_id) {
            const { data: projectTypeData } = await adminSupabase
              .from('project_types')
              .select('name')
              .eq('id', project.project_type_id)
              .maybeSingle();
            
            if (projectTypeData) {
              projectType = projectTypeData.name;
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
            }
          }
        } else {
          console.log('No project found for ID:', entity_id);
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
      
      // Still update the notification log to processed status to avoid retries
      if (assignee_id) {
        await adminSupabase
          .from('notification_logs')
          .update({ status: 'skipped', sent_at: new Date().toISOString() })
          .eq('user_id', assignee_id)
          .eq('notification_type', 'new_assignment')
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

    // Prepare template data
    const templateData: AssignmentEmailData = {
      user: {
        fullName: assignee_name || 'there',
        email: assignee_email || ''
      },
      business: {
        businessName: orgSettings?.photography_business_name || 'Lumiso',
        brandColor: orgSettings?.primary_brand_color || '#1EB29F'
      },
      assignmentData: {
        entityType: entity_type,
        entityId: entity_id || '',
        entityName: entityName || `${entity_type} ${entity_id}`,
        assigneeName: assignee_name || 'there',
        assignerName: assigner_name || 'System',
        dueDate,
        notes,
        projectType,
        status,
        organizationId: organizationId || ''
      }
    };

    // Generate email HTML
    const emailHtml = generateAssignmentEmail(templateData);

    // Send email using Resend
    const emailResult = await resend.emails.send({
      from: 'Lumiso <hello@updates.lumiso.app>',
      to: [assignee_email || ''],
      subject: `New Assignment: ${entityName}`,
      html: emailHtml
    });

    console.log('Assignment notification sent successfully:', emailResult);

    // Update notification log status to sent
    if (assignee_id) {
      await adminSupabase
        .from('notification_logs')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('user_id', assignee_id)
        .eq('notification_type', 'new_assignment')
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
    
    // Log error in notification_logs if possible
    if (requestData.assignee_id && requestData.organizationId) {
      try {
        await adminSupabase
          .from('notification_logs')
          .update({ 
            status: 'failed', 
            error_message: error.message,
            sent_at: new Date().toISOString()
          })
          .eq('user_id', requestData.assignee_id)
          .eq('notification_type', 'new_assignment')
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

serve(handler);