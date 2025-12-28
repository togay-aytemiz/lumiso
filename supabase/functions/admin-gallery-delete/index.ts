import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DeleteGalleryRequest = {
  gallery_id?: string;
  confirm_title?: string;
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

type SupabaseQueryBuilder = {
  select: (columns: string) => SupabaseQueryBuilder;
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  delete: () => SupabaseQueryBuilder;
  maybeSingle: <T>() => Promise<SupabaseQueryResult<T>>;
  single: <T>() => Promise<SupabaseQueryResult<T>>;
  then: <T, TResult = SupabaseQueryResult<T>>(
    onfulfilled: (value: SupabaseQueryResult<T>) => TResult | PromiseLike<TResult>,
  ) => Promise<TResult>;
};

type GalleryRow = { id: string; title: string; session_id: string | null };
type SessionRow = { organization_id: string | null };
type UserRoleRow = { id: string };
type GalleryAssetRow = {
  storage_path_web: string | null;
  storage_path_original: string | null;
  metadata: Record<string, unknown> | null;
};

type StorageListItem = { name: string };

export interface SupabaseAdminLike {
  auth: {
    getUser: (jwt: string) => Promise<SupabaseAuthResult>;
  };
  from: (table: string) => SupabaseQueryBuilder;
  storage: {
    from: (
      bucketId: string,
    ) => {
      list: (
        path?: string,
        options?: Record<string, unknown>,
      ) => Promise<SupabaseQueryResult<StorageListItem[]>>;
      remove: (paths: string[]) => Promise<{ data: unknown; error: unknown }>;
    };
  };
}

interface HandlerDependencies {
  createClient?: () => SupabaseAdminLike;
}

function createSupabaseAdminClient(): SupabaseAdminLike {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  ) as unknown as SupabaseAdminLike;
}

const normalizeText = (value: string) => value.trim();

const isMissingStorageObjectError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const statusCode = (error as { statusCode?: number }).statusCode;
  if (statusCode === 404) return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.toLowerCase().includes("not found");
};

async function listStorageFilesInFolder(
  bucket: {
    list: (
      path?: string,
      options?: Record<string, unknown>,
    ) => Promise<SupabaseQueryResult<StorageListItem[]>>;
  },
  folder: string,
) {
  const files: string[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await bucket.list(folder, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw error;
    }

    const rows = Array.isArray(data) ? data : [];
    rows.forEach((entry) => {
      if (entry?.name) {
        files.push(`${folder}/${entry.name}`);
      }
    });

    if (rows.length < limit) {
      break;
    }

    offset += limit;
  }

  return files;
}

export const handler = async (
  req: Request,
  deps: HandlerDependencies = {},
): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let requestData: DeleteGalleryRequest = {};
    try {
      requestData = await req.json();
    } catch {
      requestData = {};
    }

    const galleryId = typeof requestData.gallery_id === "string" ? requestData.gallery_id.trim() : "";
    const confirmTitle = typeof requestData.confirm_title === "string" ? requestData.confirm_title : "";
    const normalizedConfirmTitle = normalizeText(confirmTitle);

    if (!galleryId) {
      return new Response(
        JSON.stringify({ error: "gallery_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = (deps.createClient ?? createSupabaseAdminClient)();

    const token = authHeader.replace("Bearer ", "");
    const { data: authResult, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authResult.user) {
      return new Response(
        JSON.stringify({ error: "Invalid user session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const viewerId = authResult.user.id;
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", viewerId)
      .eq("role", "admin")
      .maybeSingle<UserRoleRow>();

    if (roleError) {
      throw roleError;
    }

    if (!roleRow?.id) {
      return new Response(
        JSON.stringify({ error: "Admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: galleryRow, error: galleryError } = await supabaseAdmin
      .from("galleries")
      .select("id,title,session_id")
      .eq("id", galleryId)
      .maybeSingle<GalleryRow>();

    if (galleryError) {
      throw galleryError;
    }

    if (!galleryRow?.id) {
      return new Response(
        JSON.stringify({ error: "Gallery not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const expectedTitle = normalizeText(galleryRow.title ?? "");
    if (normalizedConfirmTitle.length > 0 && normalizedConfirmTitle !== expectedTitle) {
      return new Response(
        JSON.stringify({ error: "confirm_title does not match gallery title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!galleryRow.session_id) {
      return new Response(
        JSON.stringify({ error: "Gallery session not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: sessionRow, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("organization_id")
      .eq("id", galleryRow.session_id)
      .single<SessionRow>();

    if (sessionError) {
      throw sessionError;
    }

    const organizationId = sessionRow?.organization_id ?? null;
    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "No organization found for this gallery" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const storagePaths = new Set<string>();

    const { data: assetRows, error: assetError } = await supabaseAdmin
      .from("gallery_assets")
      .select("storage_path_web,storage_path_original,metadata")
      .eq("gallery_id", galleryId)
      .then((result: SupabaseQueryResult<GalleryAssetRow[]>) => result);

    if (assetError) {
      throw assetError;
    }

    const assetsList = Array.isArray(assetRows) ? assetRows : [];
    assetsList.forEach((row) => {
      if (row.storage_path_web) storagePaths.add(row.storage_path_web);
      if (row.storage_path_original) storagePaths.add(row.storage_path_original);
      const metadata = row.metadata ?? {};
      const thumbPath = typeof metadata.thumbPath === "string" ? metadata.thumbPath : null;
      if (thumbPath) storagePaths.add(thumbPath);
    });

    const bucket = supabaseAdmin.storage.from("gallery-assets");
    const basePrefix = `${organizationId}/galleries/${galleryId}`;
    const folderCandidates = [basePrefix, `${basePrefix}/proof`, `${basePrefix}/original`, `${basePrefix}/thumb`];

    const folderResults = await Promise.all(
      folderCandidates.map(async (folder) => await listStorageFilesInFolder(bucket, folder)),
    );
    folderResults.flat().forEach((path) => storagePaths.add(path));

    const pathsToRemove = Array.from(storagePaths);
    const chunkSize = 100;
    for (let index = 0; index < pathsToRemove.length; index += chunkSize) {
      const chunk = pathsToRemove.slice(index, index + chunkSize);
      const { error: removeError } = await bucket.remove(chunk);
      if (removeError && !isMissingStorageObjectError(removeError)) {
        throw removeError;
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from("galleries")
      .delete()
      .eq("id", galleryId)
      .then((result: SupabaseQueryResult<unknown>) => result);

    if (deleteError) {
      throw deleteError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error in admin-gallery-delete function:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
};

if (import.meta.main) {
  serve((req: Request) => handler(req));
}

export { corsHeaders };
