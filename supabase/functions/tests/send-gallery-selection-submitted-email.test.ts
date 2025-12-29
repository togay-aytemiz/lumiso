import { assertEquals, assertStringIncludes } from "std/testing/asserts.ts";
import type { ResendClient } from "../_shared/resend-utils.ts";
import { handler } from "../send-gallery-selection-submitted-email/index.ts";

type QueryResult = { data: unknown; error: unknown };

class MockQuery implements PromiseLike<QueryResult> {
  #table: string;
  #filters: Record<string, unknown> = {};
  #resolver: (table: string, filters: Record<string, unknown>) => QueryResult;

  constructor(
    table: string,
    resolver: (table: string, filters: Record<string, unknown>) => QueryResult,
  ) {
    this.#table = table;
    this.#resolver = resolver;
  }

  select(_columns?: string) {
    return this;
  }

  eq(field: string, value: unknown) {
    this.#filters[field] = value;
    return this;
  }

  gt(field: string, value: unknown) {
    this.#filters[field] = value;
    return this;
  }

  gte(field: string, value: unknown) {
    this.#filters[field] = value;
    return this;
  }

  lt(field: string, value: unknown) {
    this.#filters[field] = value;
    return this;
  }

  in(field: string, value: unknown) {
    this.#filters[field] = value;
    return this;
  }

  order(_column: string, _options?: { ascending?: boolean | null }) {
    return this;
  }

  limit(_count: number) {
    return this;
  }

  maybeSingle<T>(): Promise<{ data: T | null; error: unknown }> {
    return Promise.resolve(this.#resolver(this.#table, this.#filters) as unknown as {
      data: T | null;
      error: unknown;
    });
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | Promise<TResult1>) | undefined,
    onrejected?: ((reason: unknown) => TResult2 | Promise<TResult2>) | undefined,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.#resolver(this.#table, this.#filters)).then(onfulfilled, onrejected);
  }
}

Deno.test("handler sends selection submitted email with verified sender domain", async () => {
  const now = new Date("2025-01-01T00:00:00.000Z");
  const galleryId = "gallery-1";
  const viewerId = "viewer-1";
  const organizationId = "org-1";

  const resolveTable = (table: string, _filters: Record<string, unknown>): QueryResult => {
    switch (table) {
      case "gallery_access_grants":
        return {
          data: {
            gallery_id: galleryId,
            viewer_id: viewerId,
            expires_at: "2025-01-02T00:00:00.000Z",
          },
          error: null,
        };
      case "gallery_selection_states":
        return {
          data: {
            gallery_id: galleryId,
            is_locked: true,
            locked_by: viewerId,
            locked_at: now.toISOString(),
            note: null,
          },
          error: null,
        };
      case "galleries":
        return {
          data: {
            id: galleryId,
            title: "Test Gallery",
            type: "proof",
            branding: null,
            session_id: "session-1",
            project_id: null,
          },
          error: null,
        };
      case "sessions":
        return {
          data: {
            organization_id: organizationId,
            lead_id: "lead-1",
            user_id: "creator-1",
          },
          error: null,
        };
      case "organization_settings":
        return {
          data: {
            email: null,
            photography_business_name: "Lumiso",
            primary_brand_color: "#1EB29F",
            logo_url: null,
            preferred_locale: "tr",
            notification_global_enabled: true,
          },
          error: null,
        };
      case "organizations":
        return {
          data: {
            id: organizationId,
            membership_status: null,
            trial_expires_at: null,
            premium_expires_at: null,
            owner_id: "owner-1",
          },
          error: null,
        };
      case "leads":
        return { data: { name: "Jordan" }, error: null };
      case "gallery_assets":
        return {
          data: {
            id: "asset-1",
            storage_path_web: "gallery-assets/asset-1.webp",
            status: "ready",
            created_at: now.toISOString(),
          },
          error: null,
        };
      case "client_selections":
        return {
          data: [
            { asset_id: "a-1", selection_part: "part-1" },
            { asset_id: "a-2", selection_part: "part-1" },
            { asset_id: "a-fav", selection_part: "favorites" },
          ],
          error: null,
        };
      case "user_settings":
        return { data: { notification_global_enabled: true }, error: null };
      case "user_language_preferences":
        return { data: { language_code: "tr" }, error: null };
      default:
        throw new Error(`Unexpected table ${table}`);
    }
  };

  const sendCalls: Array<Record<string, unknown>> = [];
  const resendClient: ResendClient = {
    emails: {
      send(payload: Record<string, unknown>) {
        sendCalls.push(payload);
        return Promise.resolve({ data: { id: `email-${sendCalls.length}` }, error: null });
      },
    },
  };

  const userEmails: Record<string, string> = {
    "owner-1": "owner@example.com",
    "creator-1": "creator@example.com",
  };

  const supabaseAdmin = {
    auth: {
      getUser() {
        return Promise.resolve({ data: { user: { id: viewerId } }, error: null });
      },
      admin: {
        getUserById(userId: string) {
          return Promise.resolve({ data: { user: { email: userEmails[userId] } }, error: null });
        },
      },
    },
    from(table: string) {
      return new MockQuery(table, resolveTable);
    },
    storage: {
      from(_bucket: string) {
        return {
          createSignedUrl() {
            return Promise.resolve({ data: { signedUrl: "https://example.com/signed" }, error: null });
          },
        };
      },
    },
  };

  const response = await handler(
    new Request("https://example.com", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ galleryId }),
    }),
    {
      createClient: () => supabaseAdmin as unknown as Parameters<typeof handler>[1]["createClient"] extends
        | (() => infer R)
        | undefined
        ? R
        : never,
      resendClient,
      baseUrlOverride: "https://my.lumiso.app",
      now: () => now,
    },
  );

  assertEquals(response.status, 200);
  assertEquals(sendCalls.length, 2);

  for (const payload of sendCalls) {
    assertEquals(payload.from, "Lumiso <hello@updates.lumiso.app>");
    assertStringIncludes(String(payload.from), "hello@updates.lumiso.app");
  }
});

