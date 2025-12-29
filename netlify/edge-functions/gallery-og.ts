import type { Context } from "https://edge.netlify.com";

type GalleryRow = {
  id: string;
  title: string | null;
  status: string | null;
};

type OgMeta = {
  pageTitle: string;
  description: string;
  url: string;
  imageUrl: string;
};

const OG_IMAGE_ROUTE_PREFIX = "/og/g/";

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

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function upsertTag(html: string, pattern: RegExp, replacement: string) {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  return html.replace(/<\/head>/i, `${replacement}\n  </head>`);
}

function buildGalleryMeta(args: {
  title: string;
  url: string;
  imageUrl: string;
}): OgMeta {
  const trimmedTitle = args.title.trim() || "Lumiso Galeri";
  const pageTitle = `${trimmedTitle} | Lumiso Galeri`;
  const description = `${trimmedTitle} galerisini görüntülemek için şifreyi girin.`;

  return {
    pageTitle,
    description,
    url: args.url,
    imageUrl: args.imageUrl,
  };
}

async function fetchGallery(args: {
  supabaseUrl: string;
  serviceRoleKey: string;
  publicId: string;
}): Promise<GalleryRow | null> {
  const url = new URL(`${args.supabaseUrl.replace(/\/+$/, "")}/rest/v1/galleries`);
  url.searchParams.set("select", "id,title,status");
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

function applyOgMeta(html: string, meta: OgMeta) {
  const titleEscaped = escapeHtml(meta.pageTitle);
  const descriptionEscaped = escapeHtml(meta.description);
  const urlEscaped = escapeHtml(meta.url);
  const imageEscaped = escapeHtml(meta.imageUrl);

  let next = html;

  next = upsertTag(
    next,
    /<title>[\s\S]*?<\/title>/i,
    `    <title>${titleEscaped}</title>`
  );
  next = upsertTag(
    next,
    /<meta\s+name=["']description["'][^>]*>/i,
    `    <meta name="description" content="${descriptionEscaped}">`
  );

  next = upsertTag(
    next,
    /<meta\s+property=["']og:title["'][^>]*>/i,
    `    <meta property="og:title" content="${titleEscaped}" />`
  );
  next = upsertTag(
    next,
    /<meta\s+property=["']og:description["'][^>]*>/i,
    `    <meta property="og:description" content="${descriptionEscaped}" />`
  );
  next = upsertTag(
    next,
    /<meta\s+property=["']og:image["'][^>]*>/i,
    `    <meta property="og:image" content="${imageEscaped}" />`
  );
  next = upsertTag(
    next,
    /<meta\s+property=["']og:url["'][^>]*>/i,
    `    <meta property="og:url" content="${urlEscaped}" />`
  );

  next = upsertTag(
    next,
    /<meta\s+name=["']twitter:title["'][^>]*>/i,
    `    <meta name="twitter:title" content="${titleEscaped}" />`
  );
  next = upsertTag(
    next,
    /<meta\s+name=["']twitter:description["'][^>]*>/i,
    `    <meta name="twitter:description" content="${descriptionEscaped}" />`
  );
  next = upsertTag(
    next,
    /<meta\s+name=["']twitter:image["'][^>]*>/i,
    `    <meta name="twitter:image" content="${imageEscaped}" />`
  );

  return next;
}

export default async function galleryOg(request: Request, context: Context) {
  const baseResponse = await context.next();
  const contentType = baseResponse.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return baseResponse;
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceRoleKey) {
    return baseResponse;
  }

  const { pathname, origin } = new URL(request.url);
  const parts = pathname.split("/").filter(Boolean);
  const publicIdRaw = parts.length >= 2 && parts[0] === "g" ? parts[1] : "";
  const publicId = publicIdRaw.trim().toUpperCase();
  if (!publicId) {
    return baseResponse;
  }

  try {
    const gallery = await fetchGallery({ supabaseUrl, serviceRoleKey, publicId });
    if (!gallery?.id) {
      return baseResponse;
    }

    if (String(gallery.status ?? "").toLowerCase() === "archived") {
      return baseResponse;
    }

    const ogUrl = new URL(`/g/${publicId}`, origin).toString();
    const ogImageUrl = new URL(`${OG_IMAGE_ROUTE_PREFIX}${publicId}`, origin).toString();
    const meta = buildGalleryMeta({
      title: gallery.title ?? "",
      url: ogUrl,
      imageUrl: ogImageUrl,
    });

    const html = await baseResponse.text();
    const updated = applyOgMeta(html, meta);

    const headers = new Headers(baseResponse.headers);
    headers.set("content-type", "text/html; charset=UTF-8");
    // Keep OG tags reasonably fresh while still cacheable at the edge.
    headers.set("cache-control", "public, max-age=0, s-maxage=300");

    return new Response(updated, { status: baseResponse.status, headers });
  } catch {
    return baseResponse;
  }
}
