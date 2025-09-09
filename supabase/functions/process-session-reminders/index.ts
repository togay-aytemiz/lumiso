import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  console.log('Session reminders processor started');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const processedReminders = await processScheduledReminders(adminSupabase);

    return new Response(JSON.stringify({
      success: true,
      processed_reminders: processedReminders,
      processed_at: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error processing session reminders:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

async function processScheduledReminders(supabase: any) {
  console.log('Processing scheduled session reminders');

  // Get reminders that are due to be sent (with 5 minute buffer for cron timing)
  const now = new Date();
  const bufferTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes ahead

  const { data: dueReminders, error: fetchError } = await supabase
    .from('scheduled_session_reminders')
    .select(`
      *,
      sessions!inner (
        id,
        session_date,
        session_time,
        location,
        notes,
        organization_id,
        leads!inner (
          id,
          name,
          email,
          phone,
          organization_id
        )
      ),
      workflows!inner (
        id,
        name,
        organization_id
      )
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', bufferTime.toISOString())
    .order('scheduled_for');

  if (fetchError) {
    console.error('Error fetching due reminders:', fetchError);
    throw fetchError;
  }

  if (!dueReminders || dueReminders.length === 0) {
    console.log('No reminders due for processing');
    return { processed: 0, triggered: 0, failed: 0 };
  }

  console.log(`Found ${dueReminders.length} reminders due for processing`);

  let processed = 0;
  let triggered = 0;
  let failed = 0;

  // Process each reminder
  for (const reminder of dueReminders) {
    try {
      console.log(`Processing reminder ${reminder.id} for session ${reminder.session_id}`);

      // Mark reminder as being processed
      await supabase
        .from('scheduled_session_reminders')
        .update({ 
          status: 'sent',
          processed_at: new Date().toISOString()
        })
        .eq('id', reminder.id);

      // Trigger the workflow executor for this session reminder
      const { error: triggerError } = await supabase.functions.invoke('workflow-executor', {
        body: {
          action: 'trigger',
          trigger_type: 'session_reminder',
          trigger_entity_type: 'session',
          trigger_entity_id: reminder.session_id,
          organization_id: reminder.organization_id,
          trigger_data: {
            reminder_type: reminder.reminder_type,
            session_data: {
              id: reminder.sessions.id,
              session_date: reminder.sessions.session_date,
              session_time: reminder.sessions.session_time,
              location: reminder.sessions.location,
              notes: reminder.sessions.notes
            },
            lead_data: {
              id: reminder.sessions.leads.id,
              name: reminder.sessions.leads.name,
              email: reminder.sessions.leads.email,
              phone: reminder.sessions.leads.phone
            },
            scheduled_reminder_id: reminder.id,
            workflow_id: reminder.workflow_id
          }
        }
      });

      if (triggerError) {
        console.error(`Error triggering workflow for reminder ${reminder.id}:`, triggerError);
        
        // Mark reminder as failed
        await supabase
          .from('scheduled_session_reminders')
          .update({ 
            status: 'failed',
            error_message: triggerError.message,
            processed_at: new Date().toISOString()
          })
          .eq('id', reminder.id);
        
        failed++;
      } else {
        console.log(`Successfully triggered workflow for reminder ${reminder.id}`);
        triggered++;
      }

      processed++;

    } catch (error) {
      console.error(`Error processing reminder ${reminder.id}:`, error);
      
      // Mark reminder as failed
      try {
        await supabase
          .from('scheduled_session_reminders')
          .update({ 
            status: 'failed',
            error_message: error.message,
            processed_at: new Date().toISOString()
          })
          .eq('id', reminder.id);
      } catch (updateError) {
        console.error(`Failed to update reminder ${reminder.id} status:`, updateError);
      }
      
      failed++;
      processed++;
    }
  }

  // Clean up old reminders
  try {
    const { data: cleanupResult, error: cleanupError } = await supabase.rpc('cleanup_old_session_reminders');
    if (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    } else {
      console.log(`Cleaned up ${cleanupResult || 0} old reminders`);
    }
  } catch (cleanupError) {
    console.error('Cleanup failed:', cleanupError);
  }

  console.log(`Processed ${processed} reminders: ${triggered} triggered, ${failed} failed`);
  
  return { processed, triggered, failed };
}

serve(handler);