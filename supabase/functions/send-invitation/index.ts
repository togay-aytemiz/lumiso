import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  role: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Parse body once and reuse (avoid Body already consumed errors)
  let requestBody: InvitationRequest | null = null;

  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    // Get the user from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    requestBody = await req.json();
    const { email, role }: InvitationRequest = requestBody;

    // Enhanced input validation with database function
    if (!email || !role) {
      throw new Error("Email and role are required");
    }

    // Get user's active organization from user_settings first (needed for validation)
    const { data: userSettings, error: settingsError } = await supabase
      .from("user_settings")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .single();

    if (settingsError || !userSettings?.active_organization_id) {
      throw new Error("No active organization found. Please contact support.");
    }

    const organizationId = userSettings.active_organization_id;

    // Validate email using database function
    const { data: emailValidation, error: validationError } = await supabase
      .rpc('validate_invitation_email', { email_param: email });

    if (validationError) {
      throw new Error("Email validation failed");
    }

    if (!emailValidation.valid) {
      throw new Error(emailValidation.error);
    }

    const normalizedEmail = emailValidation.normalized_email;

    // Validate role (include custom roles and role templates)
    const validSystemRoles = ['Owner', 'Member', 'Full Admin', 'Manager', 'Photographer', 'Organizer'];
    let isValidRole = validSystemRoles.includes(role);
    
    // Check if it's a role template
    if (!isValidRole) {
      const { data: roleTemplate } = await supabase
        .from('role_templates')
        .select('id')
        .eq('name', role)
        .maybeSingle();
      
      isValidRole = !!roleTemplate;
    }
    
    // Check if it's a custom role
    if (!isValidRole) {
      const { data: customRole } = await supabase
        .from('custom_roles')
        .select('id')
        .eq('name', role)
        .eq('organization_id', organizationId)
        .maybeSingle();
      
      isValidRole = !!customRole;
    }

    if (!isValidRole) {
      throw new Error("Invalid role specified");
    }

    // Check rate limiting first
    const { data: rateLimitCheck, error: rateLimitError } = await supabase.rpc('check_invitation_rate_limit', {
      user_uuid: user.id,
      org_id: organizationId
    });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      // Log the failed attempt
      await supabase.rpc('log_invitation_attempt', {
        user_uuid: user.id,
        email_param: normalizedEmail,
        org_id: organizationId,
        success: false,
        error_message: 'Rate limit check failed'
      });
      throw new Error("Unable to verify rate limits. Please try again.");
    }

    if (!rateLimitCheck) {
      // Log the rate limited attempt
      await supabase.rpc('log_invitation_attempt', {
        user_uuid: user.id,
        email_param: normalizedEmail,
        org_id: organizationId,
        success: false,
        error_message: 'Rate limit exceeded'
      });
      throw new Error("Rate limit exceeded. Maximum 10 invitations per hour.");
    }

    // Check if user is owner of this organization
    const { data: orgMember, error: memberError } = await supabase
      .from("organization_members")
      .select("system_role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .eq("system_role", "Owner")
      .maybeSingle();

    if (memberError || !orgMember) {
      throw new Error("Only organization owners can send invitations");
    }

    // Skip checking inviter membership. Membership-by-email is validated during acceptance.


    const { data: existingInvite } = await supabase
      .from("invitations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", normalizedEmail)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString());

    if (existingInvite?.length) {
      throw new Error("There is already a pending invitation for this email address");
    }

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .insert({
        organization_id: organizationId,
        email: normalizedEmail,
        role,
        invited_by: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .select()
      .single();

    if (inviteError) {
      throw inviteError;
    }


    // Get inviter's profile information
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();

    const inviterName = profile?.full_name || user.email || "Team member";
    
    // Create invitation link using production domain
    const productionDomain = Deno.env.get('PRODUCTION_DOMAIN');
    const baseUrl = productionDomain || req.headers.get('origin') || 'http://localhost:5173';
    const inviteLink = `${baseUrl}/accept-invite?invitation_id=${invitation.id}`;
    
    // Get organization settings for branding
    const { data: orgSettings } = await supabase
      .from("organization_settings")
      .select("photography_business_name, primary_brand_color")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const businessName = orgSettings?.photography_business_name || "Lumiso";
    const brandColor = orgSettings?.primary_brand_color || "#1EB29F";

    // Send invitation email using modern template design
    const emailResponse = await resend.emails.send({
      from: "Lumiso <hello@updates.lumiso.app>",
      to: [email],
      subject: `🎉 You're invited to join ${businessName}!`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, ${brandColor}, ${brandColor}DD); padding: 40px 32px; text-align: center;">
            <div style="background: rgba(255, 255, 255, 0.15); padding: 16px; border-radius: 12px; display: inline-block; backdrop-filter: blur(10px);">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">
                🎉 Team Invitation
              </h1>
            </div>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 32px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 28px; font-weight: 700;">
                Welcome to the team!
              </h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">
                You've been invited to collaborate on amazing photography projects
              </p>
            </div>

            <div style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); border-radius: 16px; padding: 24px; margin: 32px 0; border-left: 4px solid ${brandColor};">
              <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.6;">
                <strong style="color: ${brandColor};">${inviterName}</strong> has invited you to join <strong>${businessName}</strong> as a <strong style="color: ${brandColor};">${role}</strong>.
              </p>
              
              <div style="background: white; border-radius: 8px; padding: 16px; margin-top: 16px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 14px;">
                  <div>
                    <span style="color: #6b7280; display: block; margin-bottom: 4px;">Role</span>
                    <strong style="color: #1f2937;">${role}</strong>
                  </div>
                  <div>
                    <span style="color: #6b7280; display: block; margin-bottom: 4px;">Invited by</span>
                    <strong style="color: #1f2937;">${inviterName}</strong>
                  </div>
                </div>
                <div style="margin-top: 12px;">
                  <span style="color: #6b7280; display: block; margin-bottom: 4px; font-size: 14px;">Expires</span>
                  <strong style="color: #dc2626;">${new Date(invitation.expires_at).toLocaleDateString()}</strong>
                </div>
              </div>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 40px 0;">
              <a href="${inviteLink}" 
                 style="background: linear-gradient(135deg, ${brandColor}, ${brandColor}CC); 
                        color: white; 
                        text-decoration: none; 
                        padding: 16px 32px; 
                        border-radius: 12px; 
                        font-weight: 600; 
                        font-size: 16px;
                        display: inline-block;
                        box-shadow: 0 8px 25px rgba(30, 178, 159, 0.3);
                        transition: all 0.3s ease;">
                Accept Invitation →
              </a>
            </div>
            
            <div style="text-align: center; padding: 20px; background: #f9fafb; border-radius: 12px; margin: 32px 0;">
              <p style="color: #6b7280; margin: 0; font-size: 14px; line-height: 1.5;">
                ⏰ This invitation expires in 7 days<br>
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 12px;">
              Having trouble with the button? Copy and paste this link:
            </p>
            <p style="margin: 0;">
              <a href="${inviteLink}" style="color: ${brandColor}; font-size: 12px; word-break: break-all;">${inviteLink}</a>
            </p>
          </div>
        </div>
      `,
    });

    console.log("Invitation email sent successfully:", emailResponse);

    // Send confirmation email to the inviter using unified modern template
    const confirmationEmailHtml = `
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="
          display: inline-block;
          background: linear-gradient(135deg, ${brandColor}, ${brandColor}dd); 
          color: white; 
          padding: 12px 24px; 
          border-radius: 25px; 
          font-weight: 600; 
          font-size: 16px;
          margin-bottom: 24px;
          box-shadow: 0 4px 12px rgba(30, 178, 159, 0.25);
        ">
          ✓ Invitation Sent
        </div>
        <h2 style="
          color: #1f2937; 
          margin: 0 0 16px 0; 
          font-size: 28px; 
          font-weight: 700;
          line-height: 1.2;
        ">
          Your invitation was sent successfully!
        </h2>
        <p style="
          color: #6b7280; 
          margin: 0; 
          font-size: 16px; 
          line-height: 1.6;
        ">
          We've notified your new team member about joining ${businessName}
        </p>
      </div>

      <div style="
        background: #f8fafc;
        border-radius: 12px;
        padding: 24px;
        margin: 32px 0;
        border: 1px solid #e5e7eb;
      ">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          <div style="
            background: ${brandColor};
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            font-weight: bold;
            font-size: 14px;
          ">
            📋
          </div>
          <h3 style="
            margin: 0;
            color: #1f2937;
            font-size: 18px;
            font-weight: 600;
          ">
            Invitation Details
          </h3>
        </div>
        
        <div style="margin-left: 44px;">
          <div style="margin-bottom: 12px;">
            <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Invited Email</div>
            <div style="color: #1f2937; font-weight: 600;">${email}</div>
          </div>
          <div style="margin-bottom: 12px;">
            <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Role</div>
            <div style="color: #1f2937; font-weight: 600;">${role}</div>
          </div>
          <div style="margin-bottom: 0;">
            <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Expires</div>
            <div style="color: #dc2626; font-weight: 600;">${new Date(invitation.expires_at).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
      
      <div style="text-align: center; margin: 32px 0;">
        <div style="color: #6b7280; font-size: 16px; margin-bottom: 16px;">
          💡 <strong>What happens next?</strong>
        </div>
        <p style="color: #6b7280; margin: 0; font-size: 14px; line-height: 1.6;">
          <a href="mailto:${email}" style="color: ${brandColor}; text-decoration: none; font-weight: 600;">${email}</a> will receive an invitation email with a link to join your team.<br>
          The invitation will expire in 7 days if not accepted.
        </p>
      </div>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${baseUrl}/settings/team" style="
          display: inline-block;
          background: ${brandColor};
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
        ">
          Manage Team
        </a>
      </div>
    `;

    // Use the unified email template system
    const confirmationEmailResponse = await resend.emails.send({
      from: "Lumiso <hello@updates.lumiso.app>",
      to: [user.email!],
      subject: `✅ Invitation sent to ${email}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation sent to ${email}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f8fafc;
      line-height: 1.6;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .email-header {
      background: linear-gradient(135deg, ${brandColor}, ${brandColor}dd);
      padding: 24px;
      text-align: center;
      color: white;
    }
    .email-body {
      padding: 32px 24px;
    }
    .email-footer {
      background-color: #f8fafc;
      padding: 24px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
    @media (max-width: 600px) {
      .email-container {
        margin: 0;
        box-shadow: none;
      }
      .email-body {
        padding: 24px 16px;
      }
      .email-footer {
        padding: 16px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1 style="
        margin: 0;
        font-size: 28px;
        font-weight: 700;
        text-shadow: 0 2px 4px rgba(0,0,0,0.1);
      ">Lumiso</h1>
    </div>
    
    <div class="email-body">
      ${confirmationEmailHtml}
    </div>
    
    <div class="email-footer">
      <p style="margin: 0 0 12px 0;">
        This email was sent by <strong>${businessName}</strong>
      </p>
      <p style="margin: 0;">
        <a href="${baseUrl}" style="color: ${brandColor}; text-decoration: none;">
          Visit Dashboard
        </a>
      </p>
    </div>
  </div>
</body>
</html>`,
    });

    console.log("Confirmation email sent successfully:", confirmationEmailResponse);

    // Log successful invitation
    await supabase.rpc('log_invitation_attempt', {
      user_uuid: user.id,
      email_param: normalizedEmail,
      org_id: organizationId,
      success: true,
      error_message: null
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitation,
        emailSent: true,
        confirmationSent: true
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    
    // Log failed invitation attempt if we have the necessary data
    try {
      const authHeader = req.headers.get("Authorization");
      const emailForLog = requestBody?.email?.toLowerCase?.() || 'unknown';
      let orgIdForLog: string | null = null;

      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(
          authHeader.replace("Bearer ", "")
        );
        
        if (user) {
          const { data: userSettings } = await supabase
            .from("user_settings")
            .select("active_organization_id")
            .eq("user_id", user.id)
            .maybeSingle();

          orgIdForLog = userSettings?.active_organization_id || null;

          if (orgIdForLog) {
            await supabase.rpc('log_invitation_attempt', {
              user_uuid: user.id,
              email_param: emailForLog,
              org_id: orgIdForLog,
              success: false,
              error_message: error?.message || 'Unknown error'
            });
          }
        }
      }
    } catch (logError) {
      console.error("Error logging failed invitation:", logError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});