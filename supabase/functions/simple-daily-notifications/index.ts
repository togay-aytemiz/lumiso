import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessorRequest {
  action: 'process' | 'test';
  user_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Simple daily notification processor started');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { action, user_id }: ProcessorRequest = await req.json().catch(() => ({ action: 'process' }));
    
    const currentTime = new Date();
    const currentHour = String(currentTime.getHours()).padStart(2, '0');
    const currentMinute = String(currentTime.getMinutes()).padStart(2, '0');
    const currentTimeString = `${currentHour}:${currentMinute}`;
    
    console.log(`Processing at ${currentTimeString}`);

    // Get users who need daily summaries at this time
    let usersQuery = supabaseAdmin
      .from('user_settings')
      .select(`
        user_id, 
        notification_scheduled_time, 
        notification_daily_summary_enabled,
        notification_global_enabled,
        photography_business_name,
        primary_brand_color
      `)
      .eq('notification_global_enabled', true)
      .eq('notification_daily_summary_enabled', true);

    if (action === 'test' && user_id) {
      console.log(`Testing for specific user: ${user_id}`);
      usersQuery = usersQuery.eq('user_id', user_id);
    } else {
      usersQuery = usersQuery.eq('notification_scheduled_time', currentTimeString);
    }

    const { data: users, error: usersError } = await usersQuery;

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    console.log(`Found ${users?.length || 0} users to process`);

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `No users found for ${currentTimeString}`,
          processed: 0 
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let processed = 0;
    let errors = 0;

    for (const userSettings of users) {
      try {
        console.log(`Processing user ${userSettings.user_id} at ${userSettings.notification_scheduled_time}`);
        
        // Get user profile for email
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('user_id', userSettings.user_id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          continue;
        }

        // Get user email from auth.users
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userSettings.user_id);
        
        if (userError || !user?.email) {
          console.error('Error fetching user email:', userError);
          continue;
        }

        // Get user's active organization
        const { data: orgData, error: orgError } = await supabaseAdmin
          .from('user_settings')
          .select('active_organization_id')
          .eq('user_id', userSettings.user_id)
          .single();

        if (orgError || !orgData?.active_organization_id) {
          console.error('No active organization found for user');
          continue;
        }

        // Get today's sessions
        const today = new Date().toISOString().split('T')[0];
        const { data: sessions } = await supabaseAdmin
          .from('sessions')
          .select('*')
          .eq('organization_id', orgData.active_organization_id)
          .eq('session_date', today);

        // Get today's activities/reminders
        const { data: activities } = await supabaseAdmin
          .from('activities')
          .select('*')
          .eq('organization_id', orgData.active_organization_id)
          .eq('reminder_date', today);

        // Get overdue items (sessions and activities from previous days not completed)
        const { data: overdueSessions } = await supabaseAdmin
          .from('sessions')
          .select('*')
          .eq('organization_id', orgData.active_organization_id)
          .lt('session_date', today)
          .neq('status_id', 'completed'); // Assuming completed sessions have this status

        const { data: overdueActivities } = await supabaseAdmin
          .from('activities')
          .select('*')
          .eq('organization_id', orgData.active_organization_id)
          .lt('reminder_date', today)
          .eq('completed', false);

        // Generate simple HTML email
        const businessName = userSettings.photography_business_name || 'Your Photography Business';
        const brandColor = userSettings.primary_brand_color || '#1EB29F';
        const userName = profile?.full_name || 'there';
        
        const todaysCount = (sessions?.length || 0) + (activities?.length || 0);
        const overdueCount = (overdueSessions?.length || 0) + (overdueActivities?.length || 0);

        let emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${brandColor}; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">📸 Daily Summary</h1>
              <h2 style="margin: 10px 0 0 0; font-weight: normal;">${businessName}</h2>
            </div>
            
            <div style="padding: 20px; background: #f9f9f9;">
              <p>Good morning ${userName}! 👋</p>
              
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3 style="color: ${brandColor}; margin-top: 0;">📅 Today's Schedule</h3>
                ${todaysCount > 0 ? `
                  <p><strong>You have ${todaysCount} item(s) scheduled for today:</strong></p>
                  <ul>
                    ${sessions?.map(s => `<li>📸 Session: ${s.location || 'Location TBD'} at ${s.session_time || 'Time TBD'}</li>`).join('') || ''}
                    ${activities?.map(a => `<li>📋 Task: ${a.content} at ${a.reminder_time || 'All day'}</li>`).join('') || ''}
                  </ul>
                ` : '<p>✅ No sessions or tasks scheduled for today. Great time to catch up!</p>'}
              </div>

              ${overdueCount > 0 ? `
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ffc107;">
                  <h3 style="color: #856404; margin-top: 0;">⚠️ Overdue Items</h3>
                  <p>You have ${overdueCount} overdue item(s) that need attention:</p>
                  <ul>
                    ${overdueSessions?.map(s => `<li>📸 Session: ${s.location || 'Session'} from ${s.session_date}</li>`).join('') || ''}
                    ${overdueActivities?.map(a => `<li>📋 Task: ${a.content} from ${a.reminder_date}</li>`).join('') || ''}
                  </ul>
                </div>
              ` : ''}
              
              <div style="text-align: center; margin: 20px 0;">
                <a href="https://rifdykpdubrowzbylffe.supabase.co" style="background: ${brandColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  🚀 Open ${businessName}
                </a>
              </div>
              
              <p style="text-align: center; color: #666; font-size: 12px; margin-top: 30px;">
                You're receiving this because you have daily summaries enabled.<br>
                Update your notification preferences in your account settings.
              </p>
            </div>
          </div>
        `;

        // Send email using Resend
        console.log(`Sending daily summary to ${user.email}`);
        
        const emailResult = await resend.emails.send({
          from: `${businessName} <onboarding@resend.dev>`,
          to: [user.email],
          subject: `📸 Daily Summary for ${new Date().toLocaleDateString()}`,
          html: emailContent,
        });

        if (emailResult.error) {
          console.error('Resend error:', emailResult.error);
          errors++;
        } else {
          console.log(`Daily summary sent successfully to ${user.email}`, emailResult.data);
          processed++;
        }

      } catch (error) {
        console.error(`Error processing user ${userSettings.user_id}:`, error);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processed,
        errors,
        currentTime: currentTimeString,
        message: `Processed ${processed} daily summaries${errors > 0 ? `, ${errors} failed` : ''}`
      }),
      { 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error) {
    console.error('Error in simple daily notification processor:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
};

serve(handler);