import { assertEquals } from "std/testing/asserts.ts";
import {
  handler,
  setSupabaseClientFactoryForTests,
  resetSupabaseClientFactoryForTests,
} from "../simple-daily-notifications/index.ts";

type QueryResult = { data: unknown; error: unknown };

class Query {
  #result: QueryResult;

  constructor(result: QueryResult) {
    this.#result = result;
  }

  select(_columns?: string) {
    return this;
  }

  eq(_field: string, _value: unknown) {
    return this;
  }

  in(_field: string, _value: unknown) {
    return this;
  }

  maybeSingle(): Promise<QueryResult> {
    return Promise.resolve(this.#result);
  }

  single(): Promise<QueryResult> {
    return Promise.resolve(this.#result);
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | Promise<TResult1>) | undefined,
    onrejected?: ((reason: unknown) => TResult2 | Promise<TResult2>) | undefined,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.#result).then(onfulfilled, onrejected);
  }
}

Deno.test("handler returns success payload when no users require processing", async () => {
  setSupabaseClientFactoryForTests(() => ({
    from(table: string): Query {
      if (table === "user_settings") {
        return new Query({ data: [], error: null });
      }
      throw new Error(`Unexpected table ${table}`);
    },
  }));

  const response = await handler(new Request("https://example.com", {
    method: "POST",
    body: JSON.stringify({ action: "process" }),
  }));

  const payload = await response.json();
  assertEquals(response.status, 200);
  assertEquals(payload.success, true);
  assertEquals(payload.processed, 0);
  assertEquals(payload.message, "No users with daily summaries enabled");

  resetSupabaseClientFactoryForTests();
});

Deno.test("handler surfaces fetch errors from user settings query", async () => {
  setSupabaseClientFactoryForTests(() => ({
    from(table: string): Query {
      if (table === "user_settings") {
        return new Query({ data: null, error: { message: "failed to fetch" } });
      }
      throw new Error(`Unexpected table ${table}`);
    },
  }));

  const response = await handler(new Request("https://example.com", {
    method: "POST",
    body: JSON.stringify({ action: "process" }),
  }));

  const payload = await response.json();
  assertEquals(response.status, 500);
  assertEquals(payload.success, false);
  assertEquals(payload.error, "failed to fetch");

  resetSupabaseClientFactoryForTests();
});

Deno.test("handler skips heavy lookups when not at scheduled time", async () => {
  let organizationCalls = 0;
  let profileCalls = 0;
  let authCalls = 0;
  let settingsCalls = 0;

  setSupabaseClientFactoryForTests(() => ({
    from(table: string): Query {
      if (table === "user_settings") {
        return new Query({
          data: [
            {
              user_id: "user-1",
              notification_scheduled_time: "23:59",
              notification_daily_summary_enabled: true,
              notification_global_enabled: true,
            },
          ],
          error: null,
        });
      }
      if (table === "organization_settings") {
        settingsCalls += 1;
        return new Query({
          data: [
            {
              organization_id: "org-1",
              timezone: "UTC",
              preferred_locale: "tr",
              photography_business_name: "Studio",
              primary_brand_color: "#000000",
              date_format: "DD/MM/YYYY",
              time_format: "24-hour",
            },
          ],
          error: null,
        });
      }
      if (table === "organizations") {
        organizationCalls += 1;
        return new Query({
          data: [{ id: "org-1", owner_id: "user-1" }],
          error: null,
        });
      }
      if (table === "profiles") {
        profileCalls += 1;
        return new Query({ data: null, error: null });
      }
      throw new Error(`Unexpected table ${table}`);
    },
    auth: {
      admin: {
        getUserById(_id: string) {
          authCalls += 1;
          return Promise.resolve({ data: { user: null }, error: null });
        },
      },
    },
  }));

  const response = await handler(new Request("https://example.com", {
    method: "POST",
    body: JSON.stringify({ action: "process" }),
  }), { getNow: () => new Date("2025-01-01T00:00:00Z") });

  const payload = await response.json();
  assertEquals(response.status, 200);
  assertEquals(payload.processed, 0);
  assertEquals(payload.skipped.wrongTime, 1);
  assertEquals(organizationCalls, 1);
  assertEquals(profileCalls, 0);
  assertEquals(authCalls, 0);
  assertEquals(settingsCalls, 1);

  resetSupabaseClientFactoryForTests();
});
