import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ZipWriter } from "npm:@zip.js/zip.js@2.7.24";
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOWNLOAD_BUCKET = "gallery-downloads";
const ASSETS_BUCKET = "gallery-assets";
const MAX_PENDING_JOBS_PER_TICK = 1;
const MAX_EXPIRED_CLEANUP = 25;
const ZIP_COMPRESSION_LEVEL = 0;

const sanitizeEntryName = (value: string) => {
  const withoutControlChars = Array.from(value)
    .filter((char) => char.charCodeAt(0) >= 32)
    .join("");
  const trimmed = withoutControlChars.trim();
  const safe = trimmed.replace(/[<>:"/\\|?*]+/g, "_");
  return safe || "photo";
};

const splitFileName = (value: string) => {
  const lastDot = value.lastIndexOf(".");
  if (lastDot <= 0) {
    return { base: value, ext: "" };
  }
  return { base: value.slice(0, lastDot), ext: value.slice(lastDot) };
};

const ensureUniqueFileName = (value: string, used: Set<string>) => {
  const sanitized = sanitizeEntryName(value);
  const { base, ext } = splitFileName(sanitized);
  let candidate = sanitized;
  let index = 1;
  while (used.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${base}_${index}${ext}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
};

const getPathBasename = (value: string) => {
  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || "photo";
};

const buildStorageObjectUrl = (baseUrl: string, bucket: string, path: string) => {
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${baseUrl}/storage/v1/object/${bucket}/${encodedPath}`;
};

type ProcessorRequest = {
  action?: "process-pending" | "cleanup-expired" | "tick";
};

type SupabaseQueryResult<T> = {
  data: T | null;
  error: { message: string } | Error | null;
};

type SupabaseQueryListResult<T> = {
  data: T[] | null;
  error: { message: string } | Error | null;
};

type SupabaseTableClient = {
  select: (columns: string) => SupabaseTableClient;
  eq: (column: string, value: unknown) => SupabaseTableClient;
  neq: (column: string, value: unknown) => SupabaseTableClient;
  gt: (column: string, value: unknown) => SupabaseTableClient;
  lte: (column: string, value: unknown) => SupabaseTableClient;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseTableClient;
  limit: (count: number) => SupabaseTableClient;
  range: (from: number, to: number) => SupabaseTableClient;
  update: (values: Record<string, unknown>) => SupabaseTableClient;
  maybeSingle: <T>() => Promise<SupabaseQueryResult<T>>;
};

interface SupabaseAdminLike {
  from: (table: string) => SupabaseTableClient;
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: ReadableStream<Uint8Array>,
        options: { contentType: string; upsert?: boolean; duplex?: string },
      ) => Promise<SupabaseQueryResult<{ path: string }>>;
      remove: (paths: string[]) => Promise<SupabaseQueryResult<unknown>>;
    };
  };
}

interface ProcessorDependencies {
  createClient?: () => SupabaseAdminLike;
  now?: () => Date;
  processJob?: (supabase: SupabaseAdminLike, job: GalleryDownloadJobRow) => Promise<string>;
  maxJobsPerTick?: number;
  maxExpiredCleanup?: number;
}

type GalleryDownloadJobRow = {
  id: string;
  gallery_id: string;
  status: string;
  asset_variant: "web" | "original" | string;
  expires_at: string;
  storage_path: string | null;
};

type GalleryAssetRow = {
  id: string;
  storage_path_web: string | null;
  storage_path_original: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const createSupabaseAdminClient = (): SupabaseAdminLike =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  ) as unknown as SupabaseAdminLike;

const resolveAssetPath = (asset: GalleryAssetRow, variant: string) => {
  if (variant === "original") {
    return typeof asset.storage_path_original === "string" ? asset.storage_path_original : "";
  }
  return typeof asset.storage_path_web === "string" ? asset.storage_path_web : "";
};

const resolveEntryName = (asset: GalleryAssetRow, variant: string) => {
  const metadata = asset.metadata ?? {};
  const originalName = typeof metadata.originalName === "string" ? metadata.originalName : "";
  return originalName || getPathBasename(resolveAssetPath(asset, variant));
};

const streamZipForJob = async (supabase: SupabaseAdminLike, job: GalleryDownloadJobRow): Promise<string> => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase credentials");
  }

  const zipPath = `${job.gallery_id}/${job.id}.zip`;
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const zipWriter = new ZipWriter(writable, {
    zip64: true,
    level: ZIP_COMPRESSION_LEVEL,
    useWebWorkers: false,
    useCompressionStream: false,
  });

  const uploadPromise = supabase.storage.from(DOWNLOAD_BUCKET).upload(zipPath, readable, {
    contentType: "application/zip",
    upsert: true,
    duplex: "half",
  });

  const usedNames = new Set<string>();
  let offset = 0;
  const pageSize = 100;
  try {
    while (true) {
      const { data: assets, error } = await (supabase
        .from("gallery_assets")
        .select("id,storage_path_web,storage_path_original,metadata,created_at")
        .eq("gallery_id", job.gallery_id)
        .eq("status", "ready")
        .order("created_at", { ascending: true })
        .range(offset, offset + pageSize - 1) as unknown as SupabaseQueryListResult<GalleryAssetRow>);

      if (error) {
        throw error;
      }

      const rows = assets ?? [];
      if (rows.length === 0) {
        break;
      }

      for (const asset of rows) {
        const storagePath = resolveAssetPath(asset, job.asset_variant);
        if (!storagePath) {
          throw new Error("Missing storage path for asset");
        }

        const entryName = ensureUniqueFileName(resolveEntryName(asset, job.asset_variant), usedNames);
        const objectUrl = buildStorageObjectUrl(supabaseUrl, ASSETS_BUCKET, storagePath);
        const response = await fetch(objectUrl, {
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
        });

        if (!response.ok || !response.body) {
          throw new Error(`Failed to fetch asset ${asset.id}`);
        }

        await zipWriter.add(entryName, response.body, {
          level: ZIP_COMPRESSION_LEVEL,
          useWebWorkers: false,
          useCompressionStream: false,
        });
      }

      offset += pageSize;
    }

    await zipWriter.close();
    const { error: uploadError } = await uploadPromise;
    if (uploadError) {
      throw uploadError;
    }
  } catch (error) {
    try {
      await writable.abort(error);
    } catch {
      // ignore abort errors
    }
    try {
      await uploadPromise;
    } catch {
      // ignore upload errors after abort
    }
    throw error;
  }

  return zipPath;
};

export const processPendingJobs = async (
  supabase: SupabaseAdminLike,
  deps: ProcessorDependencies = {},
) => {
  const now = (deps.now ?? (() => new Date()))();
  const maxJobs = deps.maxJobsPerTick ?? MAX_PENDING_JOBS_PER_TICK;
  const processJob = deps.processJob ?? streamZipForJob;

  const { data: pendingJobs, error } = await (supabase
    .from("gallery_download_jobs")
    .select("id,gallery_id,status,asset_variant,expires_at,storage_path")
    .eq("status", "pending")
    .gt("expires_at", now.toISOString())
    .order("created_at", { ascending: true })
    .limit(maxJobs) as unknown as SupabaseQueryListResult<GalleryDownloadJobRow>);

  if (error) {
    throw error;
  }

  const jobs = pendingJobs ?? [];
  let processed = 0;
  const errors: string[] = [];

  for (const job of jobs) {
    const { data: claimed, error: claimError } = await supabase
      .from("gallery_download_jobs")
      .update({ status: "processing", processing_started_at: now.toISOString() })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id,gallery_id,status,asset_variant,expires_at,storage_path")
      .maybeSingle<GalleryDownloadJobRow>();

    if (claimError) {
      errors.push(getErrorMessage(claimError));
      continue;
    }

    if (!claimed) {
      continue;
    }

    try {
      const storagePath = await processJob(supabase, claimed);
      await supabase
        .from("gallery_download_jobs")
        .update({
          status: "ready",
          storage_path: storagePath,
          ready_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", claimed.id);
      processed += 1;
    } catch (processingError: unknown) {
      const errorMessage = getErrorMessage(processingError);
      errors.push(errorMessage);
      await supabase
        .from("gallery_download_jobs")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq("id", claimed.id);
    }
  }

  return { processed, errors };
};

export const cleanupExpiredJobs = async (
  supabase: SupabaseAdminLike,
  deps: ProcessorDependencies = {},
) => {
  const now = (deps.now ?? (() => new Date()))();
  const maxExpired = deps.maxExpiredCleanup ?? MAX_EXPIRED_CLEANUP;

  const { data: expiredJobs, error } = await (supabase
    .from("gallery_download_jobs")
    .select("id,gallery_id,status,asset_variant,expires_at,storage_path")
    .lte("expires_at", now.toISOString())
    .neq("status", "expired")
    .order("expires_at", { ascending: true })
    .limit(maxExpired) as unknown as SupabaseQueryListResult<GalleryDownloadJobRow>);

  if (error) {
    throw error;
  }

  const jobs = expiredJobs ?? [];
  let cleaned = 0;
  const errors: string[] = [];

  for (const job of jobs) {
    if (job.storage_path) {
      const { error: removeError } = await supabase.storage
        .from(DOWNLOAD_BUCKET)
        .remove([job.storage_path]);
      if (removeError) {
        errors.push(getErrorMessage(removeError));
      }
    }

    const { error: updateError } = await supabase
      .from("gallery_download_jobs")
      .update({ status: "expired", expired_at: now.toISOString() })
      .eq("id", job.id);

    if (updateError) {
      errors.push(getErrorMessage(updateError));
      continue;
    }

    cleaned += 1;
  }

  return { cleaned, errors };
};

export const handler = async (
  req: Request,
  deps: ProcessorDependencies = {},
): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let payload: ProcessorRequest = { action: "tick" };
    try {
      payload = (await req.json()) as ProcessorRequest;
    } catch {
      payload = { action: "tick" };
    }

    const action = payload.action ?? "tick";

    const supabaseAdmin = (deps.createClient ?? createSupabaseAdminClient)();
    let pendingResult = null;
    let cleanupResult = null;

    if (action === "process-pending" || action === "tick") {
      pendingResult = await processPendingJobs(supabaseAdmin, deps);
    }

    if (action === "cleanup-expired" || action === "tick") {
      cleanupResult = await cleanupExpiredJobs(supabaseAdmin, deps);
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        pending: pendingResult,
        cleanup: cleanupResult,
        processed_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error in gallery-download-processor:", error);
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

if (import.meta.main) {
  serve((req: Request) => handler(req));
}
