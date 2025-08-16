import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Check if user is owner of the organization
    const { data: orgMember, error: orgError } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", user.id)
      .eq("user_id", user.id)
      .single();

    if (orgError || orgMember?.role !== "Owner") {
      throw new Error("Only organization owners can send invitations");
    }

    // Check if there's already a pending invitation for this email
    const { data: existingInvite } = await supabase
      .from("invitations")
      .select("id")
      .eq("organization_id", user.id)
      .eq("email", email)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString());

    if (existingInvite?.length) {
      throw new Error("There is already a pending invitation for this email address");
    }

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .insert({
        organization_id: user.id,
        email,
        role,
        invited_by: user.id,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      })
      .select()
      .single();

    if (inviteError) {
      throw inviteError;
    }

    // For development, we'll just log the invitation link instead of sending email
    const inviteLink = `${Deno.env.get("SUPABASE_URL")}/auth?invitation_id=${invitation.id}`;
    
    console.log(`Invitation created for ${email}`);
    console.log(`Invitation link: ${inviteLink}`);
    console.log(`Role: ${role}`);
    console.log(`Expires at: ${invitation.expires_at}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitation,
        // In development, return the link so it can be displayed
        inviteLink 
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