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

    console.log(`Dates - Today: ${todayStr}, Tomorrow: ${tomorrowStr}`);

    // Get today's sessions
    const { data: todaySessions } = await supabase
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

    // Get tomorrow's sessions  
    const { data: tomorrowSessions } = await supabase
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
      .eq('session_date', tomorrowStr)
      .limit(10);

    // Get overdue reminders (from past dates, not completed)
    const { data: overdueReminders } = await supabase
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

    // Get today's reminders
    const { data: todayReminders } = await supabase
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
      .limit(10);

    // Get tomorrow's reminders
    const { data: tomorrowReminders } = await supabase
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
      .eq('reminder_date', tomorrowStr)
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

    console.log(`Data counts:`, {
      todaySessions: todaySessions?.length || 0,
      tomorrowSessions: tomorrowSessions?.length || 0,
      overdueReminders: overdueReminders?.length || 0,
      todayReminders: todayReminders?.length || 0,
      tomorrowReminders: tomorrowReminders?.length || 0,
      todos: todos?.length || 0
    });

    // Create HTML sections
    const todaySessionsHtml = todaySessions?.length ? todaySessions.map(s => 
      `<li>🕐 ${s.session_time} - ${s.leads?.name || 'Session'} ${s.notes ? `(${s.notes})` : ''}</li>`
    ).join('') : '<li>No sessions today</li>';

    const tomorrowSessionsHtml = tomorrowSessions?.length ? tomorrowSessions.map(s => 
      `<li>🕐 ${s.session_time} - ${s.leads?.name || 'Session'} ${s.notes ? `(${s.notes})` : ''}</li>`
    ).join('') : '';

    const overdueRemindersHtml = overdueReminders?.length ? overdueReminders.map(a => 
      `<li>⚠️ <strong>Overdue:</strong> ${a.content} ${a.leads?.name ? `- ${a.leads.name}` : ''} (${a.reminder_date})</li>`
    ).join('') : '';

    const todayRemindersHtml = todayReminders?.length ? todayReminders.map(a => 
      `<li>📅 ${a.reminder_time} - ${a.content} ${a.leads?.name ? `- ${a.leads.name}` : ''}</li>`
    ).join('') : '';

    const tomorrowRemindersHtml = tomorrowReminders?.length ? tomorrowReminders.map(a => 
      `<li>📅 ${a.reminder_time} - ${a.content} ${a.leads?.name ? `- ${a.leads.name}` : ''}</li>`
    ).join('') : '';

    const todosHtml = todos?.length ? todos.map(t => 
      `<li>✓ ${t.content} ${t.projects?.name ? `(${t.projects.name})` : ''}</li>`
    ).join('') : '<li>No pending tasks</li>';

    // Combine overdue items
    const overdueItemsHtml = overdueRemindersHtml || '<li>No overdue items ✨</li>';
    
    // Combine today's items
    const todayItemsHtml = [todaySessionsHtml, todayRemindersHtml].filter(h => h && !h.includes('No sessions')).join('') || '<li>Nothing scheduled for today</li>';
    
    // Combine tomorrow's/upcoming items
    const upcomingItemsHtml = [tomorrowSessionsHtml, tomorrowRemindersHtml].filter(h => h).join('') || '<li>Nothing scheduled for tomorrow</li>';

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1EB29F;">Daily Summary - ${today.toLocaleDateString()}</h1>
        
        <h2 style="color: #333;">⚠️ Overdue Items</h2>
        <ul style="background: #fef2f2; padding: 15px; border-left: 4px solid #ef4444; margin: 10px 0;">
          ${overdueItemsHtml}
        </ul>
        
        <h2 style="color: #333;">📅 Today's Schedule</h2>
        <ul style="background: #f0f9ff; padding: 15px; border-left: 4px solid #3b82f6; margin: 10px 0;">
          ${todayItemsHtml}
        </ul>
        
        <h2 style="color: #333;">🔮 Tomorrow's Schedule</h2>
        <ul style="background: #f0fdf4; padding: 15px; border-left: 4px solid #22c55e; margin: 10px 0;">
          ${upcomingItemsHtml}
        </ul>
        
        <h2 style="color: #333;">✅ Pending Tasks</h2>
        <ul style="background: #fefce8; padding: 15px; border-left: 4px solid #eab308; margin: 10px 0;">
          ${todosHtml}
        </ul>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="http://localhost:3000" 
             style="background: #1EB29F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
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