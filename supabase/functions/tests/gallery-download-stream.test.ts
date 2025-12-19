import { assertEquals, assertMatch } from "std/testing/asserts.ts";
import { handler as galleryDownloadStreamHandler } from "../gallery-download-stream/index.ts";

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

type MockOptions = {
  userId?: string | null;
  gallery?: { id: string; title: string; type: string; session_id: string | null } | null;
  session?: { id: string; organization_id: string | null } | null;
  organization?: { id: string; owner_id: string } | null;
  grant?: { gallery_id: string; viewer_id: string; expires_at: string } | null;
};

function createMockSupabase(options: MockOptions) {
  const auth = {
    async getUser(_jwt: string) {
      if (!options.userId) {
        return { data: { user: null }, error: new Error("no user") };
      }
      return { data: { user: { id: options.userId } }, error: null };
    },
  };

  const from = (table: string) => {
    const builder = {
      select(_columns: string) {
        return builder;
      },
      eq(_column: string, _value: unknown) {
        return builder;
      },
      gt(_column: string, _value: unknown) {
        return builder;
      },
      order(_column: string, _options?: { ascending?: boolean }) {
        return builder;
      },
      range(_from: number, _to: number) {
        return builder;
      },
      maybeSingle<T>() {
        if (table === "galleries") {
          return Promise.resolve({ data: options.gallery ?? null, error: null }) as Promise<{
            data: T | null;
            error: Error | null;
          }>;
        }
        if (table === "sessions") {
          return Promise.resolve({ data: options.session ?? null, error: null }) as Promise<{
            data: T | null;
            error: Error | null;
          }>;
        }
        if (table === "organizations") {
          return Promise.resolve({ data: options.organization ?? null, error: null }) as Promise<{
            data: T | null;
            error: Error | null;
          }>;
        }
        if (table === "gallery_access_grants") {
          return Promise.resolve({ data: options.grant ?? null, error: null }) as Promise<{
            data: T | null;
            error: Error | null;
          }>;
        }
        return Promise.resolve({ data: null, error: null }) as Promise<{ data: T | null; error: Error | null }>;
      },
    };

    return builder;
  };

  return { auth, from };
}

const createMockStream = () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("zip"));
      controller.close();
    },
  });
  return { stream, done: Promise.resolve() };
};

Deno.test("gallery-download-stream returns 401 when access token is missing", async () => {
  const url = new URL("https://example.com");
  url.searchParams.set("galleryId", "gallery-1");
  const request = new Request(url.toString());

  const response = await galleryDownloadStreamHandler(request, {
    createClient: () => createMockSupabase({ userId: "viewer-1" }),
    streamZip: async () => createMockStream(),
  });

  assertEquals(response.status, 401);
  const body = await readJson(response);
  assertEquals(body, { error: "accessToken is required" });
});

Deno.test("gallery-download-stream returns 403 when access is denied", async () => {
  const url = new URL("https://example.com");
  url.searchParams.set("galleryId", "gallery-1");
  url.searchParams.set("accessToken", "token");
  const request = new Request(url.toString());

  const response = await galleryDownloadStreamHandler(request, {
    createClient: () =>
      createMockSupabase({
        userId: "viewer-1",
        gallery: { id: "gallery-1", title: "Gallery", type: "proof", session_id: "session-1" },
        session: { id: "session-1", organization_id: "org-1" },
        organization: { id: "org-1", owner_id: "owner-1" },
        grant: null,
      }),
    streamZip: async () => createMockStream(),
  });

  assertEquals(response.status, 403);
  const body = await readJson(response);
  assertEquals(body, { error: "Access denied" });
});

Deno.test("gallery-download-stream streams zip when access is granted", async () => {
  const url = new URL("https://example.com");
  url.searchParams.set("galleryId", "gallery-1");
  url.searchParams.set("accessToken", "token");
  url.searchParams.set("downloadFileName", "My Download.zip");
  const request = new Request(url.toString());

  let receivedParams: { galleryId: string; assetVariant: string } | null = null;

  const response = await galleryDownloadStreamHandler(request, {
    createClient: () =>
      createMockSupabase({
        userId: "viewer-1",
        gallery: { id: "gallery-1", title: "Gallery", type: "final", session_id: null },
        grant: {
          gallery_id: "gallery-1",
          viewer_id: "viewer-1",
          expires_at: new Date(Date.now() + 1000).toISOString(),
        },
      }),
    streamZip: async (_supabase, params) => {
      receivedParams = params;
      return createMockStream();
    },
  });

  assertEquals(response.status, 200);
  assertEquals(receivedParams?.assetVariant, "original");
  assertEquals(response.headers.get("Content-Type"), "application/zip");
  assertMatch(response.headers.get("Content-Disposition") ?? "", /My_Download\.zip/);
});
