import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createResendClient, type ResendClient } from "../_shared/resend-utils.ts";
import { getErrorMessage, getErrorStack } from "../_shared/error-utils.ts";
import { getMessagingGuard } from "../_shared/messaging-guard.ts";
import { createEmailLocalization } from "../_shared/email-i18n.ts";
import { renderGallerySelectionSubmittedEmail } from "../notification-processor/_templates/gallery-selection-submitted.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "no-store, max-age=0",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const envSiteUrl = Deno.env.get("SITE_URL") ?? "";
const siteUrl = envSiteUrl && !envSiteUrl.includes("netlify.app")
  ? envSiteUrl
  : "https://my.lumiso.app";
const galleryAssetsBucket = "gallery-assets";
const emailCoverSignedUrlTtlSeconds = 60 * 60 * 24 * 7;

type SendGallerySelectionSubmittedEmailRequest = {
  galleryId?: string;
};

type SupabaseUser = { id: string };

type SupabaseAuthResult = {
  data: { user: SupabaseUser | null };
  error: Error | null;
};

type SupabaseQueryResult<T> = {
  data: T | null;
  error: { message: string } | Error | null;
};

type SupabaseFilterBuilder = PromiseLike<SupabaseQueryResult<unknown>> & {
  select: (
    columns: string,
    options?: Record<string, unknown>,
  ) => SupabaseFilterBuilder;
  eq: (column: string, value: unknown) => SupabaseFilterBuilder;
  gt: (column: string, value: unknown) => SupabaseFilterBuilder;
  order: (
    column: string,
    options?: { ascending?: boolean | null },
  ) => SupabaseFilterBuilder;
  limit: (count: number) => SupabaseFilterBuilder;
  maybeSingle: <T>() => Promise<SupabaseQueryResult<T>>;
};

type SupabaseStorageBucketClient = {
  createSignedUrl: (
    path: string,
    expiresIn: number,
  ) => Promise<{
    data: { signedUrl?: string } | null;
    error: { message: string } | Error | null;
  }>;
};

interface SupabaseAdminLike {
  auth: {
    getUser: (jwt: string) => Promise<SupabaseAuthResult>;
    admin: {
      getUserById: (
        userId: string,
      ) => Promise<{
        data: { user: { email?: string | null } | null };
        error: { message: string } | null;
      }>;
    };
  };
  from: (table: string) => SupabaseFilterBuilder;
  storage: {
    from: (bucket: string) => SupabaseStorageBucketClient;
  };
}

interface HandlerDependencies {
  createClient?: () => SupabaseAdminLike;
  resendClient?: ResendClient;
  baseUrlOverride?: string;
  now?: () => Date;
}

function createSupabaseAdminClient(): SupabaseAdminLike {
  return createClient(supabaseUrl, supabaseServiceKey) as unknown as SupabaseAdminLike;
}

const resend: ResendClient = createResendClient(Deno.env.get("RESEND_API_KEY"));

const normalizeBaseUrl = (url: string) => url.replace(/\/$/, "");

const normalizeText = (value: string | null | undefined) =>
  typeof value === "string" ? value.replaceAll(/\s+/g, " ").trim() : "";

const normalizeSelectionPartKey = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

function countUniqueSelectedAssets(
  selections: Array<{ asset_id: unknown; selection_part: unknown }>,
  options?: { favoritesSelectionPartKey?: string },
) {
  const favoritesKey = normalizeSelectionPartKey(
    options?.favoritesSelectionPartKey ?? "favorites",
  );
  const ids = new Set<string>();

  selections.forEach((entry) => {
    const assetId = typeof entry.asset_id === "string" ? entry.asset_id.trim() : "";
    if (!assetId) return;
    const partKey = normalizeSelectionPartKey(entry.selection_part);
    if (!partKey) return;
    if (favoritesKey && partKey === favoritesKey) return;
    ids.add(assetId);
  });

  return ids.size;
}

type GalleryRow = {
  id: string;
  title: string | null;
  type: string | null;
  branding: Record<string, unknown> | null;
  session_id: string | null;
  project_id: string | null;
};

type SelectionStateRow = {
  gallery_id: string;
  is_locked: boolean | null;
  locked_by: string | null;
  locked_at: string | null;
  note: string | null;
};

type SessionRow = {
  organization_id: string;
  lead_id: string;
  user_id: string;
};

