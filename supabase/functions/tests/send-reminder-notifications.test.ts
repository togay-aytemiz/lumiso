import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import {
  getResendClient,
  handleAssignmentNotification,
  handleProjectMilestoneNotification,
  setResendClient,
  type ResendClient,
} from "../send-reminder-notifications/index.ts";

type SelectResult = { data: unknown; error?: Error | null };

type StubOptions = {
  select?: Record<string, SelectResult | SelectResult[]>;
  authUsers?: Record<string, { data: { user: Record<string, unknown> | null }; error?: Error | null }>;
};

type UpdateCall = {
  table: string;
  values: Record<string, unknown>;
  filters: Array<{ field: string; value: unknown }>;
  order?: { field: string; options?: Record<string, unknown> };
};

type SelectCall = {
  table: string;
  columns?: string;
  filters: Array<{ op: string; field: string; value: unknown }>;
};

function createSupabaseStub(options: StubOptions = {}) {
  const selectQueues = new Map<string, SelectResult[]>();
  for (const [table, result] of Object.entries(options.select ?? {})) {
    selectQueues.set(table, Array.isArray(result) ? [...result] : [result]);
  }

  const selectCalls: SelectCall[] = [];
  const updateCalls: UpdateCall[] = [];

  class SelectQuery {
    private filters: Array<{ op: string; field: string; value: unknown }> = [];

    constructor(private readonly table: string, private readonly columns?: string) {}

    eq(field: string, value: unknown) {
      this.filters.push({ op: "eq", field, value });
      return this;
    }

    maybeSingle() {
      selectCalls.push({ table: this.table, columns: this.columns, filters: [...this.filters] });
      const queue = selectQueues.get(this.table) ?? [];
      const result = queue.length > 0 ? queue.shift()! : { data: null, error: null };
      return Promise.resolve({ data: result.data, error: result.error ?? null });
    }

    single() {
      return this.maybeSingle();
    }
  }

  class UpdateQuery {
    private filters: Array<{ field: string; value: unknown }> = [];
    private orderClause?: { field: string; options?: Record<string, unknown> };

    constructor(private readonly table: string, private readonly values: Record<string, unknown>) {}

    eq(field: string, value: unknown) {
      this.filters.push({ field, value });
      return this;
    }

    order(field: string, options?: Record<string, unknown>) {
      this.orderClause = { field, options };
      return this;
    }

    limit() {
      updateCalls.push({ table: this.table, values: this.values, filters: [...this.filters], order: this.orderClause });
      return Promise.resolve({ data: null, error: null });
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: { data: null; error: null }) => TResult1 | PromiseLike<TResult1>) | undefined,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined,
    ) {
      return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected);
    }
  }

  return {
    selectCalls,
    updateCalls,
    from(table: string) {
      return {
        select: (columns?: string) => new SelectQuery(table, columns),
        update: (values: Record<string, unknown>) => new UpdateQuery(table, values),
      };
    },
    auth: {
      admin: {
        getUserById: async (id: string) => options.authUsers?.[id] ?? { data: { user: null }, error: null },
      },
    },
  };
}

function withMockedResend(testFn: () => Promise<void>) {
  return async () => {
    const original = getResendClient();
    const mock: ResendClient = {
      emails: {
        send: async (..._args) => ({ data: { id: "test-email" }, error: null }),
      },
    };

    setResendClient(mock);

    try {
      await testFn();
    } finally {
      setResendClient(original);
    }
  };
}

