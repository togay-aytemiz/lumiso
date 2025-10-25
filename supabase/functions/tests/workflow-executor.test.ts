import { assert, assertEquals } from "std/testing/asserts.ts";
import {
  createWorkflowExecutor,
  evaluateTriggerConditions,
  triggerWorkflows,
  WorkflowExecutorDeps
} from "../workflow-executor/index.ts";

type WorkflowRow = {
  id: string;
  trigger_type: string;
  trigger_entity_type: string;
  organization_id: string;
  is_active: boolean;
  trigger_conditions?: Record<string, unknown> | null;
};

type WorkflowExecutionRow = {
  id: string;
  workflow_id: string;
  trigger_entity_type: string;
  trigger_entity_id: string;
  status: string;
  created_at: string;
  execution_log?: Array<{ trigger_data?: Record<string, unknown> }>;
};

interface SupabaseStubConfig {
  workflows?: WorkflowRow[];
  workflowExecutions?: WorkflowExecutionRow[];
  organizationSettings?: Record<string, unknown>;
  functionResponses?: Record<string, { data?: unknown; error?: unknown }>;
}

class SelectBuilder {
  #rows: any[];
  #filters: Array<(row: any) => boolean> = [];
  #orderField: string | null = null;
  #limitCount: number | null = null;
  #singleMode: "single" | "maybe" | null = null;

  constructor(rows: any[]) {
    this.#rows = rows;
  }

  select(_columns?: string) {
    return this;
  }

  eq(field: string, value: unknown) {
    this.#filters.push(row => row?.[field] === value);
    return this;
  }

  in(field: string, values: unknown[]) {
    this.#filters.push(row => values.includes(row?.[field]));
    return this;
  }

  gte(field: string, value: string) {
    this.#filters.push(row => {
      const rowValue = row?.[field];
      return typeof rowValue === "string" ? rowValue >= value : false;
    });
    return this;
  }

  lt(field: string, value: string) {
    this.#filters.push(row => {
      const rowValue = row?.[field];
      return typeof rowValue === "string" ? rowValue < value : false;
    });
    return this;
  }

  order(field: string) {
    this.#orderField = field;
    return this;
  }

  limit(count: number) {
    this.#limitCount = count;
    const { data, error } = this.#build();
    return Promise.resolve({ data: data.slice(0, count), error });
  }

  maybeSingle() {
    this.#singleMode = "maybe";
    return this.then(result => result);
  }

  single() {
    this.#singleMode = "single";
    return this.then(result => result);
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: null }) => TResult1 | Promise<TResult1>) | undefined,
    onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.#build()).then(onfulfilled, onrejected);
  }

  #build() {
    let data = this.#rows.filter(row => this.#filters.every(filter => filter(row)));

    if (this.#orderField) {
      const orderKey = this.#orderField;
      data = [...data].sort((a, b) => {
        const av = a?.[orderKey];
        const bv = b?.[orderKey];
        if (typeof av === "number" && typeof bv === "number") {
          return av - bv;
        }
        return String(av ?? "").localeCompare(String(bv ?? ""));
      });
    }

    if (this.#singleMode) {
      const value = data[0] ?? null;
      return { data: value, error: null };
    }

    if (this.#limitCount !== null) {
      data = data.slice(0, this.#limitCount);
    }

    return { data, error: null };
  }
}

function createSupabaseStub(config: SupabaseStubConfig = {}) {
  const insertedExecutions: any[] = [];
  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  const functionInvocations: Array<{ name: string; options: unknown }> = [];
  const notifications: any[] = [];
  let executionCounter = 1;

  return {
    rpc(name: string, args: unknown) {
      rpcCalls.push({ name, args });
      return Promise.resolve({ error: null });
    },
    functions: {
      invoke(name: string, options: unknown) {
        functionInvocations.push({ name, options });
        const override = config.functionResponses?.[name];
        if (override) {
          return Promise.resolve(override);
        }
        return Promise.resolve({ data: { id: "email-1" }, error: null });
      }
    },
    from(table: string) {
      if (table === "workflows") {
        return new SelectBuilder(config.workflows ?? []);
      }

      if (table === "workflow_executions") {
        const existing = config.workflowExecutions ?? [];
        return {
          select(_columns?: string) {
            return new SelectBuilder(existing);
          },
          insert(value: any) {
            const payload = Array.isArray(value) ? value[0] : value;
            const record = { id: `exec-${executionCounter++}`, ...payload };
            insertedExecutions.push(record);
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ data: record, error: null });
                  }
                };
              }
            };
          },
          update(_value: any) {
            return {
              eq(_field: string, _value: unknown) {
                return Promise.resolve({ data: null, error: null });
              }
            };
          }
        };
      }

      if (table === "organization_settings") {
        const rows = config.organizationSettings ? [config.organizationSettings] : [{
          photography_business_name: "Lumiso",
          date_format: "DD/MM/YYYY",
          time_format: "12-hour"
        }];
        return new SelectBuilder(rows);
      }

      if (table === "notifications") {
        return {
          insert(value: any) {
            const payload = Array.isArray(value) ? value[0] : value;
            notifications.push(payload);
            return Promise.resolve({ error: null });
          }
        };
      }

      return new SelectBuilder([]);
    },
    auth: {
      admin: {
        getUserById(userId: string) {
          return Promise.resolve({
            data: { user: { id: userId, email: "client@example.com" } },
            error: null
          });
        }
      }
    },
    _state: {
      insertedExecutions,
      rpcCalls,
      functionInvocations,
      notifications
    }
  };
}