type ProjectRow = {
  organization_id: string;
  lead_id: string;
  user_id: string;
};

type LeadRow = {
  name: string | null;
};

type OrganizationRow = {
  owner_id: string;
};

type OrganizationSettingsRow = {
  email: string | null;
  photography_business_name: string | null;
  primary_brand_color: string | null;
  logo_url: string | null;
  preferred_locale: string | null;
  notification_global_enabled: boolean | null;
};

type UserSettingsRow = {
  notification_global_enabled: boolean | null;
};

type UserLanguagePreferenceRow = {
  language_code: string | null;
};

async function resolveCoverImageUrl(
  supabaseAdmin: SupabaseAdminLike,
  galleryId: string,
  branding: Record<string, unknown> | null,
): Promise<string | null> {
  const coverAssetId =
    branding && typeof branding.coverAssetId === "string"
      ? branding.coverAssetId.trim()
      : "";

  const { data: assetRow, error: assetError } = coverAssetId
    ? await supabaseAdmin
      .from("gallery_assets")
      .select("id,storage_path_web,status")
      .eq("id", coverAssetId)
      .maybeSingle<{ id: string; storage_path_web: string | null; status: string | null }>()
    : await supabaseAdmin
      .from("gallery_assets")
      .select("id,storage_path_web,status,created_at")
      .eq("gallery_id", galleryId)
      .eq("status", "ready")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string; storage_path_web: string | null; status: string | null }>();

  if (assetError) {
    console.warn(
      "send-gallery-selection-submitted-email: failed to fetch cover asset",
      assetError,
    );
    return null;
  }

  const storagePath = assetRow?.storage_path_web ?? null;
  if (!storagePath) return null;

  const { data: signedData, error: signedError } = await supabaseAdmin.storage
    .from(galleryAssetsBucket)
    .createSignedUrl(storagePath, emailCoverSignedUrlTtlSeconds);

  if (signedError) {
    console.warn(
      "send-gallery-selection-submitted-email: failed to sign cover asset url",
      signedError,
    );
    return null;
  }

  return typeof signedData?.signedUrl === "string" && signedData.signedUrl
    ? signedData.signedUrl
    : null;
}

