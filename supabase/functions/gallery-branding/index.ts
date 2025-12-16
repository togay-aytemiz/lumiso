import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type GalleryBrandingRequest = {
  publicId?: string;
};

type SupabaseQueryResult<T> = {
  data: T | null;
  error: { message: string } | Error | null;
};

type SupabaseTableClient = {
  select: (columns: string) => SupabaseTableClient;
  eq: (column: string, value: unknown) => SupabaseTableClient;
  maybeSingle: <T>() => Promise<SupabaseQueryResult<T>>;
};

interface SupabaseAdminLike {
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

export const handler = async (
  req: Request,
  deps: HandlerDependencies = {},
): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let requestData: GalleryBrandingRequest = {};
    try {
      requestData = await req.json();
    } catch {
      requestData = {};
    }

    const publicId = typeof requestData.publicId === "string"
      ? requestData.publicId.trim().toUpperCase()
      : "";

    if (!publicId) {
      return new Response(
        JSON.stringify({ error: "publicId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = (deps.createClient ?? createSupabaseAdminClient)();

    const { data: galleryRow, error: galleryError } = await supabaseAdmin
      .from("galleries")
      .select("session_id, project_id, title")
      .eq("public_id", publicId)
      .maybeSingle<{ session_id: string | null; project_id: string | null; title: string | null }>();

    if (galleryError) {
      throw galleryError;
    }

    if (!galleryRow) {
      return new Response(
        JSON.stringify({ logoUrl: null, businessName: null, galleryTitle: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let organizationId: string | null = null;

    if (galleryRow.session_id) {
      const { data: sessionRow, error: sessionError } = await supabaseAdmin
        .from("sessions")
        .select("organization_id")
        .eq("id", galleryRow.session_id)
        .maybeSingle<{ organization_id: string }>();

      if (sessionError) {
        throw sessionError;
      }

      organizationId = sessionRow?.organization_id ?? null;
    } else if (galleryRow.project_id) {
      const { data: projectRow, error: projectError } = await supabaseAdmin
        .from("projects")
        .select("organization_id")
        .eq("id", galleryRow.project_id)
        .maybeSingle<{ organization_id: string }>();

      if (projectError) {
        throw projectError;
      }

      organizationId = projectRow?.organization_id ?? null;
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ logoUrl: null, businessName: null, galleryTitle: galleryRow.title ?? null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: settingsRow, error: settingsError } = await supabaseAdmin
      .from("organization_settings")
      .select("logo_url, photography_business_name")
      .eq("organization_id", organizationId)
      .maybeSingle<{ logo_url: string | null; photography_business_name: string | null }>();

    if (settingsError) {
      throw settingsError;
    }

    return new Response(
      JSON.stringify({
        logoUrl: settingsRow?.logo_url ?? null,
        businessName: settingsRow?.photography_business_name ?? null,
        galleryTitle: galleryRow.title ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error in gallery-branding function:", error);
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
