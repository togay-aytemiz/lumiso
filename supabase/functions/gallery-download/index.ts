import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOWNLOAD_BUCKET = "gallery-downloads";
const DOWNLOAD_TTL_HOURS = 3;
const SIGNED_URL_TTL_SECONDS = 15 * 60;

const sanitizeFileBasename = (value: string) => {
  const withoutControlChars = Array.from(value)
    .filter((char) => char.charCodeAt(0) >= 32)
    .join("");
  const normalized = withoutControlChars
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[<>:"/\\|?*]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "gallery";
};

const sanitizeDownloadFileName = (value: string | undefined, fallback: string) => {
  const raw = typeof value === "string" ? value : "";
  const withoutControlChars = Array.from(raw)
    .filter((char) => char.charCodeAt(0) >= 32)
    .join("");
  const normalized = withoutControlChars
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[<>:"/\\|?*]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const fallbackBase = fallback.replace(/\.zip$/i, "");
  const baseName = normalized || fallbackBase || "gallery_download";
  const cappedBase = baseName.length > 200 ? baseName.slice(0, 200) : baseName;
  const withExtension = cappedBase.toLowerCase().endsWith(".zip")
    ? cappedBase
    : `${cappedBase}.zip`;
  return withExtension;
};

const buildFallbackFileName = (title: string, galleryType: string) => {
  const prefix = galleryType === "final" ? "Final" : "Secim";
  const baseName = sanitizeFileBasename(title || "gallery");
  return `${prefix}_${baseName}.zip`;
};

type GalleryDownloadRequestBody = {
  action: "request";
  galleryId?: string;
  downloadFileName?: string;
};

type GalleryDownloadStatusBody = {
  action: "status";
  galleryId?: string;
  jobId?: string;
  downloadFileName?: string;
};

type GalleryDownloadRequest = GalleryDownloadRequestBody | GalleryDownloadStatusBody;

type SupabaseUser = { id: string };

type SupabaseAuthResult = {
  data: { user: SupabaseUser | null };
  error: Error | null;
};

type SupabaseQueryResult<T> = {
  data: T | null;
  error: { message: string } | Error | null;
};

type SupabaseQueryListResult<T> = {
  data: T[] | null;
  error: { message: string } | Error | null;
  count?: number | null;
};

type SupabaseTableClient = {
  select: (columns: string, options?: { count?: "exact" }) => SupabaseTableClient;
  eq: (column: string, value: unknown) => SupabaseTableClient;
  gt: (column: string, value: unknown) => SupabaseTableClient;
  in: (column: string, values: unknown[]) => SupabaseTableClient;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseTableClient;
  limit: (count: number) => SupabaseTableClient;
  maybeSingle: <T>() => Promise<SupabaseQueryResult<T>>;
  single: <T>() => Promise<SupabaseQueryResult<T>>;
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => SupabaseTableClient;
  update: (values: Record<string, unknown>) => SupabaseTableClient;
};

interface SupabaseAdminLike {
  auth: {
    getUser: (jwt: string) => Promise<SupabaseAuthResult>;
  };
  from: (table: string) => SupabaseTableClient;
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number,
        options?: { download?: string | boolean },
      ) => Promise<SupabaseQueryResult<{ signedUrl: string }>>;
    };
  };
}

interface HandlerDependencies {
  createClient?: () => SupabaseAdminLike;
  now?: () => Date;
}

type GalleryRow = {
  id: string;
  title: string;
  type: string;
  session_id: string | null;
};

type SessionRow = {
  id: string;
  organization_id: string | null;
};

type OrganizationRow = {
  id: string;
  owner_id: string;
};

type GalleryAccessGrantRow = {
  gallery_id: string;
  viewer_id: string;
  expires_at: string;
};

type GalleryDownloadJobRow = {
  id: string;
  gallery_id: string;
  status: string;
  asset_variant: string;
  asset_count: number;
  assets_updated_at: string | null;
  storage_path: string | null;
  expires_at: string;
};

const createSupabaseAdminClient = (): SupabaseAdminLike =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  ) as unknown as SupabaseAdminLike;

