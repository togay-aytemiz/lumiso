import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const template = (
  req: Request,
  url: URL,
): string => `
      <html>
        <head>
          <title>Test Callback - Debug Info</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .info { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 4px; }
            .success { background: #d4edda; color: #155724; }
            .error { background: #f8d7da; color: #721c24; }
          </style>
        </head>
        <body>
          <h1>Test Callback Function</h1>
          <div class="info success">
            <h3>✅ Callback function is reachable!</h3>
          </div>

          <div class="info">
            <h3>Request Details:</h3>
            <p><strong>Method:</strong> ${req.method}</p>
            <p><strong>URL:</strong> ${req.url}</p>
            <p><strong>Search Params:</strong> ${url.searchParams.toString() || "None"}</p>
          </div>

          <div class="info">
            <h3>URL Parameters:</h3>
            <pre>${JSON.stringify(Object.fromEntries(url.searchParams.entries()), null, 2)}</pre>
          </div>

          <div class="info">
            <h3>Test URLs:</h3>
            <p>Test with code parameter: <a href="?code=test123&state=teststate">Click here</a></p>
            <p>Test with error parameter: <a href="?error=access_denied&error_description=User+denied+access">Click here</a></p>
          </div>
        </body>
      </html>
    `;

const errorTemplate = (message: string): string => `
      <html>
        <body>
          <h1>Error in Test Callback</h1>
          <p>Error: ${message}</p>
        </body>
      </html>
    `;

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    console.log("=== TEST CALLBACK FUNCTION ===");
    console.log("Request method:", req.method);
    console.log("Full URL:", req.url);
    console.log("URL path:", url.pathname);
    console.log("URL search params:", url.searchParams.toString());
    console.log("All params:", Object.fromEntries(url.searchParams.entries()));

    return new Response(template(req, url), {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Test callback error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(errorTemplate(message), {
      headers: { "Content-Type": "text/html" },
      status: 500,
    });
  }
};

if (import.meta.main) {
  serve((req: Request) => handler(req));
}