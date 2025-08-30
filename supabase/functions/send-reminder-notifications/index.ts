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

    // Use service role key to bypass RLS for debugging
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    console.log(`Today's date: ${todayStr}`);

    // Get OVERDUE reminders (exactly like my working query)
    const { data: overdueReminders, error: overdueRemindersError } = await adminSupabase
      .from('activities')
      .select(`
        id,
        content,
        reminder_date,
        reminder_time,
        user_id,
        organization_id,
        lead_id
      `)
      .lt('reminder_date', todayStr)
      .eq('completed', false)
      .eq('organization_id', '86b098a8-2fd5-4ad6-9dbf-757d656b307b')
      .order('reminder_date', { ascending: false });

    // Get lead names for overdue reminders
    let overdueWithLeads = [];
    if (overdueReminders?.length) {
      for (const reminder of overdueReminders) {
        let leadName = null;
        if (reminder.lead_id) {
          const { data: lead } = await adminSupabase
            .from('leads')
            .select('name')
            .eq('id', reminder.lead_id)
            .single();
          leadName = lead?.name;
        }
        overdueWithLeads.push({
          ...reminder,
          leadName
        });
      }
    }

    // Get TODAY's sessions
    const { data: todaySessions, error: todaySessionsError } = await adminSupabase
      .from('sessions')
      .select(`
        id,
        session_date,
        session_time,
        notes,
        lead_id
      `)
      .eq('session_date', todayStr)
      .eq('organization_id', '86b098a8-2fd5-4ad6-9dbf-757d656b307b')
      .order('session_time');

    // Get lead names for today's sessions
    let todaySessionsWithLeads = [];
    if (todaySessions?.length) {
      for (const session of todaySessions) {
        let leadName = null;
        if (session.lead_id) {
          const { data: lead } = await adminSupabase
            .from('leads')
            .select('name')
            .eq('id', session.lead_id)
            .single();
          leadName = lead?.name;
        }
        todaySessionsWithLeads.push({
          ...session,
          leadName
        });
      }
    }

    // Get TODAY's reminders
    const { data: todayReminders, error: todayRemindersError } = await adminSupabase
      .from('activities')
      .select(`
        id,
        content,
        reminder_date,
        reminder_time,
        lead_id
      `)
      .eq('reminder_date', todayStr)
      .eq('completed', false)
      .eq('organization_id', '86b098a8-2fd5-4ad6-9dbf-757d656b307b')
      .order('reminder_time');

    // Get lead names for today's reminders
    let todayRemindersWithLeads = [];
    if (todayReminders?.length) {
      for (const reminder of todayReminders) {
        let leadName = null;
        if (reminder.lead_id) {
          const { data: lead } = await adminSupabase
            .from('leads')
            .select('name')
            .eq('id', reminder.lead_id)
            .single();
          leadName = lead?.name;
        }
        todayRemindersWithLeads.push({
          ...reminder,
          leadName
        });
      }
    }

    // Get pending todos with project and lead context (exactly like my working query)
    const { data: todos, error: todosError } = await adminSupabase
      .from('todos')
      .select(`
        id,
        content,
        project_id
      `)
      .eq('is_completed', false)
      .eq('user_id', 'ac32273e-af95-4de9-abed-ce96e6f68139')
      .limit(3);

    // Get project and lead names for todos
    let todosWithContext = [];
    if (todos?.length) {
      for (const todo of todos) {
        let projectName = null;
        let leadName = null;
        if (todo.project_id) {
          const { data: project } = await adminSupabase
            .from('projects')
            .select('name, lead_id')
            .eq('id', todo.project_id)
            .single();
          projectName = project?.name;
          
          if (project?.lead_id) {
            const { data: lead } = await adminSupabase
              .from('leads')
              .select('name')
              .eq('id', project.lead_id)
              .single();
            leadName = lead?.name;
          }
        }
        todosWithContext.push({
          ...todo,
          projectName,
          leadName
        });
      }
    }

    // Get total todos count
    const { count: totalTodos } = await adminSupabase
      .from('todos')
      .select('*', { count: 'exact', head: true })
      .eq('is_completed', false)
      .eq('user_id', 'ac32273e-af95-4de9-abed-ce96e6f68139');

    console.log(`Raw data results:`, {
      overdueReminders: { count: overdueReminders?.length || 0, error: overdueRemindersError, data: overdueReminders },
      todaySessions: { count: todaySessions?.length || 0, error: todaySessionsError },
      todayReminders: { count: todayReminders?.length || 0, error: todayRemindersError },
      todos: { count: todos?.length || 0, totalCount: totalTodos, error: todosError, data: todos }
    });

    // Create HTML sections focusing on TODAY and OVERDUE
    const todaySessionsHtml = todaySessionsWithLeads?.length ? todaySessionsWithLeads.map(s => 
      `<li>🕐 ${s.session_time} - <strong>${s.leadName || 'Session'}</strong> ${s.notes ? `<br><em>${s.notes}</em>` : ''}</li>`
    ).join('') : '';

    const overdueRemindersHtml = overdueWithLeads?.length ? overdueWithLeads.map(a => 
      `<li>⚠️ <strong>Overdue Reminder:</strong> ${a.content} ${a.leadName ? `- <strong>${a.leadName}</strong>` : ''} <em>(due ${a.reminder_date})</em></li>`
    ).join('') : '';

    const todayRemindersHtml = todayRemindersWithLeads?.length ? todayRemindersWithLeads.map(a => 
      `<li>📅 ${a.reminder_time} - ${a.content} ${a.leadName ? `- <strong>${a.leadName}</strong>` : ''}</li>`
    ).join('') : '';

    const todosHtml = todosWithContext?.length ? todosWithContext.map(t => 
      `<li>✓ ${t.content} ${t.projectName ? `<em>(${t.projectName})</em>` : ''} ${t.leadName ? `- <strong>${t.leadName}</strong>` : ''}</li>`
    ).join('') : '';

    // Combine all overdue items
    const allOverdueHtml = overdueRemindersHtml || '<li>No overdue items ✨</li>';
    
    // Combine today's items (sessions + reminders)
    const todayItemsHtml = [todaySessionsHtml, todayRemindersHtml].filter(h => h).join('') || '<li>Nothing scheduled for today</li>';
    
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
      from: 'Lumiso <hello@updates.lumiso.app>',
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