Deno.test("handler skips sending when gallery selection notifications are disabled", async () => {
  const now = new Date("2025-01-01T00:00:00.000Z");
  const galleryId = "gallery-1";
  const viewerId = "viewer-1";
  const organizationId = "org-1";

  const resolveTable = (table: string, _filters: Record<string, unknown>): QueryResult => {
    switch (table) {
      case "gallery_access_grants":
        return {
          data: {
            gallery_id: galleryId,
            viewer_id: viewerId,
            expires_at: "2025-01-02T00:00:00.000Z",
          },
          error: null,
        };
      case "gallery_selection_states":
        return {
          data: {
            gallery_id: galleryId,
            is_locked: true,
            locked_by: viewerId,
            locked_at: now.toISOString(),
            note: null,
          },
          error: null,
        };
      case "galleries":
        return {
          data: {
            id: galleryId,
            title: "Test Gallery",
            type: "proof",
            branding: null,
            session_id: "session-1",
            project_id: null,
          },
          error: null,
        };
      case "sessions":
        return {
          data: {
            organization_id: organizationId,
            lead_id: "lead-1",
            user_id: "creator-1",
          },
          error: null,
        };
      case "organization_settings":
        return {
          data: {
            email: "owner@example.com",
            photography_business_name: "Lumiso",
            primary_brand_color: "#1EB29F",
            logo_url: null,
            preferred_locale: "tr",
            notification_global_enabled: true,
          },
          error: null,
        };
      case "organizations":
        return {
          data: {
            id: organizationId,
            membership_status: null,
            trial_expires_at: null,
            premium_expires_at: null,
            owner_id: "owner-1",
          },
          error: null,
        };
      case "leads":
        return { data: { name: "Jordan" }, error: null };
      case "gallery_assets":
        return {
          data: {
            id: "asset-1",
            storage_path_web: "gallery-assets/asset-1.webp",
            status: "ready",
            created_at: now.toISOString(),
          },
          error: null,
        };
      case "client_selections":
        return {
          data: [
            { asset_id: "a-1", selection_part: "part-1" },
          ],
          error: null,
        };
      case "user_settings":
        return {
          data: {
            notification_global_enabled: true,
            notification_gallery_selection_enabled: false,
          },
          error: null,
        };
      case "user_language_preferences":
        return { data: { language_code: "tr" }, error: null };
      default:
        throw new Error(`Unexpected table ${table}`);
    }
  };

  const sendCalls: Array<Record<string, unknown>> = [];
  const resendClient: ResendClient = {
    emails: {
      send(payload: Record<string, unknown>) {
        sendCalls.push(payload);
        return Promise.resolve({ data: { id: `email-${sendCalls.length}` }, error: null });
      },
    },
  };

  const userEmails: Record<string, string> = {
    "owner-1": "owner@example.com",
    "creator-1": "creator@example.com",
  };

  const supabaseAdmin = {
    auth: {
      getUser() {
        return Promise.resolve({ data: { user: { id: viewerId } }, error: null });
      },
      admin: {
        getUserById(userId: string) {
          return Promise.resolve({ data: { user: { email: userEmails[userId] } }, error: null });
        },
      },
    },
    from(table: string) {
      return new MockQuery(table, resolveTable);
    },
    storage: {
      from(_bucket: string) {
        return {
          createSignedUrl() {
            return Promise.resolve({ data: { signedUrl: "https://example.com/signed" }, error: null });
          },
        };
      },
    },
  };

  const response = await handler(
    new Request("https://example.com", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ galleryId }),
    }),
    {
      createClient: () => supabaseAdmin as unknown as Parameters<typeof handler>[1]["createClient"] extends
        | (() => infer R)
        | undefined
        ? R
        : never,
      resendClient,
      baseUrlOverride: "https://my.lumiso.app",
      now: () => now,
    },
  );

  assertEquals(response.status, 200);
  const payload = await response.json();
  assertEquals(payload.sent, 0);
  assertEquals(payload.failed, 0);
  assertEquals(sendCalls.length, 0);
});
