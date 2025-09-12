import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MilestoneNotificationRequest {
  type: 'lead' | 'project' | 'session';
  entity_id: string;
  entity_name: string;
  old_status?: string;
  new_status: string;
  changed_by_id: string;
  organization_id: string;
  assignee_ids?: string[];
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Milestone notification processor started');
  
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
      old_status,
      new_status, 
      changed_by_id, 
      organization_id,
      assignee_ids
    }: MilestoneNotificationRequest = await req.json();

    console.log(`Processing milestone notification for ${type}: ${entity_name}`);
    console.log(`Status changed from "${old_status}" to "${new_status}"`);

    // Get entity details to find assignees if not provided
    let notifyUserIds: string[] = assignee_ids || [];
    
    if (!assignee_ids || assignee_ids.length === 0) {
      if (type === 'lead') {
        const { data: lead } = await supabaseAdmin
          .from('leads')
          .select('assignees, user_id')
          .eq('id', entity_id)
          .maybeSingle();
        
        notifyUserIds = [...(lead?.assignees || []), lead?.user_id].filter(Boolean);
      } else if (type === 'project') {
        const { data: project } = await supabaseAdmin
          .from('projects')
          .select('assignees, user_id')
          .eq('id', entity_id)
          .maybeSingle();
        
        notifyUserIds = [...(project?.assignees || []), project?.user_id].filter(Boolean);
      }
    }

    // Remove duplicates and the person who made the change
    notifyUserIds = [...new Set(notifyUserIds)].filter(id => id !== changed_by_id);

    if (notifyUserIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No assignees to notify' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`Notifying users: ${notifyUserIds.join(', ')}`);

    // Get organization settings for branding
    const { data: orgSettings } = await supabaseAdmin
      .from('organization_settings')
      .select('photography_business_name, primary_brand_color')
      .eq('organization_id', organization_id)
      .maybeSingle();

    // Get who made the change
    const { data: changedByProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('user_id', changed_by_id)
      .maybeSingle();

    const { data: { user: changedByUser } } = await supabaseAdmin.auth.admin.getUserById(changed_by_id);
    
    const changerName = changedByProfile?.full_name || 
                       changedByUser?.user_metadata?.full_name || 
                       changedByUser?.email?.split('@')[0] || 'Team member';

    let successCount = 0;
    let errorCount = 0;

    // Process each user to notify
    for (const userId of notifyUserIds) {
      try {
        // Get user profile and email
        const { data: userProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('user_id', userId)
          .maybeSingle();

        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (!user?.email) {
          console.error(`No email found for user: ${userId}`);
          errorCount++;
          continue;
        }

        const userName = userProfile?.full_name || 
                        user?.user_metadata?.full_name || 
                        user?.email?.split('@')[0] || 'there';

        // Check user notification preferences
        const { data: userSettings } = await supabaseAdmin
          .from('user_settings')
          .select('notification_global_enabled, notification_project_milestone_enabled')
          .eq('user_id', userId)
          .maybeSingle();

        if (!userSettings?.notification_global_enabled || !userSettings?.notification_project_milestone_enabled) {
          console.log(`Skipping notification for ${user.email} - milestone notifications disabled`);
          continue;
        }

        // Determine if this is a completion milestone
        const isCompletion = new_status.toLowerCase().includes('completed') || 
                           new_status.toLowerCase().includes('delivered') ||
                           new_status.toLowerCase().includes('done');

        const isStarted = new_status.toLowerCase().includes('progress') || 
                         new_status.toLowerCase().includes('started') ||
                         new_status.toLowerCase().includes('active');

        let milestoneIcon = '📊';
        let milestoneType = 'Status Update';
        
        if (isCompletion) {
          milestoneIcon = '🎉';
          milestoneType = 'Completion';
        } else if (isStarted) {
          milestoneIcon = '🚀';
          milestoneType = 'Started';
        }

        // Create notification email content
        const businessName = orgSettings?.photography_business_name || 'Lumiso';
        const brandColor = orgSettings?.primary_brand_color || '#1EB29F';
        
        const emailSubject = `${milestoneIcon} ${milestoneType}: ${entity_name}`;

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
              .milestone-card { background-color: #f8f9fa; border-left: 4px solid ${brandColor}; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
              .status-change { display: flex; align-items: center; gap: 15px; margin: 15px 0; }
              .status-badge { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
              .old-status { background-color: #e9ecef; color: #6c757d; }
              .new-status { background-color: ${brandColor}; color: white; }
              .arrow { color: ${brandColor}; font-weight: bold; }
              .entity-name { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 10px; }
              .meta-info { color: #666; font-size: 14px; }
              .cta-button { display: inline-block; background-color: ${brandColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
              .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
              .celebration { background: linear-gradient(45deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3); background-size: 400% 400%; animation: gradient 3s ease infinite; }
              @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header ${isCompletion ? 'celebration' : ''}">
                <h1>${milestoneIcon} ${milestoneType}</h1>
                <p>Hello ${userName}!</p>
              </div>
              <div class="content">
                <div class="milestone-card">
                  <div class="entity-name">${entity_name}</div>
                  <div class="meta-info">
                    <strong>Type:</strong> ${type.charAt(0).toUpperCase() + type.slice(1)}<br>
                    <strong>Updated by:</strong> ${changerName}<br>
                    <strong>Time:</strong> ${new Date().toLocaleString()}
                  </div>
                  
                  ${old_status ? `
                    <div class="status-change">
                      <span class="status-badge old-status">${old_status}</span>
                      <span class="arrow">→</span>
                      <span class="status-badge new-status">${new_status}</span>
                    </div>
                  ` : `
                    <div style="margin: 15px 0;">
                      <span class="status-badge new-status">${new_status}</span>
                    </div>
                  `}
                </div>
                
                ${isCompletion ? `
                  <p>🎉 <strong>Congratulations!</strong> The ${type} "${entity_name}" has been completed by ${changerName}. Great work everyone!</p>
                ` : isStarted ? `
                  <p>🚀 The ${type} "${entity_name}" has been started by ${changerName}. Let's make great progress on this!</p>
                ` : `
                  <p>The ${type} "${entity_name}" status has been updated to "${new_status}" by ${changerName}.</p>
                `}
                
                <a href="https://my.lumiso.app/${type === 'lead' ? 'leads' : type === 'project' ? 'projects' : 'sessions'}" class="cta-button">
                  View ${type.charAt(0).toUpperCase() + type.slice(1)}
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
          to: [user.email],
          subject: emailSubject,
          html: emailHtml,
        });

        if (emailResult.error) {
          console.error(`Resend error for ${user.email}:`, emailResult.error);
          errorCount++;
        } else {
          console.log(`Milestone notification sent to ${user.email}`, emailResult.data);
          successCount++;

          // Log the notification in the database
          await supabaseAdmin
            .from('notification_logs')
            .insert({
              organization_id,
              user_id: userId,
              notification_type: 'milestone_notification',
              status: 'sent',
              email_id: emailResult.data?.id,
              metadata: {
                type,
                entity_id,
                entity_name,
                old_status,
                new_status,
                changed_by_id
              }
            });
        }

      } catch (error) {
        console.error(`Error sending notification to user ${userId}:`, error);
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
    console.error('Error in milestone notification processor:', error);
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