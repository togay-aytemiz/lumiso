import { assertEquals } from "std/testing/asserts.ts";
import { handler as galleryDownloadHandler } from "../gallery-download/index.ts";

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
  assets?: { count: number; updatedAt?: string | null } | null;
  existingJob?: {
    id: string;
    gallery_id: string;
    status: string;
    asset_variant: string;
    asset_count: number;
    assets_updated_at: string | null;
    storage_path: string | null;
    expires_at: string;
  } | null;
  insertJob?: { id: string; status: string; expires_at: string } | null;
  signedUrl?: string | null;
};

function createMockSupabase(options: MockOptions) {
  const inserts: Array<{ table: string; values: Record<string, unknown> | Record<string, unknown>[] }> = [];

  const storage = {
    from(_bucket: string) {
      return {
        async createSignedUrl(_path: string) {
          return { data: { signedUrl: options.signedUrl ?? "https://example.com/zip" }, error: null };
        },
      };
    },
  };

  const auth = {
    async getUser(_jwt: string) {
      if (!options.userId) {
        return { data: { user: null }, error: new Error("no user") };
      }
      return { data: { user: { id: options.userId } }, error: null };
    },
  };

  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    const inFilters: Record<string, unknown[]> = {};
    let isInsert = false;

    const resolve = () => {
      if (table === "galleries") {
        return { data: options.gallery ?? null, error: null };
      }
      if (table === "sessions") {
        return { data: options.session ?? null, error: null };
      }
      if (table === "organizations") {
        return { data: options.organization ?? null, error: null };
      }
      if (table === "gallery_access_grants") {
        return { data: options.grant ?? null, error: null };
      }
      if (table === "gallery_assets") {
        const count = options.assets?.count ?? 0;
        return {
          data: count > 0 ? [{ updated_at: options.assets?.updatedAt ?? new Date().toISOString() }] : [],
          error: null,
          count,
        };
      }
      if (table === "gallery_download_jobs") {
        if (isInsert) {
          return { data: options.insertJob ?? { id: "job-1", status: "pending", expires_at: "later" }, error: null };
        }
        return { data: options.existingJob ?? null, error: null };
      }
      return { data: null, error: null };
    };

    const builder = {
      select(_columns: string) {
        return builder;
      },
      eq(column: string, value: unknown) {
        filters[column] = value;
        return builder;
      },
      gt(column: string, value: unknown) {
        filters[column] = value;
        return builder;
      },
      in(column: string, values: unknown[]) {
        inFilters[column] = values;
        return builder;
      },
      order(_column: string) {
        return builder;
      },
      limit(_count: number) {
        return builder;
      },
      insert(values: Record<string, unknown> | Record<string, unknown>[]) {
        inserts.push({ table, values });
        isInsert = true;
        return builder;
      },
      maybeSingle<T>() {
        return Promise.resolve(resolve() as { data: T | null; error: Error | null });
      },
      single<T>() {
        return Promise.resolve(resolve() as { data: T | null; error: Error | null });
      },
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(resolve()).then(onFulfilled, onRejected);
      },
    };

    return builder;
  };

  return { auth, storage, from, __inserts: inserts };
}

Deno.test("gallery-download returns 401 when authorization header is missing", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "request", galleryId: "gallery-1" }),
  });

  const response = await galleryDownloadHandler(request, {
    createClient: () => createMockSupabase({ userId: "viewer-1" }),
  });

  assertEquals(response.status, 401);
  const body = await readJson(response);
  assertEquals(body, { error: "Authorization header required" });
});

Deno.test("gallery-download returns 403 when access is denied", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: "Bearer token" },
    body: JSON.stringify({ action: "request", galleryId: "gallery-1" }),
  });

  const response = await galleryDownloadHandler(request, {
    createClient: () =>
      createMockSupabase({
        userId: "viewer-1",
        gallery: { id: "gallery-1", title: "Gallery", type: "proof", session_id: "session-1" },
        session: { id: "session-1", organization_id: "org-1" },
        organization: { id: "org-1", owner_id: "owner-1" },
        grant: null,
      }),
  });

  assertEquals(response.status, 403);
  const body = await readJson(response);
  assertEquals(body, { error: "Access denied" });
});

Deno.test("gallery-download creates a pending job when none exists", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: "Bearer token" },
    body: JSON.stringify({ action: "request", galleryId: "gallery-1" }),
  });

  const response = await galleryDownloadHandler(request, {
    createClient: () =>
      createMockSupabase({
        userId: "viewer-1",
        gallery: { id: "gallery-1", title: "Gallery", type: "proof", session_id: null },
        grant: {
          gallery_id: "gallery-1",
          viewer_id: "viewer-1",
          expires_at: new Date(Date.now() + 10000).toISOString(),
        },
        assets: { count: 2, updatedAt: "2024-01-01T00:00:00Z" },
        insertJob: { id: "job-1", status: "pending", expires_at: "2024-01-02T00:00:00Z" },
      }),
  });

  assertEquals(response.status, 200);
  const body = await readJson(response);
  assertEquals(body.jobId, "job-1");
  assertEquals(body.status, "pending");
});

Deno.test("gallery-download returns signed url when ready job exists", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: "Bearer token" },
    body: JSON.stringify({ action: "request", galleryId: "gallery-1" }),
  });

  const response = await galleryDownloadHandler(request, {
    createClient: () =>
      createMockSupabase({
        userId: "viewer-1",
        gallery: { id: "gallery-1", title: "Gallery", type: "proof", session_id: null },
        grant: {
          gallery_id: "gallery-1",
          viewer_id: "viewer-1",
          expires_at: new Date(Date.now() + 10000).toISOString(),
        },
        assets: { count: 2, updatedAt: "2024-01-01T00:00:00Z" },
        existingJob: {
          id: "job-1",
          gallery_id: "gallery-1",
          status: "ready",
          asset_variant: "web",
          asset_count: 2,
          assets_updated_at: "2024-01-01T00:00:00Z",
          storage_path: "gallery-1/job-1.zip",
          expires_at: new Date(Date.now() + 10000).toISOString(),
        },
        signedUrl: "https://example.com/zip",
      }),
  });

  assertEquals(response.status, 200);
  const body = await readJson(response);
  assertEquals(body.status, "ready");
  assertEquals(body.downloadUrl, "https://example.com/zip");
});
