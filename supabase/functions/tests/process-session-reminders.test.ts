import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { processScheduledReminders } from "../process-session-reminders/index.ts";

type ReminderSession = {
  id: string;
  session_date: string;
  session_time: string;
  session_type_id: string | null;
  session_types: {
    id: string;
    name: string;
    duration_minutes: number | null;
  } | null;
  location: string | null;
  notes: string | null;
  leads: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
};

type ReminderWorkflow = {
  id: string;
  name: string;
} | null;

type Reminder = {
  id: string;
  session_id: string;
  reminder_type: string;
  scheduled_for: string;
  organization_id: string;
  workflow_id: string | null;
  sessions: ReminderSession | null;
  workflows?: ReminderWorkflow;
};

type StubOptions = {
  dueReminders?: Reminder[];
  fetchError?: Error;
  triggerError?: string;
  cleanupError?: Error;
  cleanupResult?: number;
  updateResponses?: Array<{ error: { message: string } | null }>;
};

type UpdateCall = {
  table: string;
  values: Record<string, unknown>;
  filters: Array<{ field: string; value: unknown }>;
};

type SelectCall = {
  table: string;
  filters: Array<{ type: "eq" | "lte"; field: string; value: unknown }>;
  orderBy?: string;
};

function createSupabaseStub(options: StubOptions = {}) {
  const selectCalls: SelectCall[] = [];
  const updateCalls: UpdateCall[] = [];
  const invokeCalls: Array<{ name: string; payload: unknown }> = [];
  const rpcCalls: string[] = [];
  const updateResponses = [...(options.updateResponses ?? [])];

  class SelectQuery {
    private filters: Array<{ type: "eq" | "lte"; field: string; value: unknown }> = [];
    constructor(private readonly table: string) {}

    eq(field: string, value: unknown) {
      this.filters.push({ type: "eq", field, value });
      return this;
    }

    lte(field: string, value: unknown) {
      this.filters.push({ type: "lte", field, value });
      return this;
    }

    order(field: string) {
      selectCalls.push({
        table: this.table,
        filters: [...this.filters],
        orderBy: field,
      });

      if (options.fetchError) {
        return Promise.resolve({ data: null, error: options.fetchError });
      }

      return Promise.resolve({ data: options.dueReminders ?? [], error: null });
    }
  }

  class UpdateQuery {
    private readonly filters: Array<{ field: string; value: unknown }> = [];
    constructor(private readonly table: string, private readonly values: Record<string, unknown>) {}

    eq(field: string, value: unknown) {
      this.filters.push({ field, value });
      return this;
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: { error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | undefined,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined,
    ) {
      updateCalls.push({ table: this.table, values: this.values, filters: [...this.filters] });
      const response = updateResponses.length > 0 ? updateResponses.shift()! : { error: null };
      return Promise.resolve(response).then(onfulfilled, onrejected);
    }
  }

  return {
    selectCalls,
    updateCalls,
    invokeCalls,
    rpcCalls,
    from(table: string) {
      if (table === "scheduled_session_reminders") {
        return {
          select: () => new SelectQuery(table),
          update: (values: Record<string, unknown>) => new UpdateQuery(table, values),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    functions: {
      invoke: async (name: string, payload: unknown) => {
        invokeCalls.push({ name, payload });
        if (options.triggerError) {
          return { error: { message: options.triggerError } };
        }
        return { error: null };
      },
    },
    rpc: async (name: string) => {
      rpcCalls.push(name);
      if (options.cleanupError) {
        return { data: null, error: options.cleanupError };
      }
      return { data: options.cleanupResult ?? 0, error: null };
    },
  };
}

function buildReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    session_id: overrides.session_id ?? "session-123",
    reminder_type: overrides.reminder_type ?? "email",
    scheduled_for: overrides.scheduled_for ?? new Date().toISOString(),
    organization_id: overrides.organization_id ?? "org-1",
    workflow_id: overrides.workflow_id ?? "workflow-1",
    sessions: overrides.sessions ?? {
      id: "session-123",
      session_date: "2025-01-01",
      session_time: "10:00",
      session_type_id: "type-1",
      session_types: {
        id: "type-1",
        name: "Signature",
        duration_minutes: 90,
      },
      location: "Studio",
      notes: "Bring props",
      leads: {
        id: "lead-1",
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "+15555550123",
      },
    },
    workflows: overrides.workflows ?? null,
  };
}

Deno.test("throws when fetching due reminders fails", async () => {
  const fetchError = new Error("unable to load reminders");
  const supabase = createSupabaseStub({ fetchError });

  await assertRejects(() => processScheduledReminders(supabase as unknown as Parameters<typeof processScheduledReminders>[0]), Error, "unable to load reminders");
  assertEquals(supabase.invokeCalls.length, 0);
});

Deno.test("returns zero counts when no reminders are due", async () => {
  const supabase = createSupabaseStub({ dueReminders: [] });

  const result = await processScheduledReminders(supabase as unknown as Parameters<typeof processScheduledReminders>[0]);

  assertEquals(result, { processed: 0, triggered: 0, failed: 0 });
  assertEquals(supabase.invokeCalls.length, 0);
  assertEquals(supabase.updateCalls.length, 0);
});

Deno.test("marks reminders with missing session data as failed", async () => {
  const reminder = buildReminder();
  (reminder as unknown as { sessions: Reminder["sessions"] | null }).sessions = null;
  const supabase = createSupabaseStub({ dueReminders: [reminder] });

  const result = await processScheduledReminders(supabase as unknown as Parameters<typeof processScheduledReminders>[0]);

  assertEquals(result, { processed: 1, triggered: 0, failed: 1 });
  assertEquals(supabase.updateCalls.length, 1);
  assertEquals(supabase.updateCalls[0].values.status, "failed");
  assertEquals(supabase.updateCalls[0].values.error_message, "Invalid session or lead data");
});

Deno.test("records failures when workflow trigger errors occur", async () => {
  const reminder = buildReminder();
  const supabase = createSupabaseStub({ dueReminders: [reminder], triggerError: "workflow failed" });

  const result = await processScheduledReminders(supabase as unknown as Parameters<typeof processScheduledReminders>[0]);

  assertEquals(result, { processed: 1, triggered: 0, failed: 1 });
  assertEquals(supabase.invokeCalls.length, 1);
  assertEquals(supabase.invokeCalls[0].name, "workflow-executor");
  assertEquals(supabase.updateCalls.length, 2);
  assertEquals(supabase.updateCalls[0].values.status, "sent");
  assertEquals(supabase.updateCalls[1].values.status, "failed");
});

Deno.test("successfully triggers workflows for valid reminders", async () => {
  const reminder = buildReminder();
  const supabase = createSupabaseStub({ dueReminders: [reminder], cleanupResult: 2 });

  const result = await processScheduledReminders(supabase as unknown as Parameters<typeof processScheduledReminders>[0]);

  assertEquals(result, { processed: 1, triggered: 1, failed: 0 });
  assertEquals(supabase.invokeCalls.length, 1);
  const payload = supabase.invokeCalls[0].payload as {
    body: {
      action?: string;
      trigger_type?: string;
      trigger_data?: {
        reminder_type?: string;
        session_data?: {
          session_type_id?: string | null;
          session_type_name?: string | null;
          session_type_duration_minutes?: number | null;
        };
      };
    };
  };
  assertEquals(payload.body.action, "trigger");
  assertEquals(payload.body.trigger_type, "session_reminder");
  assertEquals(payload.body.trigger_data?.reminder_type, reminder.reminder_type);
  assertEquals(payload.body.trigger_data?.session_data?.session_type_id, "type-1");
  assertEquals(payload.body.trigger_data?.session_data?.session_type_name, "Signature");
  assertEquals(payload.body.trigger_data?.session_data?.session_type_duration_minutes, 90);
  assertEquals(supabase.rpcCalls, ["cleanup_old_session_reminders"]);
});