Deno.test("triggerWorkflows filters to workflow_id and schedules reminders", async () => {
  const supabase = createSupabaseStub({
    workflows: [
      {
        id: "wf-1",
        trigger_type: "session_scheduled",
        trigger_entity_type: "session",
        organization_id: "org-1",
        is_active: true
      },
      {
        id: "wf-2",
        trigger_type: "session_scheduled",
        trigger_entity_type: "session",
        organization_id: "org-1",
        is_active: true
      }
    ],
    organizationSettings: {
      photography_business_name: "Studio",
      date_format: "YYYY-MM-DD",
      time_format: "24-hour"
    }
  });

  const triggerData = {
    trigger_type: "session_scheduled",
    trigger_entity_type: "session",
    trigger_entity_id: "session-1",
    trigger_data: {
      workflow_id: "wf-1",
      session_data: {
        session_date: "2024-05-01",
        session_time: "14:30",
        location: "Studio",
        notes: "Bring props"
      },
      lead_data: {
        name: "Jordan",
        email: "client@example.com",
        phone: "555-0000"
      }
    },
    organization_id: "org-1"
  };

  const executed: string[] = [];
  const result = await triggerWorkflows(
    supabase,
    triggerData,
    async (_client, executionId) => {
      executed.push(executionId);
    }
  );

  assertEquals(result.triggered_workflows, 1);
  assertEquals(executed.length, 1);
  assertEquals(supabase._state.insertedExecutions.length, 1);
  assertEquals(supabase._state.insertedExecutions[0].workflow_id, "wf-1");
  assertEquals(supabase._state.rpcCalls, [
    { name: "schedule_session_reminders", args: { session_id_param: "session-1" } }
  ]);
  assertEquals(supabase._state.functionInvocations.length, 1);
});

Deno.test("triggerWorkflows skips recent duplicates", async () => {
  const supabase = createSupabaseStub({
    workflows: [
      {
        id: "wf-1",
        trigger_type: "session_scheduled",
        trigger_entity_type: "session",
        organization_id: "org-1",
        is_active: true
      }
    ],
    workflowExecutions: [
      {
        id: "exec-existing",
        workflow_id: "wf-1",
        trigger_entity_type: "session",
        trigger_entity_id: "session-1",
        status: "completed",
        created_at: new Date().toISOString(),
        execution_log: [
          {
            trigger_data: {
              reminder_type: "auto",
              status_change: null,
              date_change: null
            }
          }
        ]
      }
    ]
  });

  const triggerData = {
    trigger_type: "session_scheduled",
    trigger_entity_type: "session",
    trigger_entity_id: "session-1",
    trigger_data: {
      reminder_type: "auto",
      status_change: null,
      date_change: null,
      session_data: {
        session_date: "2024-05-01",
        session_time: "14:30",
        location: "Studio",
        notes: ""
      },
      lead_data: {
        name: "Jordan",
        email: "client@example.com",
        phone: "555-0000"
      }
    },
    organization_id: "org-1"
  };

  const result = await triggerWorkflows(
    supabase,
    triggerData,
    async () => {
      throw new Error("should not execute steps for duplicates");
    }
  );

  assertEquals(result.triggered_workflows, 0);
  assertEquals(supabase._state.insertedExecutions.length, 0);
});

Deno.test("createWorkflowExecutor dispatches actions", async () => {
  const triggerCalls: unknown[] = [];
  const executeCalls: unknown[] = [];

  const deps: WorkflowExecutorDeps = {
    createClient: () => ({} as any),
    triggerWorkflowsImpl: async (_client, payload) => {
      triggerCalls.push(payload);
      return { triggered_workflows: 1 };
    },
    executeWorkflowStepsImpl: async (_client, executionId) => {
      executeCalls.push(executionId);
      return { executed_steps: 2 };
    }
  };

  const handler = createWorkflowExecutor(deps);

  const triggerResponse = await handler(new Request("https://example.com", {
    method: "POST",
    body: JSON.stringify({
      action: "trigger",
      trigger_type: "session_scheduled",
      trigger_entity_type: "session",
      trigger_entity_id: "session-1",
      trigger_data: {},
      organization_id: "org-1"
    })
  }));

  assertEquals(triggerResponse.status, 200);
  const triggerPayload = await triggerResponse.json();
  assertEquals(triggerPayload.success, true);
  assertEquals(triggerCalls.length, 1);

  const executeResponse = await handler(new Request("https://example.com", {
    method: "POST",
    body: JSON.stringify({
      action: "execute",
      trigger_type: "session_scheduled",
      trigger_entity_type: "session",
      trigger_entity_id: "session-1",
      organization_id: "org-1",
      workflow_execution_id: "exec-123"
    })
  }));

  assertEquals(executeResponse.status, 200);
  const executePayload = await executeResponse.json();
  assertEquals(executePayload.success, true);
  assertEquals(executeCalls, ["exec-123"]);
});

Deno.test("evaluateTriggerConditions handles reminder conditions", () => {
  assert(evaluateTriggerConditions({ reminder_type: "auto" }, { reminder_type: "auto" }));
  assert(!evaluateTriggerConditions({ reminder_type: "auto" }, { reminder_type: "manual" }));
  assert(evaluateTriggerConditions({}, { some: "data" }));
});
