import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { deleteSessionTypeWithClient, SESSION_TYPE_IN_USE_CODE } from "../session-types-delete/index.ts";

type StubOptions = {
  sessionCount?: number;
  selectError?: Error;
  deleteError?: Error;
};

type SelectCall = {
  table: string;
  field: string;
  value: unknown;
};

type DeleteCall = {
  table: string;
  field: string;
  value: unknown;
};

function createSupabaseStub(options: StubOptions = {}) {
  const selectCalls: SelectCall[] = [];
  const deleteCalls: DeleteCall[] = [];

  return {
    selectCalls,
    deleteCalls,
    from(table: string) {
      return {
        select(_columns: string, _options?: Record<string, unknown>) {
          return {
            eq(field: string, value: unknown) {
              selectCalls.push({ table, field, value });
              if (options.selectError) {
                return Promise.resolve({ data: null, error: options.selectError, count: null });
              }
              return Promise.resolve({ data: null, error: null, count: options.sessionCount ?? 0 });
            },
          };
        },
        delete() {
          return {
            eq(field: string, value: unknown) {
              deleteCalls.push({ table, field, value });
              if (options.deleteError) {
                return Promise.resolve({ error: options.deleteError });
              }
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

Deno.test("returns 400 when session type id is missing", async () => {
  const stub = createSupabaseStub();
  const result = await deleteSessionTypeWithClient(stub, undefined);
  assertEquals(result.status, 400);
});

Deno.test("returns 500 when count query fails", async () => {
  const stub = createSupabaseStub({ selectError: new Error("select failed") });
  const result = await deleteSessionTypeWithClient(stub, "type-1");
  assertEquals(result.status, 500);
  assertEquals(result.message, "select failed");
});

Deno.test("returns 409 when session type is in use", async () => {
  const stub = createSupabaseStub({ sessionCount: 3 });
  const result = await deleteSessionTypeWithClient(stub, "type-2");
  assertEquals(result.status, 409);
  assertEquals(result.message, SESSION_TYPE_IN_USE_CODE);
});

Deno.test("returns 500 when delete operation fails", async () => {
  const stub = createSupabaseStub({ deleteError: new Error("delete failed") });
  const result = await deleteSessionTypeWithClient(stub, "type-3");
  assertEquals(result.status, 500);
  assertEquals(result.message, "delete failed");
});

Deno.test("deletes session type when not referenced", async () => {
  const stub = createSupabaseStub({ sessionCount: 0 });
  const result = await deleteSessionTypeWithClient(stub, "type-4");
  assertEquals(result.status, 200);
  assertEquals(stub.selectCalls.length, 1);
  assertEquals(stub.selectCalls[0], {
    table: "sessions",
    field: "session_type_id",
    value: "type-4",
  });
  assertEquals(stub.deleteCalls.length, 1);
  assertEquals(stub.deleteCalls[0], {
    table: "session_types",
    field: "id",
    value: "type-4",
  });
});
