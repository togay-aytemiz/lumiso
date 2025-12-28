import { assertEquals } from "std/testing/asserts.ts";
import {
  cleanupExpiredJobs,
  handler as galleryDownloadProcessorHandler,
  processPendingJobs,
} from "../gallery-download-processor/index.ts";

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function createMockSupabase(options: {
  pendingJobs?: Array<{ id: string; gallery_id: string; status: string; asset_variant: string; expires_at: string; storage_path: string | null }>;
  expiredJobs?: Array<{ id: string; gallery_id: string; status: string; asset_variant: string; expires_at: string; storage_path: string | null }>;
}) {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];
  const removedPaths: string[] = [];

  const storage = {
    from(_bucket: string) {
      return {
        async upload() {
          return { data: null, error: null };
        },
        async remove(paths: string[]) {
          removedPaths.push(...paths);
          return { data: null, error: null };
        },
      };
    },
  };

  const from = (table: string) => {
    const resolve = () => {
      if (table === "gallery_download_jobs") {
        return { data: options.pendingJobs ?? options.expiredJobs ?? [], error: null };
      }
      return { data: [], error: null };
    };

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
      lte(_column: string, _value: unknown) {
        return builder;
      },
      neq(_column: string, _value: unknown) {
        return builder;
      },
      order(_column: string) {
        return builder;
      },
      limit(_count: number) {
        return builder;
      },
      update(values: Record<string, unknown>) {
        updates.push({ table, values });
        return builder;
      },
      maybeSingle<T>() {
        return Promise.resolve({ data: null as T | null, error: null });
      },
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(resolve()).then(onFulfilled, onRejected);
      },
    };

    return builder;
  };

  return { from, storage, __updates: updates, __removedPaths: removedPaths };
}

Deno.test("processPendingJobs returns zero when there are no pending jobs", async () => {
  const supabase = createMockSupabase({ pendingJobs: [] });
  const result = await processPendingJobs(supabase);

  assertEquals(result.processed, 0);
  assertEquals(result.errors.length, 0);
});

Deno.test("cleanupExpiredJobs removes storage paths and marks expired", async () => {
  const supabase = createMockSupabase({
    expiredJobs: [
      {
        id: "job-1",
        gallery_id: "gallery-1",
        status: "ready",
        asset_variant: "web",
        expires_at: "2024-01-01T00:00:00Z",
        storage_path: "gallery-1/job-1.zip",
      },
      {
        id: "job-2",
        gallery_id: "gallery-2",
        status: "failed",
        asset_variant: "web",
        expires_at: "2024-01-01T00:00:00Z",
        storage_path: null,
      },
    ],
  });

  const result = await cleanupExpiredJobs(supabase);

  assertEquals(result.cleaned, 2);
  assertEquals(supabase.__removedPaths, ["gallery-1/job-1.zip"]);
  assertEquals(supabase.__updates.length, 2);
});

Deno.test("gallery-download-processor handler rejects unauthorized requests", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "tick" }),
  });

  const response = await galleryDownloadProcessorHandler(request, {
    authorizeRequest: () =>
      new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
  });

  assertEquals(response.status, 403);
  const body = await readJson(response);
  assertEquals(body, { error: "Access denied" });
});

Deno.test("gallery-download-processor handler processes when authorized", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "tick" }),
  });

  const response = await galleryDownloadProcessorHandler(request, {
    authorizeRequest: () => null,
    createClient: () => createMockSupabase({ pendingJobs: [], expiredJobs: [] }),
  });

  assertEquals(response.status, 200);
  const body = await readJson(response);
  assertEquals(body.success, true);
});
