import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationSignupRequest {
  email: string;
  password: string;
  invitationId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, invitationId }: InvitationSignupRequest = await req.json();

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify invitation exists and is valid
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("id", invitationId)
      .single();

    if (invitationError || !invitation) {
      return new Response(
        JSON.stringify({ error: "Invalid invitation" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Invitation has expired" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if already accepted
    if (invitation.accepted_at) {
      return new Response(
        JSON.stringify({ error: "Invitation has already been accepted" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if email matches
    if (invitation.email !== email) {
      return new Response(
        JSON.stringify({ error: "Email mismatch with invitation" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create user with admin client (bypasses email confirmation)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        invited: true,
        invitation_id: invitationId
      }
    });

    if (authError) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: "Failed to create user account" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Accept the invitation
    const { error: acceptError } = await supabaseAdmin
      .from("invitations")
      .update({ 
        accepted_at: new Date().toISOString()
      })
      .eq("id", invitationId);

    if (acceptError) {
      console.error("Failed to accept invitation:", acceptError);
    }

    // Activate the pending membership that should already exist
    const { error: memberError } = await supabaseAdmin
      .from("organization_members")
      .update({ 
        status: 'active',
        user_id: authData.user.id,  // Update user_id in case it was null
        role: invitation.role       // Set the role from invitation
      })
      .eq('organization_id', invitation.organization_id)
      .eq('status', 'pending')
      .or(`user_id.is.null,user_id.eq.${authData.user.id}`);

    if (memberError) {
      console.error("Failed to activate membership:", memberError);
      return new Response(
        JSON.stringify({ error: "Failed to join organization" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Set this as the user's active organization
    const { error: settingsError } = await supabaseAdmin
      .from("user_settings")
      .upsert({
        user_id: authData.user.id,
        active_organization_id: invitation.organization_id
      });

    if (settingsError) {
      console.error("Failed to set active organization:", settingsError);
      // Don't fail the process for this
    }

    // Generate session for the new user
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    });

    if (sessionError) {
      console.error("Failed to generate session:", sessionError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: authData.user,
        message: "Account created and invitation accepted successfully"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error("Error in invitation-signup function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );
  }
};

serve(handler);