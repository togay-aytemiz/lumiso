import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createResendClient } from "../_shared/resend-utils.ts";
import { getErrorMessage, getErrorStack } from "../_shared/error-utils.ts";
import { getMessagingGuard } from "../_shared/messaging-guard.ts";
import { createEmailLocalization } from "../_shared/email-i18n.ts";
import { generateWelcomeEmail } from "../notification-processor/_templates/welcome-email.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const envSiteUrl = Deno.env.get("SITE_URL") ?? "";
const siteUrl = envSiteUrl && !envSiteUrl.includes("netlify.app")
  ? envSiteUrl
  : "https://my.lumiso.app";
const resend = createResendClient(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeRequest {
  organizationId?: string;
  locale?: string;
  emailOverride?: string;
}

const normalizeBaseUrl = (url: string) => url.replace(/\/$/, "");

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let requestData: WelcomeRequest = {};
    try {
      requestData = await req.json();
    } catch {
      requestData = {};
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authResult, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authResult.user) {
      throw new Error(`Failed to get authenticated user: ${authError?.message || "Unknown error"}`);
    }

    const user = authResult.user;
    const recipientEmail = requestData.emailOverride || user.email;

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: "User email is missing" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let organizationId = requestData.organizationId;

    if (!organizationId) {
      const { data: ownedOrg } = await supabase
        .from("organizations")
        .select("id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      organizationId = ownedOrg?.id ?? organizationId;
    }

    if (!organizationId) {
      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!membershipError) {
        organizationId = membership?.organization_id ?? organizationId;
      } else if (membershipError.code !== "PGRST205") {
        console.warn("Failed to resolve organization via memberships:", membershipError.message);
      }
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "No organization found for user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const guard = await getMessagingGuard(supabase, organizationId);
    if (guard?.hardBlocked) {
      return new Response(
        JSON.stringify({ skipped: true, reason: guard.reason ?? "Messaging blocked" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: languagePreference } = await supabase
      .from("user_language_preferences")
      .select("language_code")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: orgSettings } = await supabase
      .from("organization_settings")
      .select("photography_business_name, primary_brand_color, date_format, time_format, timezone, logo_url, preferred_locale")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const localization = createEmailLocalization(
      requestData.locale ?? orgSettings?.preferred_locale ?? languagePreference?.language_code,
    );

    const userFullName =
      profile?.full_name ||
      user.user_metadata?.full_name ||
      recipientEmail.split("@")[0] ||
      "there";

    const normalizedBaseUrl = normalizeBaseUrl(siteUrl);

    const templateData = {
      userFullName,
      businessName: orgSettings?.photography_business_name || "Lumiso",
      brandColor: orgSettings?.primary_brand_color || "#1EB29F",
      dateFormat: orgSettings?.date_format || "DD/MM/YYYY",
      timeFormat: orgSettings?.time_format || "12-hour",
      timezone: orgSettings?.timezone || "UTC",
      logoUrl: orgSettings?.logo_url || new URL("/lumiso-logo.png", normalizedBaseUrl).toString(),
      baseUrl: normalizedBaseUrl,
      assetBaseUrl: normalizedBaseUrl,
      platformName: "Lumiso",
      language: localization.language,
      localization,
    };

    const html = generateWelcomeEmail(templateData, {
      baseUrl: normalizedBaseUrl,
      assetBaseUrl: normalizedBaseUrl,
    });

    const subject = localization.t("welcome.subject", {
      name: userFullName,
      businessName: templateData.businessName,
    });
    const fromAddress = `${templateData.businessName || "Lumiso"} <hello@updates.lumiso.app>`;

    const sendResult = await resend.emails.send({
      from: fromAddress,
      to: [recipientEmail],
      subject,
      html,
    });

    if (sendResult.error) {
      throw new Error(`Failed to send welcome email: ${sendResult.error.message}`);
    }

    return new Response(
      JSON.stringify({ sent: true, emailId: sendResult.data?.id ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error sending welcome email:", error, getErrorStack(error));
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