const resolveGalleryType = (value: string | null | undefined) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "final") return "final";
  return "proof";
};

const resolveAssetVariant = (galleryType: string) => (galleryType === "final" ? "original" : "web");

const canUserAccessGallery = async (
  supabase: SupabaseAdminLike,
  galleryId: string,
  viewerId: string,
): Promise<{ gallery: GalleryRow | null; allowed: boolean }> => {
  const { data: gallery, error: galleryError } = await supabase
    .from("galleries")
    .select("id,title,type,session_id")
    .eq("id", galleryId)
    .maybeSingle<GalleryRow>();

  if (galleryError) {
    throw galleryError;
  }

  if (!gallery) {
    return { gallery: null, allowed: false };
  }

  let isOwner = false;
  if (gallery.session_id) {
    const { data: sessionRow, error: sessionError } = await supabase
      .from("sessions")
      .select("id,organization_id")
      .eq("id", gallery.session_id)
      .maybeSingle<SessionRow>();

    if (sessionError) {
      throw sessionError;
    }

    if (sessionRow?.organization_id) {
      const { data: orgRow, error: orgError } = await supabase
        .from("organizations")
        .select("id,owner_id")
        .eq("id", sessionRow.organization_id)
        .maybeSingle<OrganizationRow>();

      if (orgError) {
        throw orgError;
      }

      if (orgRow?.owner_id === viewerId) {
        isOwner = true;
      }
    }
  }

  if (isOwner) {
    return { gallery, allowed: true };
  }

  const { data: grantRow, error: grantError } = await supabase
    .from("gallery_access_grants")
    .select("gallery_id,viewer_id,expires_at")
    .eq("gallery_id", galleryId)
    .eq("viewer_id", viewerId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<GalleryAccessGrantRow>();

  if (grantError) {
    throw grantError;
  }

  return { gallery, allowed: Boolean(grantRow) };
};

const fetchGalleryAssetStats = async (
  supabase: SupabaseAdminLike,
  galleryId: string,
): Promise<{ assetCount: number; assetsUpdatedAt: string | null }> => {
  const { data, error, count } = await (supabase
    .from("gallery_assets")
    .select("updated_at", { count: "exact" })
    .eq("gallery_id", galleryId)
    .eq("status", "ready")
    .order("updated_at", { ascending: false })
    .limit(1) as unknown as Promise<SupabaseQueryListResult<{ updated_at: string }>>);

  if (error) {
    throw error;
  }

  const assetCount = typeof count === "number" ? count : 0;
  const assetsUpdatedAt = data?.[0]?.updated_at ?? null;
  return { assetCount, assetsUpdatedAt };
};

const createSignedDownloadUrl = async (
  supabase: SupabaseAdminLike,
  storagePath: string,
  downloadFileName: string,
): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from(DOWNLOAD_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, { download: downloadFileName || true });

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
};