export const handler = async (
  req: Request,
  deps: HandlerDependencies = {},
): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let requestData: SendGallerySelectionSubmittedEmailRequest = {};
    try {
      requestData = await req.json();
    } catch {
      requestData = {};
    }

    const galleryId = normalizeText(requestData.galleryId);
    if (!galleryId) {
      return new Response(
        JSON.stringify({ error: "galleryId is required" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    const supabaseAdmin = (deps.createClient ?? createSupabaseAdminClient)();
    const token = authHeader.replace("Bearer ", "");
    const { data: authResult, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authResult.user) {
      return new Response(
        JSON.stringify({ error: "Invalid user session" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    const viewerId = authResult.user.id;
    const now = deps.now?.() ?? new Date();

    const { data: grantRow, error: grantError } = await supabaseAdmin
      .from("gallery_access_grants")
      .select("gallery_id,viewer_id,expires_at")
      .eq("gallery_id", galleryId)
      .eq("viewer_id", viewerId)
      .gt("expires_at", now.toISOString())
      .maybeSingle<{ gallery_id: string; viewer_id: string; expires_at: string }>();

    if (grantError) throw grantError;
    if (!grantRow?.gallery_id) {
      return new Response(
        JSON.stringify({ error: "No valid gallery access grant" }),
        { status: 403, headers: jsonHeaders },
      );
    }

    const { data: selectionState, error: selectionError } = await supabaseAdmin
      .from("gallery_selection_states")
      .select("gallery_id,is_locked,locked_by,locked_at,note")
      .eq("gallery_id", galleryId)
      .maybeSingle<SelectionStateRow>();

    if (selectionError) throw selectionError;

    if (!selectionState?.gallery_id || selectionState.is_locked !== true) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Selections are not locked" }),
        { status: 200, headers: jsonHeaders },
      );
    }

    if (selectionState.locked_by && selectionState.locked_by !== viewerId) {
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: "Selections already locked by another viewer",
        }),
        { status: 200, headers: jsonHeaders },
      );
    }

    const { data: gallery, error: galleryError } = await supabaseAdmin
      .from("galleries")
      .select("id,title,type,branding,session_id,project_id")
      .eq("id", galleryId)
      .maybeSingle<GalleryRow>();

    if (galleryError) throw galleryError;

    if (!gallery?.id) {
      return new Response(
        JSON.stringify({ error: "Gallery not found" }),
        { status: 404, headers: jsonHeaders },
      );
    }

    if (gallery.type !== "proof") {
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: "Gallery type is not selection (proof)",
        }),
        { status: 200, headers: jsonHeaders },
      );
    }

    const resolvedGalleryTitle = normalizeText(gallery.title) || "Untitled gallery";

    let organizationId: string | null = null;
    let leadId: string | null = null;
    let createdByUserId: string | null = null;

    if (gallery.session_id) {
      const { data: sessionRow, error: sessionError } = await supabaseAdmin
        .from("sessions")
        .select("organization_id,lead_id,user_id")
        .eq("id", gallery.session_id)
        .maybeSingle<SessionRow>();

      if (sessionError) throw sessionError;

      organizationId = sessionRow?.organization_id ?? null;
      leadId = sessionRow?.lead_id ?? null;
      createdByUserId = sessionRow?.user_id ?? null;
    } else if (gallery.project_id) {
      const { data: projectRow, error: projectError } = await supabaseAdmin
        .from("projects")
        .select("organization_id,lead_id,user_id")
        .eq("id", gallery.project_id)
        .maybeSingle<ProjectRow>();

      if (projectError) throw projectError;

      organizationId = projectRow?.organization_id ?? null;
      leadId = projectRow?.lead_id ?? null;
      createdByUserId = projectRow?.user_id ?? null;
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "Unable to resolve organization for gallery" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const guard = await getMessagingGuard(
      supabaseAdmin as unknown as Parameters<typeof getMessagingGuard>[0],
      organizationId,
      now,
    );
    if (guard?.hardBlocked) {
      return new Response(
        JSON.stringify({ skipped: true, reason: guard.reason ?? "Messaging blocked" }),
        { status: 200, headers: jsonHeaders },
      );
    }

    const { data: orgSettingsData, error: orgSettingsError } = await supabaseAdmin
      .from("organization_settings")
      .select(
        "email,photography_business_name,primary_brand_color,logo_url,preferred_locale,notification_global_enabled",
      )
      .eq("organization_id", organizationId)
      .maybeSingle<OrganizationSettingsRow>();

    if (orgSettingsError) throw orgSettingsError;

    if (orgSettingsData?.notification_global_enabled === false) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Organization notifications disabled" }),
        { status: 200, headers: jsonHeaders },
      );
    }

    const { data: orgRow, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("owner_id")
      .eq("id", organizationId)
      .maybeSingle<OrganizationRow>();

    if (orgError) throw orgError;

    const recipients = new Set<string>();
    if (orgRow?.owner_id) recipients.add(orgRow.owner_id);
    if (createdByUserId) recipients.add(createdByUserId);

    if (recipients.size === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No recipients resolved" }),
        { status: 200, headers: jsonHeaders },
      );
    }

    let leadName: string | null = null;
    if (leadId) {
      const { data: leadRow, error: leadError } = await supabaseAdmin
        .from("leads")
        .select("name")
        .eq("id", leadId)
        .maybeSingle<LeadRow>();

      if (leadError) throw leadError;

      const name = normalizeText(leadRow?.name);
      leadName = name || null;
    }

    const coverImageUrl = await resolveCoverImageUrl(
      supabaseAdmin,
      galleryId,
      gallery.branding ?? null,
    );

    const { data: selectionRows, error: selectionsError } = await supabaseAdmin
      .from("client_selections")
      .select("asset_id,selection_part")
      .eq("gallery_id", galleryId);

    if (selectionsError) throw selectionsError;

    const selectionCount = countUniqueSelectedAssets(
      (selectionRows as Array<{ asset_id: unknown; selection_part: unknown }> | null | undefined) ?? [],
      { favoritesSelectionPartKey: "favorites" },
    );

    const baseUrl = normalizeBaseUrl(deps.baseUrlOverride ?? siteUrl);
    const galleryUrl = `${baseUrl}/galleries/${galleryId}`;
    const allGalleriesUrl = `${baseUrl}/galleries`;

    const fromName = normalizeText(orgSettingsData?.photography_business_name) || "Lumiso";
    const generalEmail = normalizeText(orgSettingsData?.email);
    const fromAddress = `Lumiso <hello@updates.lumiso.app>`;

    const resendClient = deps.resendClient ?? resend;
    const results: Array<{ userId: string; email: string; sent: boolean; error?: string }> = [];
    const seenRecipientEmails = new Set<string>();

    for (const userId of recipients) {
      const { data: userSettingsData } = await supabaseAdmin
        .from("user_settings")
        .select("notification_global_enabled")
        .eq("user_id", userId)
        .maybeSingle<UserSettingsRow>();

      if (userSettingsData?.notification_global_enabled === false) continue;

      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
        userId,
      );
      if (userError) {
        console.warn(
          "send-gallery-selection-submitted-email: failed to resolve recipient email",
          userError.message,
        );
        continue;
      }

      const email = normalizeText(userData.user?.email ?? "");
      if (!email) continue;
      const emailKey = email.toLowerCase();
      if (seenRecipientEmails.has(emailKey)) continue;
      seenRecipientEmails.add(emailKey);

      const { data: languagePrefData } = await supabaseAdmin
        .from("user_language_preferences")
        .select("language_code")
        .eq("user_id", userId)
        .maybeSingle<UserLanguagePreferenceRow>();

      const localization = createEmailLocalization(
        languagePrefData?.language_code ?? orgSettingsData?.preferred_locale ?? undefined,
      );

      const templateData = {
        businessName: fromName,
        brandColor: orgSettingsData?.primary_brand_color || "#1EB29F",
        logoUrl: orgSettingsData?.logo_url || undefined,
        baseUrl,
        assetBaseUrl: baseUrl,
        platformName: "Lumiso",
        language: localization.language,
        localization,
      };

      const { subject, html } = renderGallerySelectionSubmittedEmail(
        {
          galleryTitle: resolvedGalleryTitle,
          leadName,
          coverImageUrl,
          selectionCount,
          note: selectionState.note ?? null,
          galleryUrl,
          allGalleriesUrl,
        },
        templateData,
      );

      const sendResult = await resendClient.emails.send({
        from: fromAddress,
        to: [email],
        subject,
        html,
      });

      if (sendResult.error) {
        results.push({ userId, email, sent: false, error: sendResult.error.message });
        continue;
      }

      results.push({ userId, email, sent: true });
    }

    if (generalEmail) {
      const generalEmailKey = generalEmail.toLowerCase();
      if (!seenRecipientEmails.has(generalEmailKey)) {
        seenRecipientEmails.add(generalEmailKey);

        const localization = createEmailLocalization(
          orgSettingsData?.preferred_locale ?? undefined,
        );

        const templateData = {
          businessName: fromName,
          brandColor: orgSettingsData?.primary_brand_color || "#1EB29F",
          logoUrl: orgSettingsData?.logo_url || undefined,
          baseUrl,
          assetBaseUrl: baseUrl,
          platformName: "Lumiso",
          language: localization.language,
          localization,
        };

        const { subject, html } = renderGallerySelectionSubmittedEmail(
          {
            galleryTitle: resolvedGalleryTitle,
            leadName,
            coverImageUrl,
            selectionCount,
            note: selectionState.note ?? null,
            galleryUrl,
            allGalleriesUrl,
          },
          templateData,
        );

        const sendResult = await resendClient.emails.send({
          from: fromAddress,
          to: [generalEmail],
          subject,
          html,
        });

        if (sendResult.error) {
          results.push({
            userId: "organization_settings.email",
            email: generalEmail,
            sent: false,
            error: sendResult.error.message,
          });
        } else {
          results.push({
            userId: "organization_settings.email",
            email: generalEmail,
            sent: true,
          });
        }
      }
    }

    const sent = results.filter((entry) => entry.sent).length;
    const failed = results.filter((entry) => !entry.sent).length;

    if (sent === 0 && failed > 0) {
      return new Response(
        JSON.stringify({ error: "Failed to send selection submitted email", sent, failed, results }),
        { status: 500, headers: jsonHeaders },
      );
    }

    return new Response(
      JSON.stringify({ sent, failed, results }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error: unknown) {
    console.error(
      "Error in send-gallery-selection-submitted-email:",
      error,
      getErrorStack(error),
    );
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: jsonHeaders },
    );
  }
};

if (import.meta.main) {
  serve((req: Request) => handler(req));
}

export { corsHeaders };
