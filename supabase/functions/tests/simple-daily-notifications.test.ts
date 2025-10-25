import { assertEquals } from "std/testing/asserts.ts";
import {
  handler,
  setSupabaseClientFactoryForTests,
  resetSupabaseClientFactoryForTests,
} from "../simple-daily-notifications/index.ts";

type UsersQueryResult = { data: unknown; error: unknown };

class UsersQuery {
  #result: UsersQueryResult;

  constructor(result: UsersQueryResult) {
    this.#result = result;
  }

  select(_columns?: string) {
    return this;
  }

  eq(_field: string, _value: unknown) {
    return this;
  }

  then<TResult1 = UsersQueryResult, TResult2 = never>(
    onfulfilled?: ((value: UsersQueryResult) => TResult1 | Promise<TResult1>) | undefined,
    onrejected?: ((reason: unknown) => TResult2 | Promise<TResult2>) | undefined,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.#result).then(onfulfilled, onrejected);
  }
}

Deno.test("handler returns success payload when no users require processing", async () => {
  setSupabaseClientFactoryForTests(() => ({
    from(table: string) {
      if (table === "user_settings") {
        return new UsersQuery({ data: [], error: null });
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
    from(table: string) {
      if (table === "user_settings") {
        return new UsersQuery({ data: null, error: { message: "failed to fetch" } });
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
