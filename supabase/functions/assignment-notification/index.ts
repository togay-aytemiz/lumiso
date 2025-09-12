import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AssignmentNotificationRequest {
  type: 'lead' | 'project';
  entity_id: string;
  entity_name: string;
  assignee_ids: string[];
  assigned_by_id: string;
  organization_id: string;
  action: 'assigned' | 'unassigned';
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Assignment notification processor started');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { 
      type, 
      entity_id, 
      entity_name, 
      assignee_ids, 
      assigned_by_id, 
      organization_id,
      action 
    }: AssignmentNotificationRequest = await req.json();

    console.log(`Processing ${action} notification for ${type}: ${entity_name}`);
    console.log(`Assignees: ${assignee_ids?.join(', ')}`);

    if (!assignee_ids || assignee_ids.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No assignees to notify' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get organization settings for branding
    const { data: orgSettings } = await supabaseAdmin
      .from('organization_settings')
      .select('photography_business_name, primary_brand_color, email')
      .eq('organization_id', organization_id)
      .maybeSingle();

    // Get assigned by user info
    const { data: assignedByProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('user_id', assigned_by_id)
      .maybeSingle();

    const { data: { user: assignedByUser } } = await supabaseAdmin.auth.admin.getUserById(assigned_by_id);
    
    const assignerName = assignedByProfile?.full_name || 
                        assignedByUser?.user_metadata?.full_name || 
                        assignedByUser?.email?.split('@')[0] || 'Team member';

    let successCount = 0;
    let errorCount = 0;

    // Process each assignee
    for (const assigneeId of assignee_ids) {
      try {
        // Get assignee profile and email
        const { data: assigneeProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('user_id', assigneeId)
          .maybeSingle();

        const { data: { user: assigneeUser } } = await supabaseAdmin.auth.admin.getUserById(assigneeId);
        
        if (!assigneeUser?.email) {
          console.error(`No email found for assignee: ${assigneeId}`);
          errorCount++;
          continue;
        }

        const assigneeName = assigneeProfile?.full_name || 
                            assigneeUser?.user_metadata?.full_name || 
                            assigneeUser?.email?.split('@')[0] || 'there';

        // Check user notification preferences
        const { data: userSettings } = await supabaseAdmin
          .from('user_settings')
          .select('notification_global_enabled, notification_new_assignment_enabled')
          .eq('user_id', assigneeId)
          .maybeSingle();

        if (!userSettings?.notification_global_enabled || !userSettings?.notification_new_assignment_enabled) {
          console.log(`Skipping notification for ${assigneeUser.email} - notifications disabled`);
          continue;
        }

        // Create notification email content
        const businessName = orgSettings?.photography_business_name || 'Lumiso';
        const brandColor = orgSettings?.primary_brand_color || '#1EB29F';
        
        const emailSubject = action === 'assigned' 
          ? `📋 You've been assigned to a ${type}: ${entity_name}`
          : `📋 You've been unassigned from ${type}: ${entity_name}`;

        const actionText = action === 'assigned' ? 'assigned to' : 'unassigned from';
        const actionIcon = action === 'assigned' ? '✅' : '❌';
        
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>${emailSubject}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; background-color: white; }
              .header { background: linear-gradient(135deg, ${brandColor}, ${brandColor}dd); color: white; padding: 30px; text-align: center; }
              .content { padding: 30px; }
              .assignment-card { background-color: #f8f9fa; border-left: 4px solid ${brandColor}; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
              .action-badge { display: inline-block; background-color: ${brandColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 15px; }
              .entity-name { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 10px; }
              .meta-info { color: #666; font-size: 14px; }
              .cta-button { display: inline-block; background-color: ${brandColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
              .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${actionIcon} ${action === 'assigned' ? 'New Assignment' : 'Assignment Removed'}</h1>
                <p>Hello ${assigneeName}!</p>
              </div>
              <div class="content">
                <div class="assignment-card">
                  <div class="action-badge">${action.toUpperCase()}</div>
                  <div class="entity-name">${entity_name}</div>
                  <div class="meta-info">
                    <strong>Type:</strong> ${type.charAt(0).toUpperCase() + type.slice(1)}<br>
                    <strong>${action === 'assigned' ? 'Assigned by' : 'Unassigned by'}:</strong> ${assignerName}<br>
                    <strong>Time:</strong> ${new Date().toLocaleString()}
                  </div>
                </div>
                
                <p>You have been <strong>${actionText}</strong> the ${type} "${entity_name}" by ${assignerName}.</p>
                
                ${action === 'assigned' ? `
                  <p>You can now access and manage this ${type} in your dashboard. Make sure to check any deadlines or requirements associated with it.</p>
                ` : `
                  <p>You no longer have access to this ${type}. If you have any questions about this change, please contact ${assignerName} or your team administrator.</p>
                `}
                
                <a href="https://my.lumiso.app/${type === 'lead' ? 'leads' : 'projects'}" class="cta-button">
                  View ${type === 'lead' ? 'Leads' : 'Projects'}
                </a>
              </div>
              <div class="footer">
                <p>This notification was sent by ${businessName}</p>
                <p>You can manage your notification preferences in your account settings.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        // Send notification email
        const emailResult = await resend.emails.send({
          from: `${businessName} <hello@updates.lumiso.app>`,
          to: [assigneeUser.email],
          subject: emailSubject,
          html: emailHtml,
        });

        if (emailResult.error) {
          console.error(`Resend error for ${assigneeUser.email}:`, emailResult.error);
          errorCount++;
        } else {
          console.log(`Assignment notification sent to ${assigneeUser.email}`, emailResult.data);
          successCount++;

          // Log the notification in the database
          await supabaseAdmin
            .from('notification_logs')
            .insert({
              organization_id,
              user_id: assigneeId,
              notification_type: 'assignment_notification',
              status: 'sent',
              email_id: emailResult.data?.id,
              metadata: {
                type,
                entity_id,
                entity_name,
                assigned_by_id,
                action
              }
            });
        }

      } catch (error) {
        console.error(`Error sending notification to assignee ${assigneeId}:`, error);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        sent: successCount,
        errors: errorCount,
        message: `Sent ${successCount} notifications${errorCount > 0 ? `, ${errorCount} failed` : ''}`
      }),
      { 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error) {
    console.error('Error in assignment notification processor:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
};

serve(handler);