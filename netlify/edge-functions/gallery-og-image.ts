import type { Context } from "https://edge.netlify.com";

type GalleryRow = {
  id: string;
  status: string | null;
  branding: Record<string, unknown> | null;
};

type GalleryAssetRow = {
  id: string;
  gallery_id: string;
  storage_path_web: string | null;
  storage_path_original: string | null;
  status: string | null;
};

const BUCKET = "gallery-assets";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function readEnv(key: string): string {
  try {
    return Deno.env.get(key) ?? "";
  } catch {
    return "";
  }
}

function getSupabaseConfig() {
  const supabaseUrl = readEnv("SUPABASE_URL") || readEnv("VITE_SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  return { supabaseUrl, serviceRoleKey };
}

function createSupabaseHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

function encodeStoragePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function normalizeStoragePath(path: string) {
  const trimmed = path.trim();
  if (!trimmed) return "";
  const normalized = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  const bucketPrefix = `${BUCKET}/`;
  return normalized.startsWith(bucketPrefix) ? normalized.slice(bucketPrefix.length) : normalized;
}

function resolveAssetStoragePath(asset: GalleryAssetRow | null) {
  if (!asset) return "";
  const webPath = typeof asset.storage_path_web === "string" ? normalizeStoragePath(asset.storage_path_web) : "";
  if (webPath) return webPath;
  const originalPath =
    typeof asset.storage_path_original === "string" ? normalizeStoragePath(asset.storage_path_original) : "";
  return originalPath;
}

async function fetchGallery(args: {
  supabaseUrl: string;
  serviceRoleKey: string;
  publicId: string;
}): Promise<GalleryRow | null> {
  const url = new URL(`${args.supabaseUrl.replace(/\/+$/, "")}/rest/v1/galleries`);
  url.searchParams.set("select", "id,status,branding");
  url.searchParams.append("public_id", `eq.${args.publicId}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      ...createSupabaseHeaders(args.serviceRoleKey),
      Accept: "application/json",
    },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as GalleryRow[] | null;
  return Array.isArray(data) && data.length > 0 ? data[0] ?? null : null;
}

async function fetchCoverAsset(args: {
  supabaseUrl: string;
  serviceRoleKey: string;
  galleryId: string;
  coverAssetId: string;
}): Promise<GalleryAssetRow | null> {
  const url = new URL(`${args.supabaseUrl.replace(/\/+$/, "")}/rest/v1/gallery_assets`);
  url.searchParams.set("select", "id,gallery_id,storage_path_web,storage_path_original,status");
  url.searchParams.append("id", `eq.${args.coverAssetId}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      ...createSupabaseHeaders(args.serviceRoleKey),
      Accept: "application/json",
    },
  });

  if (!response.ok) return null;
  const data = (await response.json()) as GalleryAssetRow[] | null;
  const row = Array.isArray(data) && data.length > 0 ? data[0] ?? null : null;
  if (!row?.id) return null;
  if (row.gallery_id !== args.galleryId) return null;
  return row;
}

async function fetchFallbackAsset(args: {
  supabaseUrl: string;
  serviceRoleKey: string;
  galleryId: string;
}): Promise<GalleryAssetRow | null> {
  const url = new URL(`${args.supabaseUrl.replace(/\/+$/, "")}/rest/v1/gallery_assets`);
  url.searchParams.set("select", "id,gallery_id,storage_path_web,storage_path_original,status");
  url.searchParams.append("gallery_id", `eq.${args.galleryId}`);
  url.searchParams.append("status", "eq.ready");
  url.searchParams.append(
    "or",
    "(storage_path_web.not.is.null,storage_path_original.not.is.null)"
  );
  url.searchParams.set("order", "order_index.asc,created_at.asc");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      ...createSupabaseHeaders(args.serviceRoleKey),
      Accept: "application/json",
    },
  });

  if (!response.ok) return null;
  const data = (await response.json()) as GalleryAssetRow[] | null;
  return Array.isArray(data) && data.length > 0 ? data[0] ?? null : null;
}

async function createSignedUrl(args: {
  supabaseUrl: string;
  serviceRoleKey: string;
  storagePath: string;
}): Promise<string> {
  const baseUrl = args.supabaseUrl.replace(/\/+$/, "");
  const encodedPath = encodeStoragePath(args.storagePath);
  const url = new URL(`${baseUrl}/storage/v1/object/sign/${BUCKET}/${encodedPath}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...createSupabaseHeaders(args.serviceRoleKey),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
  });

  if (!response.ok) {
    return "";
  }

  const data = (await response.json()) as Record<string, unknown>;
  const signed =
    (data.signedURL as string | undefined) ||
    (data.signedUrl as string | undefined) ||
    (data.signed_url as string | undefined) ||
    "";

  if (!signed) return "";
  if (signed.startsWith("http")) return signed;
  return `${baseUrl}${signed.startsWith("/") ? "" : "/"}${signed}`;
}

export default async function galleryOgImage(request: Request, _context: Context) {
  const { pathname, origin } = new URL(request.url);
  const parts = pathname.split("/").filter(Boolean);
  const publicIdRaw = parts.length >= 3 && parts[0] === "og" && parts[1] === "g" ? parts[2] : "";
  const publicId = publicIdRaw.trim().toUpperCase();

  const fallbackUrl = new URL("/social.webp", origin).toString();
  if (!publicId) {
    return Response.redirect(fallbackUrl, 302);
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.redirect(fallbackUrl, 302);
  }

  try {
    const gallery = await fetchGallery({ supabaseUrl, serviceRoleKey, publicId });
    if (!gallery?.id) {
      return Response.redirect(fallbackUrl, 302);
    }

    if (String(gallery.status ?? "").toLowerCase() === "archived") {
      return Response.redirect(fallbackUrl, 302);
    }

    const branding = gallery.branding && typeof gallery.branding === "object" ? gallery.branding : {};
    const coverAssetId = typeof branding.coverAssetId === "string" ? branding.coverAssetId.trim() : "";

    const coverAsset = coverAssetId
      ? await fetchCoverAsset({ supabaseUrl, serviceRoleKey, galleryId: gallery.id, coverAssetId })
      : null;
    const coverStoragePath = resolveAssetStoragePath(coverAsset);
    const fallbackAsset = !coverStoragePath
      ? await fetchFallbackAsset({ supabaseUrl, serviceRoleKey, galleryId: gallery.id })
      : null;
    const fallbackStoragePath = resolveAssetStoragePath(fallbackAsset);
    const storagePath = coverStoragePath || fallbackStoragePath;

    if (!storagePath) {
      return Response.redirect(fallbackUrl, 302);
    }

    if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
      const response = Response.redirect(storagePath, 302);
      response.headers.set("cache-control", "public, max-age=0, s-maxage=3600");
      return response;
    }

    const signedUrl = await createSignedUrl({ supabaseUrl, serviceRoleKey, storagePath });
    if (!signedUrl) {
      return Response.redirect(fallbackUrl, 302);
    }

    const response = Response.redirect(signedUrl, 302);
    response.headers.set("cache-control", "public, max-age=0, s-maxage=3600");
    return response;
  } catch {
    return Response.redirect(fallbackUrl, 302);
  }
}
