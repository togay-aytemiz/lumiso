import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  getErrorMessage,
  getErrorStack,
} from "../_shared/error-utils.ts";

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const handler = async (req: Request): Promise<Response> => {
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

  } catch (error: unknown) {
    console.error('Error processing session reminders:', error);
    return new Response(JSON.stringify({
      error: getErrorMessage(error),
      stack: getErrorStack(error),
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

export async function processScheduledReminders(supabase: any) {
  console.log('Processing scheduled session reminders');

  // Get reminders that are due to be sent (exact timing, no early processing buffer)
  const now = new Date();

  console.log(`Processing reminders scheduled at or before: ${now.toISOString()}`);

  const { data: dueReminders, error: fetchError } = await supabase
    .from('scheduled_session_reminders')
    .select(`
      *,
      sessions!fk_scheduled_session_reminders_session_id (
        id,
        session_date,
        session_time,
        session_type_id,
        session_types:session_type_id (
          id,
          name,
          duration_minutes
        ),
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
      workflows!fk_scheduled_session_reminders_workflow_id (
        id,
        name,
        organization_id
      )
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', now.toISOString())
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
      console.log(`Processing reminder ${reminder.id} for session ${reminder.session_id}, type: ${reminder.reminder_type}`);
      
      // Verify session data before processing
      if (!reminder.sessions || !reminder.sessions.leads) {
        console.error(`Invalid session or lead data for reminder ${reminder.id}`);
        await supabase
          .from('scheduled_session_reminders')
          .update({ 
            status: 'failed',
            error_message: 'Invalid session or lead data',
            processed_at: new Date().toISOString()
          })
          .eq('id', reminder.id);
        failed++;
        processed++;
        continue;
      }

      console.log(
        `Session data: ${reminder.sessions.session_date} ${reminder.sessions.session_time}, Lead: ${reminder.sessions.leads.name}`,
      );

      // Mark reminder as being processed first to prevent duplicate processing
      const { error: updateError } = await supabase
        .from('scheduled_session_reminders')
        .update({ 
          status: 'sent',
          processed_at: new Date().toISOString()
        })
        .eq('id', reminder.id)
        .eq('status', 'pending'); // Only update if still pending

      if (updateError) {
        console.error(`Error updating reminder ${reminder.id}:`, updateError);
        failed++;
        processed++;
        continue;
      }

      // Trigger the workflow executor for this session reminder with explicit session validation
      console.log(`Triggering workflow for session ${reminder.session_id} (${reminder.sessions.session_date} ${reminder.sessions.session_time})`);
      console.log(`Processing reminder type: ${reminder.reminder_type} scheduled for: ${reminder.scheduled_for}`);
      console.log(`Current time: ${now.toISOString()}, Reminder due: ${reminder.scheduled_for}`);
      
      const { error: triggerError } = await supabase.functions.invoke('workflow-executor', {
        body: {
          action: 'trigger',
          trigger_type: 'session_reminder',
          trigger_entity_type: 'session',
          trigger_entity_id: reminder.session_id, // This MUST match the session in the reminder
          organization_id: reminder.organization_id,
          trigger_data: {
            reminder_type: reminder.reminder_type,
            // Pass the exact session data we retrieved to ensure consistency
            session_data: {
              id: reminder.sessions.id,
              session_date: reminder.sessions.session_date,
              session_time: reminder.sessions.session_time,
              location: reminder.sessions.location,
              notes: reminder.sessions.notes,
              session_type_id: reminder.sessions.session_type_id,
              session_type_name: reminder.sessions.session_types?.name ?? null,
              session_type_duration_minutes: reminder.sessions.session_types?.duration_minutes ?? null
            },
            lead_data: {
              id: reminder.sessions.leads.id,
              name: reminder.sessions.leads.name,
              email: reminder.sessions.leads.email,
              phone: reminder.sessions.leads.phone
            },
            scheduled_reminder_id: reminder.id,
            workflow_id: reminder.workflow_id,
            // Add debug info to ensure correct session is used
            debug_session_validation: {
              expected_session_id: reminder.session_id,
              actual_session_date: reminder.sessions.session_date,
              actual_session_time: reminder.sessions.session_time,
              lead_name: reminder.sessions.leads.name,
              reminder_type: reminder.reminder_type,
              scheduled_for: reminder.scheduled_for
            }
          }
        }
      });

      if (triggerError) {
        const triggerErrorMessage = getErrorMessage(triggerError);
        console.error(`Error triggering workflow for reminder ${reminder.id}:`, triggerError);
        
        // Mark reminder as failed and record error
        await supabase
          .from('scheduled_session_reminders')
          .update({ 
            status: 'failed',
            error_message: triggerErrorMessage,
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
            error_message: getErrorMessage(error),
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
