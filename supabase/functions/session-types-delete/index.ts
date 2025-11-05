import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment configuration for session-types-delete function.");
}

export const SESSION_TYPE_IN_USE_CODE = "SESSION_TYPE_IN_USE";

export interface DeleteSessionTypeResult {
  status: number;
  message?: string;
}

interface SessionTypeClient {
  from(
    table: string
  ): {
    select(
      columns: string,
      options?: Record<string, unknown>
    ): {
      eq(field: string, value: unknown): Promise<{
        data: unknown;
        error: unknown;
        count?: number | null;
      }>;
    };
    delete(): {
      eq(field: string, value: unknown): Promise<{ error: unknown }>;
    };
  };
}

export async function deleteSessionTypeWithClient(
  client: SessionTypeClient,
  sessionTypeId: string | undefined
): Promise<DeleteSessionTypeResult> {
  if (!sessionTypeId || typeof sessionTypeId !== "string" || sessionTypeId.trim().length === 0) {
    return { status: 400, message: "invalid_session_type_id" };
  }

  const { count, error: countError } = await client
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("session_type_id", sessionTypeId);

  if (countError) {
    const message = countError instanceof Error ? countError.message : String(countError);
    return { status: 500, message };
  }

  if ((count ?? 0) > 0) {
    return { status: 409, message: SESSION_TYPE_IN_USE_CODE };
  }

  const { error: deleteError } = await client
    .from("session_types")
    .delete()
    .eq("id", sessionTypeId);

  if (deleteError) {
    const message = deleteError instanceof Error ? deleteError.message : String(deleteError);
    return { status: 500, message };
  }

  return { status: 200 };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { session_type_id: sessionTypeId } = await req.json();

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { persistSession: false },
    }) as unknown as SessionTypeClient;

    const result = await deleteSessionTypeWithClient(supabase, sessionTypeId);

    if (result.status !== 200) {
      return new Response(
        JSON.stringify({ error: { message: result.message } }),
        { status: result.status, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("session-types-delete error", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: { message } }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

if (import.meta.main) {
  serve(handler);
}
