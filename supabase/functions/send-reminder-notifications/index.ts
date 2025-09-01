import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";
import { generateDailySummaryEmail } from './_templates/enhanced-daily-summary-template.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface ReminderRequest {
  type: string;
  isTest?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, isTest = false }: ReminderRequest = await req.json();
    console.log(`Processing ${type}, test mode: ${isTest}`);

    if (type !== 'daily-summary') {
      return new Response(JSON.stringify({ message: 'Only daily-summary supported' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get authenticated user - simplified approach
    const authHeader = req.headers.get('authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    // Create admin client 
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Extract token and get user directly with admin client
    const token = authHeader.replace('Bearer ', '');
    console.log('Token length:', token.length);
    
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token);
    console.log('User auth result:', { user: !!user, error: userError?.message });
    
    if (userError || !user) {
      console.error('Auth error details:', userError);
      throw new Error(`Failed to get authenticated user: ${userError?.message || 'Unknown error'}`);
    }

    console.log(`Authenticated user: ${user.email}`);

    // Get user profile and organization
    const { data: userProfile } = await adminSupabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: userSettings } = await adminSupabase
      .from('user_settings')
      .select('active_organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const organizationId = userSettings?.active_organization_id;
    console.log('Organization ID:', organizationId);
    
    if (!organizationId) {
      throw new Error('No active organization found for user');
    }

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
        content,
        reminder_date,
        reminder_time,
        completed,
        lead_id,
        project_id,
        leads(id, name),
        projects(id, name)
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
    const todayReminders = (todayActivities || []).map(activity => ({
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

serve(handler);