import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  type: 'daily-summary' | 'weekly-recap';
  forceRun?: boolean; // For testing purposes
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Process scheduled notifications function started');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, forceRun = false }: NotificationRequest = await req.json();
    console.log(`Processing ${type} notifications, force run: ${forceRun}`);

    // Create admin Supabase client for unrestricted access
    const adminSupabase = createClient(
      'https://rifdykpdubrowzbylffe.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc5Nzk0MywiZXhwIjoyMDY5MzczOTQzfQ.pzP9NQhHt8Y9ZQfgD0GTaIRYLbUnDO9Wd0HhTYZJxIM'
    );

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    
    // Calculate time window (15-minute windows)
    const windowStart = Math.floor(currentMinutes / 15) * 15;
    const windowEnd = windowStart + 14;
    
    console.log(`Current time: ${currentHour}:${String(currentMinutes).padStart(2, '0')}`);
    console.log(`Processing window: ${currentHour}:${String(windowStart).padStart(2, '0')} - ${currentHour}:${String(windowEnd).padStart(2, '0')}`);

    if (type === 'daily-summary') {
      await processDailySummaryNotifications(adminSupabase, currentHour, windowStart, windowEnd, forceRun);
    } else if (type === 'weekly-recap') {
      await processWeeklyRecapNotifications(adminSupabase, currentHour, windowStart, windowEnd, forceRun);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed_at: now.toISOString(),
      type,
      window: `${currentHour}:${String(windowStart).padStart(2, '0')}-${currentHour}:${String(windowEnd).padStart(2, '0')}`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in process-scheduled-notifications:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

async function processDailySummaryNotifications(
  supabase: any, 
  currentHour: number, 
  windowStart: number, 
  windowEnd: number,
  forceRun: boolean
) {
  console.log('Processing daily summary notifications...');

  // Find organizations with daily summary enabled for the current time window
  const timePattern = `${String(currentHour).padStart(2, '0')}:%`;
  
  const { data: organizations, error: orgsError } = await supabase
    .from('organization_settings')
    .select(`
      organization_id,
      notification_scheduled_time,
      organizations!inner(
        id,
        owner_id,
        organization_members!inner(
          user_id,
          status
        )
      )
    `)
    .eq('notification_daily_summary_enabled', true)
    .eq('organizations.organization_members.status', 'active')
    .like('notification_scheduled_time', timePattern);

  if (orgsError) {
    console.error('Error fetching organizations:', orgsError);
    return;
  }

  console.log(`Found ${organizations?.length || 0} organizations with daily summary enabled`);

  if (!organizations || organizations.length === 0) {
    return;
  }

  // Filter organizations by time window
  const eligibleOrgs = organizations.filter(org => {
    const [hour, minute] = org.notification_scheduled_time.split(':').map(Number);
    return hour === currentHour && minute >= windowStart && minute <= windowEnd;
  });

  console.log(`${eligibleOrgs.length} organizations in current time window`);

  if (eligibleOrgs.length === 0 && !forceRun) {
    return;
  }

  // Process in batches of 10 organizations at a time
  const batchSize = 10;
  const orgsToProcess = forceRun ? organizations : eligibleOrgs;

  for (let i = 0; i < orgsToProcess.length; i += batchSize) {
    const batch = orgsToProcess.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(orgsToProcess.length / batchSize)}`);
    
    await Promise.all(batch.map(org => processSingleDailySummary(supabase, org)));
    
    // Small delay between batches to prevent overwhelming the system
    if (i + batchSize < orgsToProcess.length) {
      await new Delay(1000);
    }
  }
}

async function processSingleDailySummary(supabase: any, organization: any) {
  console.log(`Processing daily summary for organization: ${organization.organization_id}`);

  try {
    // Check if we already sent a notification today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingLog } = await supabase
      .from('notification_logs')
      .select('id')
      .eq('organization_id', organization.organization_id)
      .eq('notification_type', 'daily_summary')
      .gte('sent_at', `${today}T00:00:00Z`)
      .lt('sent_at', `${today}T23:59:59Z`)
      .eq('status', 'success')
      .maybeSingle();

    if (existingLog) {
      console.log(`Daily summary already sent today for org ${organization.organization_id}`);
      return;
    }

    // Get organization members to send notifications to
    const { data: members, error: membersError } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organization.organization_id)
      .eq('status', 'active');

    if (membersError || !members || members.length === 0) {
      console.log(`No active members found for org ${organization.organization_id}`);
      return;
    }

    // Process each member
    for (const member of members) {
      await sendDailySummaryToUser(supabase, organization.organization_id, member.user_id);
    }

  } catch (error) {
    console.error(`Error processing daily summary for org ${organization.organization_id}:`, error);
    
    // Log the failure
    await supabase
      .from('notification_logs')
      .insert({
        organization_id: organization.organization_id,
        user_id: organization.organizations.owner_id,
        notification_type: 'daily_summary',
        status: 'failed',
        error_message: error.message
      });
  }
}

async function sendDailySummaryToUser(supabase: any, organizationId: string, userId: string) {
  try {
    console.log(`Sending daily summary to user ${userId} in org ${organizationId}`);

    // Call the existing send-reminder-notifications function
    const { data, error } = await supabase.functions.invoke('send-reminder-notifications', {
      body: { 
        type: 'daily-summary',
        isTest: false,
        organizationId: organizationId,
        userId: userId
      },
      headers: {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc5Nzk0MywiZXhwIjoyMDY5MzczOTQzfQ.pzP9NQhHt8Y9ZQfgD0GTaIRYLbUnDO9Wd0HhTYZJxIM`
      }
    });

    if (error) {
      console.error(`Error sending daily summary to user ${userId}:`, error);
      
      // Log the failure
      await supabase
        .from('notification_logs')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          notification_type: 'daily_summary',
          status: 'failed',
          error_message: error.message
        });
    } else {
      console.log(`Daily summary sent successfully to user ${userId}`);
      
      // Log the success
      await supabase
        .from('notification_logs')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          notification_type: 'daily_summary',
          status: 'success',
          email_id: data?.id || null
        });
    }

  } catch (error: any) {
    console.error(`Error in sendDailySummaryToUser for user ${userId}:`, error);
    
    // Log the failure
    await supabase
      .from('notification_logs')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        notification_type: 'daily_summary',
        status: 'failed',
        error_message: error.message
      });
  }
}

async function processWeeklyRecapNotifications(
  supabase: any, 
  currentHour: number, 
  windowStart: number, 
  windowEnd: number,
  forceRun: boolean
) {
  console.log('Weekly recap notifications not yet implemented');
  // TODO: Implement weekly recap processing similar to daily summary
}

class Delay {
  constructor(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

serve(handler);