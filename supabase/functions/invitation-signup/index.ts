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
  fullName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Invitation signup function called:", {
    method: req.method,
    url: req.url
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, invitationId, fullName }: InvitationSignupRequest = await req.json();
    console.log("Signup request:", { email, invitationId, fullName });

    if (!email || !password || !invitationId) {
      return new Response(
        JSON.stringify({ error: "Email, password, and invitation ID are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify invitation exists and is valid
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("id", invitationId)
      .eq("email", email)
      .single();

    if (invitationError || !invitation) {
      console.error("Invalid invitation:", invitationError);
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
        JSON.stringify({ error: "Invitation has already been used" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create the user account
    const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        full_name: fullName || '',
        invitation_id: invitationId
      },
      email_confirm: true // Auto-confirm email for invited users
    });

    if (signUpError || !authData.user) {
      console.error("Failed to create user:", signUpError);
      return new Response(
        JSON.stringify({ error: "Failed to create user account" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("User created successfully:", authData.user.id);

    // Add user to organization 
    const { error: memberError } = await supabaseAdmin
      .from("organization_members")
      .insert({
        organization_id: invitation.organization_id,
        user_id: authData.user.id,
        system_role: invitation.role === 'Owner' ? 'Owner' : 'Member',
        role: invitation.role,
        status: 'active',
        invited_by: invitation.invited_by
      });

    if (memberError) {
      console.error("Failed to add user to organization:", memberError);
      return new Response(
        JSON.stringify({ error: "Failed to join organization" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Mark invitation as accepted
    const { error: acceptError } = await supabaseAdmin
      .from("invitations")
      .update({ 
        accepted_at: new Date().toISOString()
      })
      .eq("id", invitationId);

    if (acceptError) {
      console.error("Failed to mark invitation as accepted:", acceptError);
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
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        user: authData.user,
        organizationId: invitation.organization_id,
        message: "Account created and invitation accepted successfully"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error("Error in invitation signup:", error);
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