Deno.test("skips assignment notification when notifications are disabled", withMockedResend(async () => {
  const supabase = createSupabaseStub({
    select: {
      leads: { data: { name: "Test Lead", notes: "Notes", status: "new" } },
      organization_settings: { data: { notification_new_assignment_enabled: false, notification_global_enabled: true } },
      user_settings: [
        { data: { notification_new_assignment_enabled: false, notification_global_enabled: true } },
      ],
    },
  });

  const response = await handleAssignmentNotification(
    {
      type: "new-assignment",
      entity_type: "lead",
      entity_id: "lead-1",
      assignee_id: "user-1",
      assignee_email: "assigned@example.com",
      assignee_name: "Assignee",
      assigner_name: "Assigner",
      organizationId: "org-1",
    },
    supabase as unknown as ReturnType<typeof createSupabaseStub>,
  );

  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.skipped, 1);
  assertEquals(body.successful, 0);
  assertEquals(supabase.updateCalls.length, 1);
  assertEquals(supabase.updateCalls[0].values.status, "skipped");
}));

Deno.test("sends assignment notification when enabled", withMockedResend(async () => {
  const supabase = createSupabaseStub({
    select: {
      leads: { data: { name: "Client", notes: "Important", status: "active" } },
      organization_settings: { data: { photography_business_name: "Studio", primary_brand_color: "#123456" } },
      user_settings: [
        { data: { notification_new_assignment_enabled: true, notification_global_enabled: true } },
        { data: { notification_new_assignment_enabled: true, notification_global_enabled: true } },
      ],
      profiles: { data: { full_name: "Assignee Profile" } },
      user_language_preferences: { data: { language_code: "en" } },
    },
    authUsers: {
      "user-1": { data: { user: { email: "assigned@example.com", user_metadata: { full_name: "Metadata Name" } } } },
    },
  });

  const response = await handleAssignmentNotification(
    {
      type: "new-assignment",
      entity_type: "project",
      entity_id: "project-1",
      assignee_id: "user-1",
      assignee_email: "assigned@example.com",
      assignee_name: "Assignee",
      assigner_name: "Assigner",
      organizationId: "org-1",
    },
    supabase as unknown as ReturnType<typeof createSupabaseStub>,
  );

  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.successful, 1);
  assertEquals(body.failed, 0);
  assertEquals(supabase.updateCalls.length > 0, true);
  const lastUpdate = supabase.updateCalls[supabase.updateCalls.length - 1];
  assertEquals(lastUpdate.values.status, "sent");
}));

Deno.test("skips milestone notification when lifecycle is not milestone", withMockedResend(async () => {
  const supabase = createSupabaseStub({
    select: {
      projects: { data: { id: "project-1", name: "Spring Wedding", status_id: "status-1" } },
      project_statuses: { data: { name: "Editing", lifecycle: "active" } },
      organization_settings: { data: { notification_project_milestone_enabled: true, notification_global_enabled: true } },
    },
  });

  const response = await handleProjectMilestoneNotification(
    {
      type: "project-milestone",
      project_id: "project-1",
      organizationId: "org-1",
      old_status: "Editing",
      new_status: "Editing",
    },
    supabase as unknown as ReturnType<typeof createSupabaseStub>,
  );

  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.skipped, 1);
  assertEquals(body.successful, 0);
}));

Deno.test("returns skip response for milestone notifications in single photographer mode", withMockedResend(async () => {
  const supabase = createSupabaseStub({
    select: {
      projects: { data: { id: "project-1", name: "Spring Wedding", description: "Notes", project_types: { name: "Wedding" }, status_id: "status-2", lead_id: "lead-1" } },
      leads: { data: { name: "Elif" } },
      project_statuses: { data: { name: "Completed", lifecycle: "completed" } },
    },
  });

  const response = await handleProjectMilestoneNotification(
    {
      type: "project-milestone",
      project_id: "project-1",
      organizationId: "org-1",
      old_status: "Editing",
      new_status: "Completed",
    },
    supabase as unknown as ReturnType<typeof createSupabaseStub>,
  );

  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.successful, 0);
  assertEquals(body.failed, 0);
  assertEquals(body.total, 0);
  assertEquals(body.skipped, 1);
  assertEquals(body.message, "Milestone notifications disabled in single photographer mode");
}));
