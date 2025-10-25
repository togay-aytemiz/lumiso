import { assertEquals, assert } from "std/testing/asserts.ts";
import { handler as scheduleDailyNotificationsHandler } from "../schedule-daily-notifications/index.ts";

type SupabaseResponse<T> = { data: T; error: Error | null };

type NotificationsFilter = {
  organization_id?: string;
  user_id?: string;
};

interface SupabaseStubOptions {
  userSettings: Array<{
    user_id: string;
    active_organization_id: string;
    notification_scheduled_time: string;
  }>;
  organizations: Array<{ id: string; owner_id: string; name: string }>;
  existingNotifications?: Map<string, { id: string }>;
  insertError?: Error | null;
}

function createSupabaseStub(options: SupabaseStubOptions) {
  const insertedNotifications: Array<Record<string, unknown>> = [];
  const invokeCalls: Array<{ name: string; body: unknown }> = [];
  const existing = options.existingNotifications ?? new Map<string, { id: string }>();

  return {
    supabase: {
      from(table: string) {
        if (table === "user_settings") {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            not() {
              const response: SupabaseResponse<typeof options.userSettings> = {
                data: options.userSettings,
                error: null,
              };
              return Promise.resolve(response);
            },
          };
        }

        if (table === "organizations") {
          return {
            select() {
              return this;
            },
            in() {
              const response: SupabaseResponse<typeof options.organizations> = {
                data: options.organizations,
                error: null,
              };
              return Promise.resolve(response);
            },
          };
        }

        if (table === "notifications") {
          const filters: NotificationsFilter = {};
          return {
            select() {
              return this;
            },
            eq(field: "organization_id" | "user_id" | "notification_type", value: string) {
              if (field === "organization_id" || field === "user_id") {
                filters[field] = value;
              }
              return this;
            },
            gte() {
              return this;
            },
            lt() {
              return this;
            },
            maybeSingle() {
              const key = `${filters.organization_id ?? ""}:${filters.user_id ?? ""}`;
              const found = existing.get(key) ?? null;
              const response: SupabaseResponse<typeof found> = {
                data: found,
                error: null,
              };
              return Promise.resolve(response);
            },
            insert(payload: Array<Record<string, unknown>>) {
              insertedNotifications.push(...payload);
              return Promise.resolve({ error: options.insertError ?? null });
            },
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
      functions: {
        async invoke(name: string, { body }: { body: Record<string, unknown> }) {
          invokeCalls.push({ name, body });
          return { data: null, error: null };
        },
      },
    },
    insertedNotifications,
    invokeCalls,
  };
}

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

Deno.test("schedule-daily-notifications returns early when no users are scheduled", async () => {
  const stub = createSupabaseStub({
    userSettings: [],
    organizations: [],
  });

  const now = new Date("2025-05-01T09:30:00.000Z");
  const request = new Request("https://example.com", { method: "POST" });
  const response = await scheduleDailyNotificationsHandler(request, {
    createClient: () => stub.supabase,
    getNow: () => now,
  });

  assertEquals(response.status, 200);
  const body = await readJson(response);
  assertEquals(body, {
    success: true,
    message: "No users scheduled for 09:30",
    processed: 0,
  });
  assertEquals(stub.insertedNotifications.length, 0);
  assertEquals(stub.invokeCalls.length, 0);
});

Deno.test("schedule-daily-notifications inserts notifications for eligible users", async () => {
  const stub = createSupabaseStub({
    userSettings: [
      {
        user_id: "user-1",
        active_organization_id: "org-1",
        notification_scheduled_time: "09:30",
      },
      {
        user_id: "user-2",
        active_organization_id: "org-2",
        notification_scheduled_time: "09:30",
      },
    ],
    organizations: [
      { id: "org-1", owner_id: "owner-1", name: "Org One" },
      { id: "org-2", owner_id: "owner-2", name: "Org Two" },
    ],
  });

  const now = new Date("2025-05-01T09:30:00.000Z");
  const request = new Request("https://example.com", { method: "POST" });
  const response = await scheduleDailyNotificationsHandler(request, {
    createClient: () => stub.supabase,
    getNow: () => now,
  });

  assertEquals(response.status, 200);
  const body = await readJson(response);
  assertEquals(body.success, true);
  assertEquals(body.processed, 2);
  assertEquals(body.users, ["user-1", "user-2"]);

  assertEquals(stub.insertedNotifications.length, 2);
  for (const notification of stub.insertedNotifications) {
    assertEquals(notification.notification_type, "daily-summary");
    assertEquals(notification.delivery_method, "scheduled");
    assertEquals(notification.scheduled_for, now.toISOString());
    assert(typeof notification.metadata === "object");
    assertEquals((notification.metadata as Record<string, unknown>).date, "2025-05-01");
  }

  assertEquals(stub.invokeCalls, [
    { name: "notification-processor", body: { action: "process-pending" } },
  ]);
});

Deno.test("schedule-daily-notifications skips users with existing notifications", async () => {
  const stub = createSupabaseStub({
    userSettings: [
      {
        user_id: "user-1",
        active_organization_id: "org-1",
        notification_scheduled_time: "09:30",
      },
    ],
    organizations: [{ id: "org-1", owner_id: "owner-1", name: "Org One" }],
    existingNotifications: new Map([["org-1:user-1", { id: "existing" }]]),
  });

  const now = new Date("2025-05-01T09:30:00.000Z");
  const request = new Request("https://example.com", { method: "POST" });
  const response = await scheduleDailyNotificationsHandler(request, {
    createClient: () => stub.supabase,
    getNow: () => now,
  });

  assertEquals(response.status, 200);
  const body = await readJson(response);
  assertEquals(body.processed, 0);
  assertEquals(stub.insertedNotifications.length, 0);
  assertEquals(stub.invokeCalls.length, 0);
});
