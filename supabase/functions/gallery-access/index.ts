import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GalleryAccessRequest = {
  publicId?: string;
  pin?: string;
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

type SupabaseTableClient = {
  select: (columns: string) => SupabaseTableClient;
  eq: (column: string, value: unknown) => SupabaseTableClient;
  maybeSingle: <T>() => Promise<SupabaseQueryResult<T>>;
  upsert: (
    values: Record<string, unknown>,
    options?: { onConflict?: string },
  ) => Promise<SupabaseQueryResult<unknown>>;
};

interface SupabaseAdminLike {
  auth: {
    getUser: (jwt: string) => Promise<SupabaseAuthResult>;
  };
  from: (table: string) => SupabaseTableClient;
}

interface HandlerDependencies {
  createClient?: () => SupabaseAdminLike;
}

function createSupabaseAdminClient(): SupabaseAdminLike {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  ) as unknown as SupabaseAdminLike;
}

const normalizePin = (value: string) => value.replaceAll(/\s+/g, "").toUpperCase();

export const handler = async (
  req: Request,
  deps: HandlerDependencies = {},
): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let requestData: GalleryAccessRequest = {};
    try {
      requestData = await req.json();
    } catch {
      requestData = {};
    }

    const publicId = typeof requestData.publicId === "string" ? requestData.publicId.trim().toUpperCase() : "";
    const pinRaw = typeof requestData.pin === "string" ? requestData.pin : "";
    const pin = normalizePin(pinRaw);

    if (!publicId) {
      return new Response(
        JSON.stringify({ error: "publicId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!pin || pin.length !== 6) {
      return new Response(
        JSON.stringify({ error: "pin must be 6 characters" }),
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

    const { data: galleryRow, error: galleryError } = await supabaseAdmin
      .from("galleries")
      .select("id")
      .eq("public_id", publicId)
      .maybeSingle<{ id: string }>();

    if (galleryError) {
      throw galleryError;
    }

    if (!galleryRow?.id) {
      return new Response(
        JSON.stringify({ error: "Gallery not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const galleryId = galleryRow.id;

    const { data: accessRow, error: accessError } = await supabaseAdmin
      .from("gallery_access")
      .select("pin")
      .eq("gallery_id", galleryId)
      .maybeSingle<{ pin: string }>();

    if (accessError) {
      throw accessError;
    }

    if (!accessRow?.pin) {
      return new Response(
        JSON.stringify({ error: "Gallery access not configured" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (normalizePin(accessRow.pin) !== pin) {
      return new Response(
        JSON.stringify({ error: "Invalid PIN" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const updatedAt = now.toISOString();

    const { error: grantError } = await supabaseAdmin
      .from("gallery_access_grants")
      .upsert(
        {
          gallery_id: galleryId,
          viewer_id: viewerId,
          expires_at: expiresAt,
          updated_at: updatedAt,
        },
        { onConflict: "gallery_id,viewer_id" },
      );

    if (grantError) {
      throw grantError;
    }

    return new Response(
      JSON.stringify({ galleryId, expiresAt }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error in gallery-access function:", error);
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