export const handler = async (
  req: Request,
  deps: HandlerDependencies = {},
): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let payload: GalleryDownloadRequest = { action: "request" };
    try {
      payload = (await req.json()) as GalleryDownloadRequest;
    } catch {
      payload = { action: "request" };
    }

    if (payload.action !== "request" && payload.action !== "status") {
      return new Response(JSON.stringify({ error: "Unsupported action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = (deps.createClient ?? createSupabaseAdminClient)();
    const token = authHeader.replace("Bearer ", "");
    const { data: authResult, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authResult.user) {
      return new Response(JSON.stringify({ error: "Invalid user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const viewerId = authResult.user.id;
    const galleryId = typeof payload.galleryId === "string" ? payload.galleryId.trim() : "";

    if (!galleryId) {
      return new Response(JSON.stringify({ error: "galleryId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { gallery, allowed } = await canUserAccessGallery(supabaseAdmin, galleryId, viewerId);
    if (!gallery) {
      return new Response(JSON.stringify({ error: "Gallery not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!allowed) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const galleryType = resolveGalleryType(gallery.type);
    const assetVariant = resolveAssetVariant(galleryType);
    const fallbackName = buildFallbackFileName(gallery.title ?? "gallery", galleryType);
    const downloadFileName = sanitizeDownloadFileName(payload.downloadFileName, fallbackName);

    if (payload.action === "status") {
      const jobId = typeof payload.jobId === "string" ? payload.jobId.trim() : "";
      if (!jobId) {
        return new Response(JSON.stringify({ error: "jobId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: job, error: jobError } = await supabaseAdmin
        .from("gallery_download_jobs")
        .select("id,gallery_id,status,asset_variant,asset_count,assets_updated_at,storage_path,expires_at")
        .eq("id", jobId)
        .eq("gallery_id", galleryId)
        .maybeSingle<GalleryDownloadJobRow>();

      if (jobError) {
        throw jobError;
      }

      if (!job) {
        return new Response(JSON.stringify({ error: "Download job not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const expiresAt = job.expires_at;
      if (new Date(expiresAt).getTime() <= Date.now()) {
        await supabaseAdmin
          .from("gallery_download_jobs")
          .update({ status: "expired", expired_at: new Date().toISOString() })
          .eq("id", job.id);
        return new Response(JSON.stringify({ status: "expired", expiresAt }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (job.status === "ready" && job.storage_path) {
        const signedUrl = await createSignedDownloadUrl(supabaseAdmin, job.storage_path, downloadFileName);
        if (!signedUrl) {
          return new Response(JSON.stringify({ error: "Failed to create download url" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            jobId: job.id,
            status: "ready",
            downloadUrl: signedUrl,
            expiresAt,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          jobId: job.id,
          status: job.status,
          expiresAt,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { assetCount, assetsUpdatedAt } = await fetchGalleryAssetStats(supabaseAdmin, galleryId);

    if (assetCount <= 0) {
      return new Response(JSON.stringify({ error: "No assets available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingJob, error: existingJobError } = await supabaseAdmin
      .from("gallery_download_jobs")
      .select("id,gallery_id,status,asset_variant,asset_count,assets_updated_at,storage_path,expires_at")
      .eq("gallery_id", galleryId)
      .eq("asset_variant", assetVariant)
      .eq("asset_count", assetCount)
      .eq("assets_updated_at", assetsUpdatedAt)
      .gt("expires_at", new Date().toISOString())
      .in("status", ["pending", "processing", "ready"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<GalleryDownloadJobRow>();

    if (existingJobError) {
      throw existingJobError;
    }

    if (existingJob) {
      if (existingJob.status === "ready" && existingJob.storage_path) {
        const signedUrl = await createSignedDownloadUrl(
          supabaseAdmin,
          existingJob.storage_path,
          downloadFileName,
        );

        if (signedUrl) {
          return new Response(
            JSON.stringify({
              jobId: existingJob.id,
              status: "ready",
              downloadUrl: signedUrl,
              expiresAt: existingJob.expires_at,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        await supabaseAdmin
          .from("gallery_download_jobs")
          .update({
            status: "failed",
            failed_at: new Date().toISOString(),
            error_message: "Failed to create signed download url",
          })
          .eq("id", existingJob.id);
      } else {
        return new Response(
          JSON.stringify({
            jobId: existingJob.id,
            status: existingJob.status,
            expiresAt: existingJob.expires_at,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const now = (deps.now ?? (() => new Date()))();
    const expiresAt = new Date(now.getTime() + DOWNLOAD_TTL_HOURS * 60 * 60 * 1000).toISOString();

    const { data: job, error: insertError } = await supabaseAdmin
      .from("gallery_download_jobs")
      .insert({
        gallery_id: galleryId,
        viewer_id: viewerId,
        status: "pending",
        gallery_type: galleryType,
        asset_variant: assetVariant,
        asset_count: assetCount,
        assets_updated_at: assetsUpdatedAt,
        expires_at: expiresAt,
      })
      .select("id,status,expires_at")
      .single<{ id: string; status: string; expires_at: string }>();

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        jobId: job?.id,
        status: job?.status ?? "pending",
        expiresAt: job?.expires_at ?? expiresAt,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error in gallery-download function:", error);
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

if (import.meta.main) {
  serve((req: Request) => handler(req));
}
