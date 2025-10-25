jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

import { renderHook, act } from "@testing-library/react";

import { useNotificationTriggers } from "../useNotificationTriggers";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const toastMock = jest.fn();
const supabaseGetUserMock = supabase.auth.getUser as jest.Mock;
const supabaseFromMock = supabase.from as jest.Mock;
const supabaseInvokeMock = supabase.functions.invoke as jest.Mock;

describe("useNotificationTriggers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useToast as jest.Mock).mockReturnValue({ toast: toastMock });
  });

  describe("triggerProjectMilestone", () => {
    const milestoneArgs = [
      "project-1",
      "status-old",
      "status-new",
      "org-1",
      ["assignee-1", "assignee-2"],
    ] as const;

    it("creates milestone notifications and invokes processor", async () => {
      supabaseGetUserMock.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });

      const statusChain = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: { name: "Status", lifecycle: "milestone" } })),
          })),
        })),
      };

      supabaseFromMock.mockImplementation((table: string) => {
        if (table === "project_statuses") {
          return statusChain;
        }
        if (table === "notifications") {
          return {
            insert: jest.fn(() => Promise.resolve({ error: null })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      });

      supabaseInvokeMock.mockResolvedValue({ data: null, error: null });

      const { result } = renderHook(() => useNotificationTriggers());

      await act(async () => {
        await result.current.triggerProjectMilestone(...milestoneArgs);
      });

      expect(supabaseFromMock).toHaveBeenCalledWith("notifications");
      expect(supabaseInvokeMock).toHaveBeenCalledWith("notification-processor", {
        body: { action: "process-pending", organizationId: "org-1" },
      });
      expect(toastMock).not.toHaveBeenCalled();
    });

    it("shows destructive toast when insertion fails", async () => {
      supabaseGetUserMock.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });

      const statusChain = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: { name: "Status", lifecycle: "milestone" } })),
          })),
        })),
      };

      supabaseFromMock.mockImplementation((table: string) => {
        if (table === "project_statuses") {
          return statusChain;
        }
        if (table === "notifications") {
          return {
            insert: jest.fn(() =>
              Promise.resolve({ error: new Error("insert failed") })
            ),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      });

      supabaseInvokeMock.mockResolvedValue({ data: null, error: null });

      const { result } = renderHook(() => useNotificationTriggers());

      await act(async () => {
        await result.current.triggerProjectMilestone(...milestoneArgs);
      });

      expect(toastMock).toHaveBeenCalledWith({
        title: "Notification Error",
        description: "Failed to send milestone notification",
        variant: "destructive",
      });
    });
  });

  describe("scheduleDailySummaries", () => {
    it("invokes processor successfully", async () => {
      supabaseInvokeMock.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useNotificationTriggers());

      await act(async () => {
        await result.current.scheduleDailySummaries("org-1");
      });

      expect(supabaseInvokeMock).toHaveBeenCalledWith("notification-processor", {
        body: { action: "schedule-notification", organizationId: "org-1" },
      });
      expect(toastMock).not.toHaveBeenCalled();
    });

    it("shows destructive toast on error", async () => {
      supabaseInvokeMock.mockResolvedValue({ error: new Error("invoke failed") });

      const { result } = renderHook(() => useNotificationTriggers());

      await act(async () => {
        await result.current.scheduleDailySummaries("org-1");
      });

      expect(toastMock).toHaveBeenCalledWith({
        title: "Scheduling Error",
        description: "Failed to schedule daily summaries",
        variant: "destructive",
      });
    });
  });

  describe("processPendingNotifications", () => {
    it("processes notifications and shows success toast", async () => {
      supabaseInvokeMock.mockResolvedValue({
        data: { result: { processed: 3 } },
        error: null,
      });

      const { result } = renderHook(() => useNotificationTriggers());

      await act(async () => {
        await result.current.processPendingNotifications("org-1");
      });

      expect(toastMock).toHaveBeenCalledWith({
        title: "Success",
        description: "Processed 3 notifications",
      });
    });

    it("shows destructive toast on error", async () => {
      supabaseInvokeMock.mockResolvedValue({ data: null, error: new Error("process failed") });

      const { result } = renderHook(() => useNotificationTriggers());

      await act(async () => {
        await result.current.processPendingNotifications("org-1");
      });

      expect(toastMock).toHaveBeenCalledWith({
        title: "Processing Error",
        description: "Failed to process notifications",
        variant: "destructive",
      });
    });
  });

  describe("retryFailedNotifications", () => {
    it("retries notifications and shows success toast", async () => {
      supabaseInvokeMock.mockResolvedValue({
        data: { result: { retried_count: 5 } },
        error: null,
      });

      const { result } = renderHook(() => useNotificationTriggers());

      await act(async () => {
        await result.current.retryFailedNotifications("org-1");
      });

      expect(toastMock).toHaveBeenCalledWith({
        title: "Success",
        description: "Retried 5 failed notifications",
      });
    });

    it("shows destructive toast on error", async () => {
      supabaseInvokeMock.mockResolvedValue({
        data: null,
        error: new Error("retry failed"),
      });

      const { result } = renderHook(() => useNotificationTriggers());

      await act(async () => {
        await result.current.retryFailedNotifications("org-1");
      });

      expect(toastMock).toHaveBeenCalledWith({
        title: "Retry Error",
        description: "Failed to retry notifications",
        variant: "destructive",
      });
    });
  });
});
