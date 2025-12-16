import { assertEquals } from "std/testing/asserts.ts";
import { handler as galleryAccessHandler } from "../gallery-access/index.ts";

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function createMockSupabase(options: {
  galleryId?: string | null;
  pin?: string | null;
  userId?: string | null;
}) {
  const upserts: Array<{ table: string; values: Record<string, unknown>; options?: unknown }> = [];

  const mock = {
    auth: {
      async getUser(_jwt: string) {
        if (!options.userId) {
          return { data: { user: null }, error: new Error("no user") };
        }
        return { data: { user: { id: options.userId } }, error: null };
      },
    },
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
            if ((publicId === "pub-ok" || publicId === "PUB-OK") && options.galleryId) {
              return { data: { id: options.galleryId } as unknown as T, error: null };
            }
            return { data: null, error: null };
          }

          if (table === "gallery_access") {
            const galleryId = filters.gallery_id;
            if (galleryId === options.galleryId && options.pin) {
              return { data: { pin: options.pin } as unknown as T, error: null };
            }
            return { data: null, error: null };
          }

          return { data: null, error: null };
        },
        async upsert(values: Record<string, unknown>, optionsArg?: unknown) {
          upserts.push({ table, values, options: optionsArg });
          return { data: null, error: null };
        },
      };
    },
    __upserts: upserts,
  };

  return mock;
}

Deno.test("gallery-access returns 401 when authorization header is missing", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicId: "pub-ok", pin: "4T0PXF" }),
  });

  const response = await galleryAccessHandler(request, {
    createClient: () => createMockSupabase({ galleryId: "gallery-1", pin: "4T0PXF", userId: "viewer-1" }),
  });

  assertEquals(response.status, 401);
  const body = await readJson(response);
  assertEquals(body, { error: "Authorization header required" });
});

Deno.test("gallery-access returns 400 when publicId is missing", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: "Bearer token" },
    body: JSON.stringify({ pin: "4T0PXF" }),
  });

  const response = await galleryAccessHandler(request, {
    createClient: () => createMockSupabase({ galleryId: "gallery-1", pin: "4T0PXF", userId: "viewer-1" }),
  });

  assertEquals(response.status, 400);
  const body = await readJson(response);
  assertEquals(body, { error: "publicId is required" });
});

Deno.test("gallery-access returns 400 when pin is invalid", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: "Bearer token" },
    body: JSON.stringify({ publicId: "pub-ok", pin: "123" }),
  });

  const response = await galleryAccessHandler(request, {
    createClient: () => createMockSupabase({ galleryId: "gallery-1", pin: "4T0PXF", userId: "viewer-1" }),
  });

  assertEquals(response.status, 400);
  const body = await readJson(response);
  assertEquals(body, { error: "pin must be 6 characters" });
});

Deno.test("gallery-access returns 404 when gallery is not found", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: "Bearer token" },
    body: JSON.stringify({ publicId: "pub-missing", pin: "4T0PXF" }),
  });

  const response = await galleryAccessHandler(request, {
    createClient: () => createMockSupabase({ galleryId: "gallery-1", pin: "4T0PXF", userId: "viewer-1" }),
  });

  assertEquals(response.status, 404);
  const body = await readJson(response);
  assertEquals(body, { error: "Gallery not found" });
});

Deno.test("gallery-access returns 401 when pin is incorrect", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: "Bearer token" },
    body: JSON.stringify({ publicId: "pub-ok", pin: "AAAAAA" }),
  });

  const response = await galleryAccessHandler(request, {
    createClient: () => createMockSupabase({ galleryId: "gallery-1", pin: "4T0PXF", userId: "viewer-1" }),
  });

  assertEquals(response.status, 401);
  const body = await readJson(response);
  assertEquals(body, { error: "Invalid PIN" });
});

Deno.test("gallery-access upserts a grant and returns galleryId when pin matches", async () => {
  const mockSupabase = createMockSupabase({ galleryId: "gallery-1", pin: "4T0PXF", userId: "viewer-1" });
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: "Bearer token" },
    body: JSON.stringify({ publicId: "pub-ok", pin: "4t0pxf" }),
  });

  const response = await galleryAccessHandler(request, {
    createClient: () => mockSupabase,
  });

  assertEquals(response.status, 200);
  const body = await readJson(response);
  assertEquals(body.galleryId, "gallery-1");
  assertEquals(typeof body.expiresAt, "string");

  assertEquals(mockSupabase.__upserts.length, 1);
  assertEquals(mockSupabase.__upserts[0]?.table, "gallery_access_grants");
  assertEquals(mockSupabase.__upserts[0]?.values.gallery_id, "gallery-1");
  assertEquals(mockSupabase.__upserts[0]?.values.viewer_id, "viewer-1");
});
