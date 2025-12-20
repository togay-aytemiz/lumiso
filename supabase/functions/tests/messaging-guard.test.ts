import { assertEquals } from "std/testing/asserts.ts";
import { getMessagingGuard } from "../_shared/messaging-guard.ts";

type MaybeSingleRow = { data: Record<string, unknown> | null; error: null };

const createOrgBuilder = (row: Record<string, unknown> | null) => ({
  select() {
    return this;
  },
  eq() {
    return this;
  },
  maybeSingle(): Promise<MaybeSingleRow> {
    return Promise.resolve({ data: row, error: null });
  },
});

Deno.test("getMessagingGuard caches non-blocked org lookups", async () => {
  const orgId = "org-cache-allowed";
  let orgCalls = 0;
  const supabase = {
    from(table: string) {
      if (table === "organizations") {
        orgCalls += 1;
        return createOrgBuilder({
          id: orgId,
          membership_status: "trial",
          trial_expires_at: null,
          premium_expires_at: null,
        });
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as Parameters<typeof getMessagingGuard>[0];

  const now = new Date("2025-01-01T00:00:00Z");
  const first = await getMessagingGuard(supabase, orgId, now);
  const second = await getMessagingGuard(
    supabase,
    orgId,
    new Date(now.getTime() + 1000),
  );

  assertEquals(orgCalls, 1);
  assertEquals(first?.shouldSendExisting, true);
  assertEquals(second?.shouldSendExisting, true);
});

Deno.test("getMessagingGuard caches missing org lookups briefly", async () => {
  const orgId = "org-cache-missing";
  let orgCalls = 0;
  const supabase = {
    from(table: string) {
      if (table === "organizations") {
        orgCalls += 1;
        return createOrgBuilder(null);
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as Parameters<typeof getMessagingGuard>[0];

  const now = new Date("2025-01-01T00:00:00Z");
  const first = await getMessagingGuard(supabase, orgId, now);
  const second = await getMessagingGuard(
    supabase,
    orgId,
    new Date(now.getTime() + 1000),
  );

  assertEquals(orgCalls, 1);
  assertEquals(first, null);
  assertEquals(second, null);
});
