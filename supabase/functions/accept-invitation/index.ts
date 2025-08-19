import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptInvitationRequest {
  invitationId: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Accept invitation function called:", {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get invitation ID from URL path or request body
    const url = new URL(req.url);
    const pathInvitationId = url.pathname.split('/').pop();
    
    let invitationId: string;
    if (pathInvitationId && pathInvitationId !== 'accept-invitation') {
      invitationId = pathInvitationId;
      console.log("Got invitation ID from path:", invitationId);
    } else {
      const requestBody = await req.json();
      console.log("Request body:", requestBody);
      const { invitationId: bodyInvitationId }: AcceptInvitationRequest = requestBody;
      invitationId = bodyInvitationId;
      console.log("Got invitation ID from body:", invitationId);
    }

    if (!invitationId) {
      console.error("No invitation ID provided");
      throw new Error("No invitation ID provided");
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          error: "Authentication required", 
          redirectToSignup: true,
          invitationId: invitationId
        }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          error: "Authentication required", 
          redirectToSignup: true,
          invitationId: invitationId
        }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify invitation exists and is valid
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("id", invitationId)
      .single();

    console.log("Invitation lookup result:", { invitation, invitationError });

    if (invitationError || !invitation) {
      console.error("Invitation not found:", invitationError);
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
    if (invitation.email !== user.email) {
      return new Response(
        JSON.stringify({ error: "Email mismatch with invitation" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user is already a member of this organization
    const { data: existingMember } = await supabaseAdmin
      .from("organization_members")
      .select("id, status, role")
      .eq("organization_id", invitation.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMember?.status === 'active') {
      return new Response(
        JSON.stringify({ error: "User is already an active member of this organization" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // First delete any existing membership to avoid constraint issues
    const { error: deleteError } = await supabaseAdmin
      .from("organization_members")
      .delete()
      .eq("organization_id", invitation.organization_id)
      .eq("user_id", user.id);

    // Then insert the new membership
    const { error: memberError } = await supabaseAdmin
      .from("organization_members")
      .insert({
        organization_id: invitation.organization_id,
        user_id: user.id,
        system_role: invitation.role === 'Owner' ? 'Owner' : 'Member',
        role: invitation.role,
        status: 'active',
        invited_by: invitation.invited_by
      });

    if (memberError) {
      console.error("Failed to create/update membership:", memberError);
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

    // Set this as the user's active organization if they don't have one
    const { data: currentSettings } = await supabaseAdmin
      .from("user_settings")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!currentSettings?.active_organization_id) {
      const { error: settingsError } = await supabaseAdmin
        .from("user_settings")
        .upsert({
          user_id: user.id,
          active_organization_id: invitation.organization_id
        });

      if (settingsError) {
        console.error("Failed to set active organization:", settingsError);
        // Don't fail the process for this
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        organizationId: invitation.organization_id,
        message: "Invitation accepted successfully"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error("Error in accept-invitation function:", error);
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