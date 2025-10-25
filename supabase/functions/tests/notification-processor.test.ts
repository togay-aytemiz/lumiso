import { assert, assertEquals, assertRejects } from "std/testing/asserts.ts";
import {
  checkNotificationEnabled,
  updateNotificationStatus,
  retryFailedNotifications,
  processProjectMilestone,
  processWorkflowMessage,
  setResendClientForTests,
  resetResendClientForTests,
} from "../notification-processor/index.ts";

type MaybeSingleRow = { data: Record<string, unknown> | null; error: null };

type SelectBuilderOptions = {
  row?: Record<string, unknown> | null;
};

class MaybeSingleBuilder {
  #row: Record<string, unknown> | null;

  constructor({ row = null }: SelectBuilderOptions = {}) {
    this.#row = row ?? null;
  }

  select(_columns?: string) {
    return this;
  }

  eq(_field: string, _value: unknown) {
    return this;
  }

  maybeSingle(): Promise<MaybeSingleRow> {
    return Promise.resolve({ data: this.#row, error: null });
  }

  single(): Promise<MaybeSingleRow> {
    return Promise.resolve({ data: this.#row, error: null });
  }
}

Deno.test("checkNotificationEnabled returns false when user globally disables notifications", async () => {
  const supabase = {
    from(table: string) {
      if (table === "user_settings") {
        return new MaybeSingleBuilder({
          row: {
            notification_global_enabled: false,
          },
        });
      }
      if (table === "organization_settings") {
        return new MaybeSingleBuilder({ row: {} });
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const enabled = await checkNotificationEnabled(supabase, "user-1", "org-1", "daily-summary");
  assertEquals(enabled, false);
});

Deno.test("checkNotificationEnabled respects organization level overrides", async () => {
  const supabase = {
    from(table: string) {
      if (table === "user_settings") {
        return new MaybeSingleBuilder({
          row: {
            notification_global_enabled: true,
            notification_daily_summary_enabled: true,
          },
        });
      }
      if (table === "organization_settings") {
        return new MaybeSingleBuilder({
          row: {
            notification_global_enabled: true,
            notification_daily_summary_enabled: false,
          },
        });
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const enabled = await checkNotificationEnabled(supabase, "user-1", "org-2", "daily-summary");
  assertEquals(enabled, false);
});

Deno.test("checkNotificationEnabled defaults to true when no overrides present", async () => {
  const supabase = {
    from(_table: string) {
      return new MaybeSingleBuilder({ row: null });
    },
  };

  const enabled = await checkNotificationEnabled(supabase, "user-1", "org-3", "daily-summary");
  assertEquals(enabled, true);
});

Deno.test("updateNotificationStatus persists fields including sent timestamp", async () => {
  const updates: Array<{ values: Record<string, unknown>; filters: Array<{ field: string; value: unknown }> }> = [];

  const supabase = {
    from(table: string) {
      assertEquals(table, "notifications");
      return {
        update(values: Record<string, unknown>) {
          return {
            eq(field: string, value: unknown) {
              updates.push({ values, filters: [{ field, value }] });
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  };

  await updateNotificationStatus(supabase, "notif-1", "sent", null, 2, "email-123");
  assertEquals(updates.length, 1);
  const payload = updates[0];
  assertEquals(payload.filters, [{ field: "id", value: "notif-1" }]);
  assertEquals(payload.values.status, "sent");
  assert("sent_at" in payload.values);
  assertEquals(payload.values.retry_count, 2);
  assertEquals(payload.values.email_id, "email-123");
});

Deno.test("retryFailedNotifications returns summary data", async () => {
  const supabase = {
    rpc(name: string) {
      assertEquals(name, "retry_failed_notifications");
      return Promise.resolve({ data: 4, error: null });
    },
  };

  const result = await retryFailedNotifications(supabase);
  assertEquals(result, { retried_count: 4 });
});

Deno.test("retryFailedNotifications throws on rpc error", async () => {
  const supabase = {
    rpc() {
      return Promise.resolve({ data: null, error: { message: "boom" } });
    },
  };

  await assertRejects(
    () => retryFailedNotifications(supabase),
    Error,
    "Error retrying notifications: boom",
  );
});

Deno.test("processProjectMilestone forwards metadata to reminder function", async () => {
  const invokeCalls: Array<{ name: string; options: unknown }> = [];
  const supabase = {
    functions: {
      invoke(name: string, options: unknown) {
        invokeCalls.push({ name, options });
        return Promise.resolve({ data: { id: "email-999" }, error: null });
      },
    },
  };

  const result = await processProjectMilestone(
    supabase,
    {
      organization_id: "org-1",
      metadata: {
        project_id: "proj-55",
        old_status: "draft",
        new_status: "sent",
        changed_by_user_id: "user-77",
      },
    },
  );

  assertEquals(result, { id: "email-999" });
  assertEquals(invokeCalls.length, 1);
  assertEquals(invokeCalls[0].name, "send-reminder-notifications");
  const body = (invokeCalls[0].options as { body: Record<string, unknown> }).body;
  assertEquals(body.project_id, "proj-55");
  assertEquals(body.organizationId, "org-1");
  assertEquals(body.changed_by_user_id, "user-77");
});

Deno.test("processWorkflowMessage renders template variables before sending", async () => {
  const sendCalls: Array<Record<string, unknown>> = [];
  setResendClientForTests({
    emails: {
      send(payload: Record<string, unknown>) {
        sendCalls.push(payload);
        return Promise.resolve({ data: { id: "email-abc" }, error: null });
      },
    },
  });

  const supabase = {
    auth: {
      admin: {
        getUserById() {
          return Promise.resolve({ data: { user: { email: "client@example.com" } }, error: null });
        },
      },
    },
    from(table: string) {
      if (table === "message_templates") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          single() {
            return Promise.resolve({
              data: {
                id: "tmpl-1",
                name: "Welcome",
                template_channel_views: [
                  {
                    subject: "Hello {customer_name}",
                    html_content: "<p>Project: {project_name}</p>",
                  },
                ],
              },
              error: null,
            });
          },
        };
      }

      if (table === "organization_settings") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle() {
            return Promise.resolve({
              data: {
                photography_business_name: "Lumiso Studios",
                email: "hello@lumiso.app",
              },
              error: null,
            });
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  const metadata = {
    template_id: "tmpl-1",
    entity_data: {
      customer_name: "Jordan",
      customer_email: "jordan@example.com",
      project_name: "Wedding",
    },
  };

  const result = await processWorkflowMessage(
    supabase,
    {
      user_id: "user-99",
      organization_id: "org-33",
      metadata,
    },
  );

  assertEquals(result, { id: "email-abc" });
  assertEquals(sendCalls.length, 1);
  const payload = sendCalls[0];
  assertEquals(payload.subject, "Hello Jordan");
  assertEquals(payload.html, "<p>Project: Wedding</p>");

  resetResendClientForTests();
});
