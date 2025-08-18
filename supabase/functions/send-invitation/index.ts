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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

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

    if (!email || !role) {
      throw new Error("Email and role are required");
    }

    // Get user's active organization from user_settings
    const { data: userSettings, error: settingsError } = await supabase
      .from("user_settings")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .single();

    if (settingsError || !userSettings?.active_organization_id) {
      throw new Error("No active organization found. Please contact support.");
    }

    const organizationId = userSettings.active_organization_id;

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

    // Check if there's already a pending invitation for this email
    const { data: existingInvite } = await supabase
      .from("invitations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString());

    if (existingInvite?.length) {
      throw new Error("There is already a pending invitation for this email address");
    }

    if (existingInvite?.length) {
      throw new Error("There is already a pending invitation for this email address");
    }

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .insert({
        organization_id: organizationId,
        email,
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
      from: "Team Invitations <noreply@yourdomain.com>", // Replace with your verified domain
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
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});