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

    // Find organizations that should receive daily summaries at this time
    const { data: organizations, error: orgError } = await supabase
      .from('organization_settings')
      .select(`
        organization_id,
        notification_daily_summary_send_at,
        organizations!inner (
          owner_id,
          name
        )
      `)
      .eq('notification_global_enabled', true)
      .eq('notification_daily_summary_enabled', true)
      .eq('notification_daily_summary_send_at', currentTime);

    if (orgError) {
      console.error('Error fetching organizations:', orgError);
      throw orgError;
    }

    console.log(`Found ${organizations?.length || 0} organizations to process`);

    if (!organizations || organizations.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: `No organizations scheduled for ${currentTime}`,
        processed: 0 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Create daily summary notifications for each organization
    const today = new Date().toISOString().split('T')[0];
    const notifications = [];

    for (const org of organizations) {
      // Check if notification already exists for today
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('organization_id', org.organization_id)
        .eq('user_id', org.organizations.owner_id)
        .eq('notification_type', 'daily-summary')
        .gte('created_at', `${today}T00:00:00Z`)
        .lt('created_at', `${today}T23:59:59Z`)
        .single();

      if (existingNotification) {
        console.log(`Daily summary already exists for organization ${org.organization_id}`);
        continue;
      }

      // Create daily summary notification
      const notification = {
        organization_id: org.organization_id,
        user_id: org.organizations.owner_id,
        notification_type: 'daily-summary',
        delivery_method: 'scheduled',
        scheduled_for: new Date().toISOString(),
        metadata: {
          date: today,
          organization_name: org.organizations.name
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
      organizations: organizations.map(o => o.organization_id)
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