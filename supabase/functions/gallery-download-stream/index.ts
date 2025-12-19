import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { TextReader, ZipWriter } from "npm:@zip.js/zip.js@2.7.24";
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASSETS_BUCKET = "gallery-assets";
const ZIP_COMPRESSION_LEVEL = 0;
const ZIP_PAGE_SIZE = 100;

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

type GalleryDownloadStreamRequest = {
  galleryId?: string;
  downloadFileName?: string;
  accessToken?: string;
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

type SupabaseQueryListResult<T> = {
  data: T[] | null;
  error: { message: string } | Error | null;
};

type SupabaseTableClient = {
  select: (columns: string) => SupabaseTableClient;
  eq: (column: string, value: unknown) => SupabaseTableClient;
  gt: (column: string, value: unknown) => SupabaseTableClient;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseTableClient;
  range: (from: number, to: number) => SupabaseTableClient;
  maybeSingle: <T>() => Promise<SupabaseQueryResult<T>>;
};

interface SupabaseAdminLike {
  auth: {
    getUser: (jwt: string) => Promise<SupabaseAuthResult>;
  };
  from: (table: string) => SupabaseTableClient;
}

interface HandlerDependencies {
  createClient?: () => SupabaseAdminLike;
  streamZip?: (
    supabase: SupabaseAdminLike,
    params: { galleryId: string; assetVariant: string },
  ) => Promise<{ stream: ReadableStream<Uint8Array>; done: Promise<void> }>;
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

const fetchAssetPage = async (
  supabase: SupabaseAdminLike,
  galleryId: string,
  offset: number,
) => {
  const { data: assets, error } = await (supabase
    .from("gallery_assets")
    .select("id,storage_path_web,storage_path_original,metadata,created_at")
    .eq("gallery_id", galleryId)
    .eq("status", "ready")
    .order("created_at", { ascending: true })
    .range(offset, offset + ZIP_PAGE_SIZE - 1) as unknown as SupabaseQueryListResult<GalleryAssetRow>);

  if (error) {
    throw error;
  }

  return assets ?? [];
};

const streamGalleryZip = async (
  supabase: SupabaseAdminLike,
  params: { galleryId: string; assetVariant: string },
) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase credentials");
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const zipWriter = new ZipWriter(
    writable,
    {
      zip64: true,
      level: ZIP_COMPRESSION_LEVEL,
      useWebWorkers: false,
      useCompressionStream: false,
    } as unknown as Parameters<typeof ZipWriter>[1],
  );

  const errorMessages: string[] = [];
  const recordError = (message: string, error?: unknown) => {
    errorMessages.push(message);
    if (error) {
      console.error("gallery-download-stream:", message, error);
      return;
    }
    console.error("gallery-download-stream:", message);
  };

  const usedNames = new Set<string>();
  const done = (async () => {
    let offset = 0;
    let writerFailed = false;

    while (true) {
      let assets: GalleryAssetRow[] = [];
      try {
        assets = await fetchAssetPage(supabase, params.galleryId, offset);
      } catch (error) {
        recordError("Failed to load gallery assets", error);
        break;
      }

      if (assets.length === 0) {
        if (offset === 0) {
          recordError("No assets available");
        }
        break;
      }

      for (const asset of assets) {
        const storagePath = resolveAssetPath(asset, params.assetVariant);
        if (!storagePath) {
          recordError(`Missing storage path for asset ${asset.id}`);
          continue;
        }

        const entryName = ensureUniqueFileName(resolveEntryName(asset, params.assetVariant), usedNames);
        const objectUrl = buildStorageObjectUrl(supabaseUrl, ASSETS_BUCKET, storagePath);

        let response: Response;
        try {
          response = await fetch(objectUrl, {
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`,
              apikey: serviceRoleKey,
            },
          });
        } catch (error) {
          recordError(`Failed to fetch asset ${asset.id}`, error);
          continue;
        }

        if (!response.ok || !response.body) {
          recordError(`Failed to fetch asset ${asset.id}`);
          continue;
        }

        try {
          await zipWriter.add(
            entryName,
            response.body,
            {
              level: ZIP_COMPRESSION_LEVEL,
              useWebWorkers: false,
              useCompressionStream: false,
            } as unknown as Parameters<InstanceType<typeof ZipWriter>["add"]>[2],
          );
        } catch (error) {
          recordError(`Failed to add asset ${asset.id}`, error);
          writerFailed = true;
          break;
        }
      }

      if (writerFailed || assets.length < ZIP_PAGE_SIZE) {
        break;
      }

      offset += assets.length;
    }

    if (errorMessages.length > 0 && !writerFailed) {
      const report = [
        "Some files could not be included in this download:",
        ...errorMessages.map((message) => `- ${message}`),
      ].join("\n");

      try {
        await zipWriter.add(
          "_download_errors.txt",
          new TextReader(report),
          {
            level: ZIP_COMPRESSION_LEVEL,
            useWebWorkers: false,
            useCompressionStream: false,
          } as unknown as Parameters<InstanceType<typeof ZipWriter>["add"]>[2],
        );
      } catch (error) {
        console.error("gallery-download-stream: failed to add error report", error);
      }
    }

    try {
      await zipWriter.close();
    } catch (error) {
      try {
        await writable.abort(error);
      } catch {
        // ignore abort errors
      }
      throw error;
    }
  })();

  return { stream: readable, done };
};

const parseRequestPayload = async (req: Request): Promise<GalleryDownloadStreamRequest> => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    return {
      galleryId: url.searchParams.get("galleryId") ?? undefined,
      downloadFileName: url.searchParams.get("downloadFileName") ?? undefined,
      accessToken: url.searchParams.get("accessToken") ?? undefined,
    };
  }

  try {
    return (await req.json()) as GalleryDownloadStreamRequest;
  } catch {
    return {};
  }
};

export const handler = async (
  req: Request,
  deps: HandlerDependencies = {},
): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await parseRequestPayload(req);
    const galleryId = typeof payload.galleryId === "string" ? payload.galleryId.trim() : "";
    const accessToken = typeof payload.accessToken === "string" ? payload.accessToken.trim() : "";

    if (!galleryId) {
      return new Response(JSON.stringify({ error: "galleryId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "accessToken is required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = (deps.createClient ?? createSupabaseAdminClient)();
    const { data: authResult, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !authResult.user) {
      return new Response(JSON.stringify({ error: "Invalid user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const viewerId = authResult.user.id;
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

    const { stream, done } = await (deps.streamZip ?? streamGalleryZip)(supabaseAdmin, {
      galleryId,
      assetVariant,
    });

    done.catch((error) => {
      console.error("gallery-download-stream failed:", error);
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${downloadFileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === "No assets available" ? 400 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

if (import.meta.main) {
  serve((req: Request) => handler(req));
}
