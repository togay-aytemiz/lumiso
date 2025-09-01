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

    // Get authenticated user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    // Create supabase clients
    const userSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Extract token and get current user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await userSupabase.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Failed to get authenticated user');
    }

    // Get user's active organization using admin client with proper auth
    const { data: organizationId, error: orgError } = await adminSupabase
      .rpc('get_user_active_organization_id')
      .headers({ Authorization: authHeader });
    if (orgError || !organizationId) {
      console.error('Organization error:', orgError);
      throw new Error('No active organization found for user');
    }

    console.log(`Sending daily summary to: ${user.email} for org: ${organizationId}`);

    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    console.log(`Today's date: ${todayStr}`);

    // Get today's sessions using admin client with auth context
    const { data: todaySessions, error: todaySessionsError } = await adminSupabase
      .from('sessions')
      .select(`
        id,
        session_date,
        session_time,
        notes,
        location,
        leads(id, name),
        projects(id, name)
      `)
      .eq('session_date', todayStr)
      .eq('organization_id', organizationId)
      .order('session_time');

    if (todaySessionsError) {
      console.error('Error fetching today sessions:', todaySessionsError);
    }

    // Get overdue reminders/activities
    const { data: overdueActivities, error: overdueError } = await adminSupabase
      .from('activities')
      .select(`
        id,
        content,
        reminder_date,
        reminder_time,
        completed,
        leads(id, name),
        projects(id, name)
      `)
      .lt('reminder_date', todayStr)
      .eq('completed', false)
      .eq('organization_id', organizationId)
      .order('reminder_date', { ascending: false });

    if (overdueError) {
      console.error('Error fetching overdue activities:', overdueError);
    }

    // Get today's reminders/activities
    const { data: todayActivities, error: todayActivitiesError } = await adminSupabase
      .from('activities')
      .select(`
        id,
        content,
        reminder_date,
        reminder_time,
        completed,
        leads(id, name),
        projects(id, name)
      `)
      .eq('reminder_date', todayStr)
      .eq('completed', false)
      .eq('organization_id', organizationId)
      .order('reminder_time');

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
      overdueActivities: overdueActivities?.length || 0,
      todayActivities: todayActivities?.length || 0,
      pendingTodos: pendingTodos?.length || 0
    });

    // Prepare data for enhanced email template
    const templateData = {
      organizationName: orgSettings?.photography_business_name || 'Lumiso',
      primaryColor: orgSettings?.primary_brand_color || '#1EB29F',
      dateFormat: orgSettings?.date_format || 'DD/MM/YYYY',
      timeFormat: orgSettings?.time_format || '12-hour',
      baseUrl: isTest ? 'http://localhost:3000' : 'https://app.lumiso.com'
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

    // Transform todos data
    const todos = (pendingTodos || []).map(todo => ({
      id: todo.id,
      content: todo.content,
      created_at: todo.created_at,
      projects: todo.projects
    }));

    // Transform overdue data
    const overdueItems = {
      leads: [], // No overdue leads for now, focus on activities
      activities: (overdueActivities || []).map(activity => ({
        id: activity.id,
        content: activity.content,
        reminder_date: activity.reminder_date,
        reminder_time: activity.reminder_time,
        leads: activity.leads,
        projects: activity.projects
      }))
    };

    // Generate enhanced email content using the template
    const emailHtml = generateDailySummaryEmail(
      sessions,
      todos,
      overdueItems,
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