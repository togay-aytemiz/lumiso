import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SupabaseClientLike {
  from(table: string): any;
  functions: {
    invoke(name: string, options: { body: Record<string, unknown> }): Promise<{ data?: unknown; error?: Error | null }>;
  };
}

interface HandlerDependencies {
  createClient?: () => SupabaseClientLike;
  getNow?: () => Date;
}

function createSupabaseClient(): SupabaseClientLike {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  ) as unknown as SupabaseClientLike;
}

export const handler = async (
  req: Request,
  deps: HandlerDependencies = {},
): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Daily notification scheduler started');

  const createClientFn = deps.createClient ?? createSupabaseClient;
  const getNow = deps.getNow ?? (() => new Date());

  try {
    const supabase = createClientFn();

    const now = getNow();
    const currentTime = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;

    console.log(`Current time: ${currentTime}`);

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
        processed: 0,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const userSettingsList = (userSettings ?? []) as Array<{
      user_id: string;
      active_organization_id: string;
      notification_scheduled_time: string;
    }>;

    const orgIds = [...new Set(userSettingsList.map((u) => u.active_organization_id))];
    const { data: orgs, error: orgDetailsError } = await supabase
      .from('organizations')
      .select('id, owner_id, name')
      .in('id', orgIds);

    if (orgDetailsError) {
      console.error('Error fetching organization details:', orgDetailsError);
      throw orgDetailsError;
    }

    console.log(`Found ${orgs?.length || 0} organizations to process`);

    const today = now.toISOString().split('T')[0];
    const scheduledFor = now.toISOString();
    const notifications: Array<Record<string, unknown>> = [];

    const orgsList = (orgs ?? []) as Array<{ id: string; owner_id: string; name: string }>;

    for (const userSetting of userSettingsList) {
      const org = orgsList.find((o) => o.id === userSetting.active_organization_id);
      if (!org) {
        console.log(`Organization ${userSetting.active_organization_id} not found`);
        continue;
      }

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

      notifications.push({
        organization_id: org.id,
        user_id: userSetting.user_id,
        notification_type: 'daily-summary',
        delivery_method: 'scheduled',
        scheduled_for: scheduledFor,
        metadata: {
          date: today,
          organization_name: org.name,
        },
        status: 'pending',
      });
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

      try {
        const { error: processorError } = await supabase.functions.invoke('notification-processor', {
          body: { action: 'process-pending' },
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
      users: userSettingsList.map((u) => u.user_id),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error('Error in schedule-daily-notifications:', error);
    return new Response(JSON.stringify({
      error: getErrorMessage(error),
      success: false,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

if (import.meta.main) {
  serve((req: Request) => handler(req));
}

export { corsHeaders };
