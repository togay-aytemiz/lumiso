import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

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

    // Get user from auth header in test mode
    let userEmail = 'togayaytemiz@gmail.com'; // Hardcode for now to make it simple
    
    if (isTest) {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (user?.email) {
          userEmail = user.email;
        }
      }
    }

    console.log(`Sending daily summary to: ${userEmail}`);

    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Get upcoming sessions for today
    const { data: sessions } = await supabase
      .from('sessions')
      .select(`
        id,
        session_date,
        session_time,
        notes,
        leads:lead_id (
          name,
          email,
          phone
        )
      `)
      .eq('session_date', todayStr)
      .limit(10);

    // Get overdue activities (reminders from yesterday and before)
    const { data: activities } = await supabase
      .from('activities')
      .select(`
        id,
        content,
        reminder_date,
        reminder_time,
        leads:lead_id (
          name
        )
      `)
      .lt('reminder_date', todayStr)
      .eq('completed', false)
      .limit(10);

    // Get pending todos
    const { data: todos } = await supabase
      .from('todos')
      .select(`
        id,
        content,
        projects:project_id (
          name
        )
      `)
      .eq('is_completed', false)
      .limit(10);

    // Simple HTML email
    const sessionsHtml = sessions?.length ? sessions.map(s => 
      `<li>${s.session_time} - ${s.leads?.name || 'Session'} ${s.notes ? `(${s.notes})` : ''}</li>`
    ).join('') : '<li>No sessions today</li>';

    const activitiesHtml = activities?.length ? activities.map(a => 
      `<li><strong>Overdue:</strong> ${a.content} ${a.leads?.name ? `- ${a.leads.name}` : ''}</li>`
    ).join('') : '<li>No overdue items</li>';

    const todosHtml = todos?.length ? todos.map(t => 
      `<li>${t.content} ${t.projects?.name ? `(${t.projects.name})` : ''}</li>`
    ).join('') : '<li>No pending tasks</li>';

    const emailHtml = `
      <h1>Daily Summary - ${today.toLocaleDateString()}</h1>
      
      <h2>Today's Sessions</h2>
      <ul>${sessionsHtml}</ul>
      
      <h2>Overdue Items</h2>
      <ul>${activitiesHtml}</ul>
      
      <h2>Pending Tasks</h2>
      <ul>${todosHtml}</ul>
      
      <p><a href="http://localhost:3000" style="background: #1EB29F; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Open Lumiso</a></p>
    `;

    // Send email
    const emailResult = await resend.emails.send({
      from: 'Lumiso <onboarding@resend.dev>',
      to: [userEmail],
      subject: `Daily Summary - ${today.toLocaleDateString()}`,
      html: emailHtml
    });

    console.log('Email sent:', emailResult);

    return new Response(JSON.stringify({
      message: `Daily summary sent to ${userEmail}`,
      successful: 1,
      failed: 0,
      total: 1,
      emailResult
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