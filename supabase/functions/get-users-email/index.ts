import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GetUsersEmailRequest {
  userIds: string[];
}

interface SupabaseAdminLike {
  auth: {
    admin: {
      getUserById(userId: string): Promise<{ data: { user: { id: string; email: string } } | null; error: Error | null }>;
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
    const { userIds }: GetUsersEmailRequest = await req.json();

    if (!userIds || !Array.isArray(userIds)) {
      return new Response(
        JSON.stringify({ error: "userIds array is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const supabaseAdmin = (deps.createClient ?? createSupabaseAdminClient)();

    const users: { id: string; email: string | null }[] = [];

    for (const userId of userIds) {
      try {
        const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (user && !error && user.user?.email) {
          users.push({
            id: user.user.id,
            email: user.user.email,
          });
        }
      } catch (error) {
        console.warn(`Failed to get user ${userId}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ users }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("Error in get-users-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
};

if (import.meta.main) {
  serve((req: Request) => handler(req));
}

export { corsHeaders };