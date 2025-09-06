import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Daily notification scheduler started');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current time in format HH:MM
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    console.log(`Current time: ${currentTime}`);

    // Find users that should receive daily summaries at this time
    const { data: userSettings, error: userError } = await supabase
      .from('user_settings')
      .select(`
        user_id,
        active_organization_id,
        notification_scheduled_time
      `)
      .eq('notification_global_enabled', true)
      .eq('notification_daily_summary_enabled', true)
      .eq('notification_scheduled_time', currentTime)
      .not('active_organization_id', 'is', null);

    if (userError) {
      console.error('Error fetching user settings:', userError);
      throw userError;
    }

    console.log(`Found ${userSettings?.length || 0} user settings to process`);

    if (!userSettings || userSettings.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: `No users scheduled for ${currentTime}`,
        processed: 0 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get organization details for each user's active org
    const orgIds = [...new Set(userSettings.map(u => u.active_organization_id))];
    const { data: orgs, error: orgDetailsError } = await supabase
      .from('organizations')
      .select('id, owner_id, name')
      .in('id', orgIds);

    if (orgDetailsError) {
      console.error('Error fetching organization details:', orgDetailsError);
      throw orgDetailsError;
    }

    console.log(`Found ${orgs?.length || 0} organizations to process`);

    // Create daily summary notifications for each user
    const today = new Date().toISOString().split('T')[0];
    const notifications = [];

    for (const userSetting of userSettings) {
      const org = orgs?.find(o => o.id === userSetting.active_organization_id);
      if (!org) {
        console.log(`Organization ${userSetting.active_organization_id} not found`);
        continue;
      }

      // Check if notification already exists for today
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('organization_id', org.id)
        .eq('user_id', userSetting.user_id)
        .eq('notification_type', 'daily-summary')
        .gte('created_at', `${today}T00:00:00Z`)
        .lt('created_at', `${today}T23:59:59Z`)
        .maybeSingle();

      if (existingNotification) {
        console.log(`Daily summary already exists for user ${userSetting.user_id} in organization ${org.id}`);
        continue;
      }

      // Create daily summary notification
      const notification = {
        organization_id: org.id,
        user_id: userSetting.user_id,
        notification_type: 'daily-summary',
        delivery_method: 'scheduled',
        scheduled_for: new Date().toISOString(),
        metadata: {
          date: today,
          organization_name: org.name
        },
        status: 'pending'
      };

      notifications.push(notification);
    }

    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('Error inserting notifications:', insertError);
        throw insertError;
      }

      console.log(`Created ${notifications.length} daily summary notifications`);

      // Trigger the notification processor to process these
      try {
        const { error: processorError } = await supabase.functions.invoke('notification-processor', {
          body: { action: 'process-pending' }
        });

        if (processorError) {
          console.error('Error triggering notification processor:', processorError);
        } else {
          console.log('Successfully triggered notification processor');
        }
      } catch (processorError) {
        console.error('Failed to trigger notification processor:', processorError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: notifications.length,
      users: userSettings.map(u => u.user_id)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('Error in schedule-daily-notifications:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});