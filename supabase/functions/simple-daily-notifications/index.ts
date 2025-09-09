import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Resend } from "npm:resend@2.0.0";
import { generateModernDailySummaryEmail } from './_templates/enhanced-daily-summary-modern.ts';
import { generateEmptyDailySummaryEmail } from './_templates/enhanced-daily-summary-empty.ts';

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
        primary_brand_color,
        date_format,
        time_format,
        active_organization_id
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
        
        // Get user profile for full name
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

        console.log(`Authenticated user: ${user.email}`);

        // Use active organization from user settings
        const organizationId = userSettings.active_organization_id;
        
        if (!organizationId) {
          console.error('No active organization found for user');
          continue;
        }

        console.log('Organization ID:', organizationId);

        // Extract user's full name
        const userFullName = profile?.full_name || 
                             user.user_metadata?.full_name || 
                             user.email?.split('@')[0] || 'there';
        console.log(`User full name: ${userFullName}`);

        // Get today's date
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        console.log(`Today's date: ${todayStr}`);

        // Get today's sessions with comprehensive data
        const { data: todaySessions, error: todaySessionsError } = await supabaseAdmin
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

        // Get past sessions that need action
        const { data: pastSessions, error: pastSessionsError } = await supabaseAdmin
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
          .order('session_date', { ascending: false })
          .limit(10); // Limit past sessions

        // Get overdue activities
        const { data: overdueActivities, error: overdueError } = await supabaseAdmin
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

        // Get today's activities/reminders
        console.log(`Searching for today's reminders on date: ${todayStr}`);
        
        const { data: todayActivities, error: todayActivitiesError } = await supabaseAdmin
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

        // Fetch lead and project names for today's activities
        const todayActivitiesWithNames = [];
        if (todayActivities && todayActivities.length > 0) {
          for (const activity of todayActivities) {
            let leadName = null;
            let projectName = null;

            // Fetch lead name if lead_id exists
            if (activity.lead_id) {
              const { data: lead } = await supabaseAdmin
                .from('leads')
                .select('name')
                .eq('id', activity.lead_id)
                .maybeSingle();
              leadName = lead?.name || null;
            }

            // Fetch project name if project_id exists
            if (activity.project_id) {
              const { data: project } = await supabaseAdmin
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

        // Get organization settings for branding
        const { data: orgSettings } = await supabaseAdmin
          .from('organization_settings')
          .select('photography_business_name, primary_brand_color, date_format, time_format')
          .eq('organization_id', organizationId)
          .maybeSingle();

        // Use Lumiso logo
        console.log('Using Lumiso logo from: https://my.lumiso.app/lumiso-logo.png');

        console.log('Data fetched:', {
          todaySessions: todaySessions?.length || 0,
          pastSessions: pastSessions?.length || 0,
          overdueActivities: overdueActivities?.length || 0,
          todayActivities: todayActivities?.length || 0,
          pendingTodos: 0
        });

        console.log('Today activities data:', todayActivities);
        console.log('Past sessions data:', pastSessions);

        // Prepare data for enhanced email template (same as test system)
        const templateData = {
          userFullName,
          businessName: orgSettings?.photography_business_name || userSettings?.photography_business_name || 'Lumiso',
          brandColor: orgSettings?.primary_brand_color || userSettings?.primary_brand_color || '#1EB29F',
          dateFormat: orgSettings?.date_format || userSettings?.date_format || 'DD/MM/YYYY',
          timeFormat: orgSettings?.time_format || userSettings?.time_format || '12-hour',
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

        // Generate enhanced email content using the same templates as test system
        let emailHtml: string;
        let emailSubject: string;
        const todayFormatted = today.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        });

        if (sessions.length === 0 && todayReminders.length === 0) {
          // Use empty template when no sessions or reminders
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

        // Send email using Resend with EXACT same sender and subject as test system
        console.log(`Sending daily summary to ${user.email}`);
        
        const emailResult = await resend.emails.send({
          from: 'Lumiso <hello@updates.lumiso.app>', // Same sender as test system
          to: [user.email],
          subject: emailSubject, // Same subject format as test system
          html: emailHtml,
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