import { assertEquals } from "std/testing/asserts.ts";
import {
  handler as adminGalleryDeleteHandler,
  type SupabaseAdminLike,
} from "../admin-gallery-delete/index.ts";

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

type MockOptions = {
  userId?: string | null;
  isAdmin?: boolean;
  gallery?: { id: string; title: string; sessionId: string | null } | null;
  organizationId?: string | null;
  assets?: Array<{ web: string | null; original: string | null; thumb?: string | null }>;
};

type SupabaseAdminMock = SupabaseAdminLike & {
  __removeCalls: string[][];
  __deleteCalls: Array<{ table: string; id: unknown }>;
};

function createMockSupabase(options: MockOptions): SupabaseAdminMock {
  const removeCalls: string[][] = [];
  const deleteCalls: Array<{ table: string; id: unknown }> = [];

  const mock: SupabaseAdminMock = {
    auth: {
      async getUser(_jwt: string) {
        if (!options.userId) {
          return { data: { user: null }, error: new Error("no user") };
        }
        return { data: { user: { id: options.userId } }, error: null };
      },
    },
    storage: {
      from(_bucketId: string) {
        return {
          async list(path = "", listOptions?: Record<string, unknown>) {
            const offset = typeof listOptions?.offset === "number" ? listOptions.offset : 0;
            if (offset > 0) {
              return { data: [], error: null };
            }
            return { data: [{ name: "extra.webp" }], error: null };
          },
          async remove(paths: string[]) {
            removeCalls.push(paths);
            return { data: null, error: null };
          },
        };
      },
    },
    from(table: string) {
      const filters: Record<string, unknown> = {};
      let mode: "select" | "delete" = "select";

      const builder = {
        select(_columns: string) {
          return builder;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return builder;
        },
        delete() {
          mode = "delete";
          return builder;
        },
        async maybeSingle<T>() {
          if (table === "user_roles") {
            if (options.isAdmin) {
              return { data: { id: "role-1" } as unknown as T, error: null };
            }
            return { data: null, error: null };
          }

          if (table === "galleries") {
            if (filters.id === options.gallery?.id && options.gallery) {
              return {
                data: {
                  id: options.gallery.id,
                  title: options.gallery.title,
                  session_id: options.gallery.sessionId,
                } as unknown as T,
                error: null,
              };
            }
            return { data: null, error: null };
          }

          return { data: null, error: null };
        },
        async single<T>() {
          if (table === "sessions") {
            return {
              data: { organization_id: options.organizationId ?? null } as unknown as T,
              error: null,
            };
          }
          return { data: null, error: null };
        },
        then<TResult>(onFulfilled: (value: { data: unknown; error: unknown }) => TResult) {
          if (table === "gallery_assets" && mode === "select") {
            const rows = (options.assets ?? []).map((asset) => ({
              storage_path_web: asset.web,
              storage_path_original: asset.original,
              metadata: asset.thumb ? { thumbPath: asset.thumb } : null,
            }));
            return Promise.resolve(onFulfilled({ data: rows, error: null }));
          }

          if (table === "galleries" && mode === "delete") {
            deleteCalls.push({ table, id: filters.id });
            return Promise.resolve(onFulfilled({ data: null, error: null }));
          }

          return Promise.resolve(onFulfilled({ data: null, error: null }));
        },
      };

      return builder;
    },
    __removeCalls: removeCalls,
    __deleteCalls: deleteCalls,
  };

  return mock;
}

Deno.test("admin-gallery-delete returns 401 when authorization header is missing", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gallery_id: "gallery-1" }),
  });

  const response = await adminGalleryDeleteHandler(request, {
    createClient: () =>
      createMockSupabase({
        userId: "admin-1",
        isAdmin: true,
        gallery: { id: "gallery-1", title: "Gallery", sessionId: "session-1" },
        organizationId: "org-1",
      }),
  });

  assertEquals(response.status, 401);
  const body = await readJson(response);
  assertEquals(body, { error: "Authorization header required" });
});

Deno.test("admin-gallery-delete returns 403 when user is not admin", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: "Bearer token" },
    body: JSON.stringify({ gallery_id: "gallery-1" }),
  });

  const response = await adminGalleryDeleteHandler(request, {
    createClient: () =>
      createMockSupabase({
        userId: "user-1",
        isAdmin: false,
        gallery: { id: "gallery-1", title: "Gallery", sessionId: "session-1" },
        organizationId: "org-1",
      }),
  });

  assertEquals(response.status, 403);
  const body = await readJson(response);
  assertEquals(body, { error: "Admin role required" });
});

Deno.test("admin-gallery-delete returns 400 when confirm title is provided but does not match", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: "Bearer token" },
    body: JSON.stringify({ gallery_id: "gallery-1", confirm_title: "Wrong" }),
  });

  const response = await adminGalleryDeleteHandler(request, {
    createClient: () =>
      createMockSupabase({
        userId: "admin-1",
        isAdmin: true,
        gallery: { id: "gallery-1", title: "Gallery", sessionId: "session-1" },
        organizationId: "org-1",
      }),
  });

  assertEquals(response.status, 400);
  const body = await readJson(response);
  assertEquals(body, { error: "confirm_title does not match gallery title" });
});

Deno.test("admin-gallery-delete removes storage paths and deletes gallery", async () => {
  const mockSupabase = createMockSupabase({
    userId: "admin-1",
    isAdmin: true,
    gallery: { id: "gallery-1", title: "Gallery", sessionId: "session-1" },
    organizationId: "org-1",
    assets: [
      { web: "org-1/galleries/gallery-1/proof/a.webp", original: null },
      { web: null, original: "org-1/galleries/gallery-1/original/a.jpg" },
    ],
  });

  const request = new Request("https://example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: "Bearer token" },
    body: JSON.stringify({ gallery_id: "gallery-1" }),
  });

  const response = await adminGalleryDeleteHandler(request, {
    createClient: () => mockSupabase,
  });

  assertEquals(response.status, 200);
  const body = await readJson(response);
  assertEquals(body, { success: true });

  assertEquals(mockSupabase.__removeCalls.length > 0, true);
  assertEquals(mockSupabase.__deleteCalls.length, 1);
  assertEquals(mockSupabase.__deleteCalls[0], { table: "galleries", id: "gallery-1" });
});
