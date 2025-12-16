import { assertEquals } from "std/testing/asserts.ts";
import { handler as galleryBrandingHandler } from "../gallery-branding/index.ts";

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function createMockSupabase(options: {
  galleryRow?: { session_id: string | null; project_id: string | null; title: string | null } | null;
  sessionRow?: { organization_id: string } | null;
  projectRow?: { organization_id: string } | null;
  settingsRow?: { logo_url: string | null; photography_business_name: string | null } | null;
}) {
  const mock = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      return {
        select(_columns: string) {
          return this;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return this;
        },
        async maybeSingle<T>() {
          if (table === "galleries") {
            const publicId = filters.public_id;
            if (publicId === "PUB-OK" || publicId === "pub-ok") {
              return { data: options.galleryRow ?? null, error: null } as unknown as { data: T | null; error: null };
            }
            return { data: null, error: null } as unknown as { data: T | null; error: null };
          }

          if (table === "sessions") {
            const id = filters.id;
            if (id === options.galleryRow?.session_id) {
              return { data: options.sessionRow ?? null, error: null } as unknown as { data: T | null; error: null };
            }
            return { data: null, error: null } as unknown as { data: T | null; error: null };
          }

          if (table === "projects") {
            const id = filters.id;
            if (id === options.galleryRow?.project_id) {
              return { data: options.projectRow ?? null, error: null } as unknown as { data: T | null; error: null };
            }
            return { data: null, error: null } as unknown as { data: T | null; error: null };
          }

          if (table === "organization_settings") {
            const organizationId = filters.organization_id;
            if (
              organizationId === options.sessionRow?.organization_id ||
              organizationId === options.projectRow?.organization_id
            ) {
              return { data: options.settingsRow ?? null, error: null } as unknown as { data: T | null; error: null };
            }
            return { data: null, error: null } as unknown as { data: T | null; error: null };
          }

          return { data: null, error: null } as unknown as { data: T | null; error: null };
        },
      };
    },
  };

  return mock;
}

Deno.test("gallery-branding returns 400 when publicId is missing", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const response = await galleryBrandingHandler(request, {
    createClient: () => createMockSupabase({ galleryRow: null }),
  });

  assertEquals(response.status, 400);
  const body = await readJson(response);
  assertEquals(body, { error: "publicId is required" });
});

Deno.test("gallery-branding returns empty payload when gallery is not found", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicId: "pub-missing" }),
  });

  const response = await galleryBrandingHandler(request, {
    createClient: () => createMockSupabase({ galleryRow: null }),
  });

  assertEquals(response.status, 200);
  const body = await readJson(response);
  assertEquals(body, { logoUrl: null, businessName: null, galleryTitle: null });
});

Deno.test("gallery-branding returns organization branding via session relationship", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicId: "pub-ok" }),
  });

  const response = await galleryBrandingHandler(request, {
    createClient: () =>
      createMockSupabase({
        galleryRow: { session_id: "session-1", project_id: null, title: "Eda & Mert" },
        sessionRow: { organization_id: "org-1" },
        settingsRow: { logo_url: "https://example.com/logo.png", photography_business_name: "Studio" },
      }),
  });

  assertEquals(response.status, 200);
  const body = await readJson(response);
  assertEquals(body, { logoUrl: "https://example.com/logo.png", businessName: "Studio", galleryTitle: "Eda & Mert" });
});

Deno.test("gallery-branding returns empty payload when organization settings are missing", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicId: "pub-ok" }),
  });

  const response = await galleryBrandingHandler(request, {
    createClient: () =>
      createMockSupabase({
        galleryRow: { session_id: "session-1", project_id: null, title: "Eda & Mert" },
        sessionRow: { organization_id: "org-1" },
        settingsRow: null,
      }),
  });

  assertEquals(response.status, 200);
  const body = await readJson(response);
  assertEquals(body, { logoUrl: null, businessName: null, galleryTitle: "Eda & Mert" });
});
