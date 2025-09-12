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

    const { email, role }: InvitationRequest = await req.json();

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

    // Check if user is already a member or has pending invitation
    const { data: existingMember } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (existingMember) {
      throw new Error("User is already a member of this organization");
    }

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
    
    // Create invitation link
    const inviteLink = `${req.headers.get('origin') || 'http://localhost:5173'}/accept-invite?invitation_id=${invitation.id}`;
    
    // Send invitation email using Resend
    const emailResponse = await resend.emails.send({
      from: "Lumiso <hello@updates.lumiso.app>",
      to: [email],
      subject: "You're invited to join our team!",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1EB29F; margin-bottom: 24px;">Team Invitation</h1>
          
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 16px;">
            Hello! 👋
          </p>
          
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 16px;">
            <strong>${inviterName}</strong> has invited you to join their team as a <strong>${role}</strong>.
          </p>
          
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">
              Role: <strong style="color: #1f2937;">${role}</strong><br>
              Invited by: <strong style="color: #1f2937;">${inviterName}</strong><br>
              Expires: <strong style="color: #1f2937;">${new Date(invitation.expires_at).toLocaleDateString()}</strong>
            </p>
          </div>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${inviteLink}" 
               style="background: linear-gradient(135deg, #D946EF, #9333EA); 
                      color: white; 
                      text-decoration: none; 
                      padding: 12px 24px; 
                      border-radius: 8px; 
                      font-weight: 600; 
                      display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
            This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
          </p>
          
          <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;">
          
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${inviteLink}" style="color: #1EB29F; word-break: break-all;">${inviteLink}</a>
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

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
        emailSent: true
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
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(
          authHeader.replace("Bearer ", "")
        );
        
        if (user) {
          const { data: userSettings } = await supabase
            .from("user_settings")
            .select("active_organization_id")
            .eq("user_id", user.id)
            .single();

          if (userSettings?.active_organization_id) {
            const requestBody = await req.json();
            await supabase.rpc('log_invitation_attempt', {
              user_uuid: user.id,
              email_param: requestBody.email || 'unknown',
              org_id: userSettings.active_organization_id,
              success: false,
              error_message: error.message
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