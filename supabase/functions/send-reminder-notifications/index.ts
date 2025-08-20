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

    // Get user's org ID from your specific user
    const userOrgId = '86b098a8-2fd5-4ad6-9dbf-757d656b307b';
    const userId = 'ac32273e-af95-4de9-abed-ce96e6f68139';

    console.log(`Sending daily summary to: ${userEmail}`);

    // Get today's date and time boundaries
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const currentTime = today.getHours() + ':' + today.getMinutes().toString().padStart(2, '0');
    const next3Hours = new Date(today.getTime() + 3 * 60 * 60 * 1000);
    const next3HoursStr = next3Hours.toISOString();

    console.log(`Dates - Today: ${todayStr}, Current time: ${currentTime}, Next 3h: ${next3HoursStr}`);

    // Get TODAY's sessions
    const { data: todaySessions, error: todaySessionsError } = await supabase
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
      .eq('organization_id', userOrgId)
      .order('session_time');

    // Get OVERDUE sessions (past dates with active lifecycle)
    const { data: overdueSessions, error: overdueSessionsError } = await supabase
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
        ),
        session_statuses!inner(lifecycle)
      `)
      .lt('session_date', todayStr)
      .eq('organization_id', userOrgId)
      .eq('session_statuses.lifecycle', 'active')
      .order('session_date');

    // Get OVERDUE reminders (past dates, not completed)
    const { data: overdueReminders, error: overdueRemindersError } = await supabase
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
      .eq('organization_id', userOrgId)
      .order('reminder_date');

    // Get upcoming reminders (today + next 3 hours)
    const { data: upcomingReminders, error: upcomingRemindersError } = await supabase
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
      .eq('reminder_date', todayStr)
      .eq('completed', false)
      .eq('organization_id', userOrgId)
      .order('reminder_time');

    // Get pending todos (first 3 with project/lead context)
    const { data: todos, error: todosError } = await supabase
      .from('todos')
      .select(`
        id,
        content,
        projects:project_id (
          name,
          leads:lead_id (
            name
          )
        )
      `)
      .eq('is_completed', false)
      .limit(3);

    // Get total pending todos count
    const { count: totalTodos } = await supabase
      .from('todos')
      .select('*', { count: 'exact', head: true })
      .eq('is_completed', false);

    console.log(`Data results:`, {
      todaySessions: { count: todaySessions?.length || 0, error: todaySessionsError },
      overdueSessions: { count: overdueSessions?.length || 0, error: overdueSessionsError },
      overdueReminders: { count: overdueReminders?.length || 0, error: overdueRemindersError, data: overdueReminders },
      upcomingReminders: { count: upcomingReminders?.length || 0, error: upcomingRemindersError },
      todos: { count: todos?.length || 0, total: totalTodos, error: todosError }
    });

    // Create HTML sections focusing on TODAY and OVERDUE
    const todaySessionsHtml = todaySessions?.length ? todaySessions.map(s => 
      `<li>🕐 ${s.session_time} - <strong>${s.leads?.name || 'Session'}</strong> ${s.notes ? `<br><em>${s.notes}</em>` : ''}</li>`
    ).join('') : '';

    const overdueSessionsHtml = overdueSessions?.length ? overdueSessions.map(s => 
      `<li>⚠️ <strong>Overdue Session:</strong> ${s.session_date} ${s.session_time} - ${s.leads?.name || 'Session'} ${s.notes ? `<br><em>${s.notes}</em>` : ''}</li>`
    ).join('') : '';

    const overdueRemindersHtml = overdueReminders?.length ? overdueReminders.map(a => 
      `<li>⚠️ <strong>Overdue Reminder:</strong> ${a.content} ${a.leads?.name ? `- ${a.leads.name}` : ''} <em>(due ${a.reminder_date})</em></li>`
    ).join('') : '';

    const upcomingRemindersHtml = upcomingReminders?.length ? upcomingReminders.map(a => 
      `<li>📅 ${a.reminder_time} - ${a.content} ${a.leads?.name ? `- <strong>${a.leads.name}</strong>` : ''}</li>`
    ).join('') : '';

    const todosHtml = todos?.length ? todos.map(t => 
      `<li>✓ ${t.content} ${t.projects?.name ? `<em>(${t.projects.name})</em>` : ''} ${t.projects?.leads?.name ? `- ${t.projects.leads.name}` : ''}</li>`
    ).join('') : '';

    // Combine all overdue items
    const allOverdueHtml = [overdueSessionsHtml, overdueRemindersHtml].filter(h => h).join('') || '<li>No overdue items ✨</li>';
    
    // Combine today's items (sessions + reminders)
    const todayItemsHtml = [todaySessionsHtml, upcomingRemindersHtml].filter(h => h).join('') || '<li>Nothing scheduled for today</li>';
    
    // Todos section with count
    const todosSection = totalTodos > 0 ? 
      `<p><strong>${totalTodos} pending tasks</strong> ${totalTodos > 3 ? `(showing first 3)` : ''}</p>
       <ul>${todosHtml}</ul>` : 
      '<p>No pending tasks ✨</p>';

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1EB29F; border-bottom: 2px solid #1EB29F; padding-bottom: 10px;">
          📊 Daily Summary - ${today.toLocaleDateString()}
        </h1>
        
        <div style="margin: 25px 0;">
          <h2 style="color: #dc2626; margin-bottom: 10px;">⚠️ Overdue Items</h2>
          <div style="background: #fef2f2; padding: 15px; border-left: 4px solid #ef4444; border-radius: 6px;">
            <ul style="margin: 0; padding-left: 20px;">
              ${allOverdueHtml}
            </ul>
          </div>
        </div>
        
        <div style="margin: 25px 0;">
          <h2 style="color: #2563eb; margin-bottom: 10px;">📅 Today's Schedule</h2>
          <div style="background: #f0f9ff; padding: 15px; border-left: 4px solid #3b82f6; border-radius: 6px;">
            <ul style="margin: 0; padding-left: 20px;">
              ${todayItemsHtml}
            </ul>
          </div>
        </div>
        
        <div style="margin: 25px 0;">
          <h2 style="color: #ea580c; margin-bottom: 10px;">✅ Pending Tasks</h2>
          <div style="background: #fefce8; padding: 15px; border-left: 4px solid #eab308; border-radius: 6px;">
            ${todosSection}
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8fafc; border-radius: 8px;">
          <a href="http://localhost:3000" 
             style="background: #1EB29F; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
            🚀 Open Lumiso
          </a>
        </div>
      </div>
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