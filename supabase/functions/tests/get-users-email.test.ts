import { assertEquals } from "std/testing/asserts.ts";
import { handler as getUsersEmailHandler } from "../get-users-email/index.ts";

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

Deno.test("get-users-email returns user records for valid IDs", async () => {
  const calls: string[] = [];
  const mockSupabase = {
    auth: {
      admin: {
        async getUserById(userId: string) {
          calls.push(userId);
          return {
            data: { user: { id: userId, email: `${userId}@example.com` } },
            error: null,
          };
        },
      },
    },
  };

  const request = new Request("https://example.com", {
    method: "POST",
    body: JSON.stringify({ userIds: ["user-1", "user-2"] }),
    headers: { "Content-Type": "application/json" },
  });

  const response = await getUsersEmailHandler(request, {
    createClient: () => mockSupabase,
  });

  assertEquals(response.status, 200);
  const body = await readJson(response);
  assertEquals(body, {
    users: [
      { id: "user-1", email: "user-1@example.com" },
      { id: "user-2", email: "user-2@example.com" },
    ],
  });
  assertEquals(calls, ["user-1", "user-2"]);
});

Deno.test("get-users-email returns 400 when userIds are missing", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "Content-Type": "application/json" },
  });

  const response = await getUsersEmailHandler(request, {
    createClient: () => {
      throw new Error("should not be called");
    },
  });

  assertEquals(response.status, 400);
  const body = await readJson(response);
  assertEquals(body, { error: "userIds array is required" });
});

Deno.test("get-users-email skips users when Supabase lookup fails", async () => {
  const mockSupabase = {
    auth: {
      admin: {
        async getUserById(userId: string) {
          if (userId === "missing") {
            return { data: null, error: new Error("not found") };
          }

          if (userId === "throws") {
            throw new Error("boom");
          }

          return {
            data: { user: { id: userId, email: `${userId}@example.com` } },
            error: null,
          };
        },
      },
    },
  };

  const request = new Request("https://example.com", {
    method: "POST",
    body: JSON.stringify({ userIds: ["valid", "missing", "throws"] }),
    headers: { "Content-Type": "application/json" },
  });

  const response = await getUsersEmailHandler(request, {
    createClient: () => mockSupabase,
  });

  assertEquals(response.status, 200);
  const body = await readJson(response);
  assertEquals(body, {
    users: [
      { id: "valid", email: "valid@example.com" },
    ],
  });
});
