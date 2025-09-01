import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueueRequest {
  action: 'populate' | 'status' | 'clear' | 'test-send';
  organizationId?: string;
  notificationType?: 'daily_summary' | 'weekly_recap';
  force?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Manage notification queue function started');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, organizationId, notificationType = 'daily_summary', force = false }: QueueRequest = await req.json();
    console.log(`Queue action: ${action}, org: ${organizationId}, type: ${notificationType}`);

    // Create admin Supabase client
    const adminSupabase = createClient(
      'https://rifdykpdubrowzbylffe.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZmR5a3BkdWJyb3d6YnlsZmZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc5Nzk0MywiZXhwIjoyMDY5MzczOTQzfQ.pzP9NQhHt8Y9ZQfgD0GTaIRYLbUnDO9Wd0HhTYZJxIM'
    );

    let result;

    switch (action) {
      case 'populate':
        result = await populateNotificationQueue(adminSupabase, organizationId);
        break;
      
      case 'status':
        result = await getQueueStatus(adminSupabase, organizationId);
        break;
      
      case 'clear':
        result = await clearQueue(adminSupabase, organizationId);
        break;
      
      case 'test-send':
        result = await testSendNotification(adminSupabase, organizationId);
        break;
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      action,
      result 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in manage-notification-queue:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

async function populateNotificationQueue(supabase: any, organizationId?: string) {
  console.log('Populating notification queue...');
  
  // Get organizations with daily summary enabled
  let query = supabase
    .from('organization_settings')
    .select(`
      organization_id,
      notification_daily_summary_send_at,
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
    .eq('organizations.organization_members.status', 'active');

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data: organizations, error: orgsError } = await query;

  if (orgsError) {
    throw new Error(`Error fetching organizations: ${orgsError.message}`);
  }

  console.log(`Found ${organizations?.length || 0} organizations to process`);

  const scheduledNotifications = [];
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  for (const org of organizations || []) {
    // For each organization member, create a scheduled notification for tomorrow
    for (const member of org.organizations.organization_members) {
      const [hour, minute] = org.notification_daily_summary_send_at.split(':').map(Number);
      
      const scheduledFor = new Date(tomorrow);
      scheduledFor.setHours(hour, minute, 0, 0);

      scheduledNotifications.push({
        organization_id: org.organization_id,
        user_id: member.user_id,
        notification_type: 'daily_summary',
        scheduled_for: scheduledFor.toISOString()
      });
    }
  }

  if (scheduledNotifications.length > 0) {
    const { error: insertError } = await supabase
      .from('scheduled_notifications')
      .insert(scheduledNotifications);

    if (insertError) {
      throw new Error(`Error inserting notifications: ${insertError.message}`);
    }
  }

  return {
    organizations_processed: organizations?.length || 0,
    notifications_scheduled: scheduledNotifications.length,
    scheduled_for_date: tomorrow.toISOString().split('T')[0]
  };
}

async function getQueueStatus(supabase: any, organizationId?: string) {
  console.log('Getting queue status...');

  let query = supabase
    .from('scheduled_notifications')
    .select('status, notification_type');

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data: notifications, error } = await query;

  if (error) {
    throw new Error(`Error fetching queue status: ${error.message}`);
  }

  const status = {
    total: notifications?.length || 0,
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    by_type: {}
  };

  (notifications || []).forEach(notification => {
    status[notification.status]++;
    
    if (!status.by_type[notification.notification_type]) {
      status.by_type[notification.notification_type] = { pending: 0, processing: 0, sent: 0, failed: 0 };
    }
    status.by_type[notification.notification_type][notification.status]++;
  });

  // Get recent logs
  let logsQuery = supabase
    .from('notification_logs')
    .select('notification_type, status, sent_at, error_message')
    .order('sent_at', { ascending: false })
    .limit(10);

  if (organizationId) {
    logsQuery = logsQuery.eq('organization_id', organizationId);
  }

  const { data: recentLogs } = await logsQuery;

  return {
    queue: status,
    recent_logs: recentLogs || []
  };
}

async function clearQueue(supabase: any, organizationId?: string) {
  console.log('Clearing notification queue...');

  let query = supabase.from('scheduled_notifications');
  
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data: deleted, error } = await query.delete();

  if (error) {
    throw new Error(`Error clearing queue: ${error.message}`);
  }

  return {
    cleared_notifications: deleted?.length || 0,
    organization_id: organizationId || 'all'
  };
}

async function testSendNotification(supabase: any, organizationId?: string) {
  console.log('Test sending notification...');

  if (!organizationId) {
    throw new Error('Organization ID required for test send');
  }

  // Get an active member from the organization
  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (memberError || !member) {
    throw new Error('No active members found in organization');
  }

  // Call the process-scheduled-notifications function with force run
  const { data, error } = await supabase.functions.invoke('send-reminder-notifications', {
    body: { 
      type: 'daily-summary',
      isTest: true,
      organizationId: organizationId,
      userId: member.user_id
    }
  });

  if (error) {
    throw new Error(`Error sending test notification: ${error.message}`);
  }

  return {
    test_sent: true,
    organization_id: organizationId,
    user_id: member.user_id,
    result: data
  };
}

serve(handler);