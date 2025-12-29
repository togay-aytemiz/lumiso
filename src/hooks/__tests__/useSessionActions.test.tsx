import { renderHook, act } from "@testing-library/react";
import { useSessionActions } from "../useSessionActions";
import { useI18nToast } from "@/lib/toastHelpers";

jest.mock("@/lib/toastHelpers", () => ({
  useI18nToast: jest.fn(),
}));

jest.mock("@/hooks/useOnboardingDeletionGuard", () => ({
  useOnboardingDeletionGuard: () => ({
    isDeletionBlocked: false,
    ensureCanDelete: () => true,
    showDeletionBlockedToast: jest.fn(),
  }),
}));

const cancelSessionRemindersMock = jest.fn();
jest.mock("@/hooks/useSessionReminderScheduling", () => ({
  useSessionReminderScheduling: () => ({
    cancelSessionReminders: cancelSessionRemindersMock,
  }),
}));

const triggerSessionCompletedMock = jest.fn();
const triggerSessionCancelledMock = jest.fn();
jest.mock("@/hooks/useWorkflowTriggers", () => ({
  useWorkflowTriggers: () => ({
    triggerSessionCompleted: triggerSessionCompletedMock,
    triggerSessionCancelled: triggerSessionCancelledMock,
  }),
}));

const supabaseFromMock = jest.fn();
jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => supabaseFromMock(...args),
  },
}));

const toastApi = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  supabaseFromMock.mockReset();
  (useI18nToast as jest.Mock).mockReturnValue(toastApi);
});

describe("useSessionActions.deleteSession", () => {
  it("shows error toast when session delete fails", async () => {
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "scheduled_session_reminders") {
        return {
          delete: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) })),
        };
      }
      if (table === "sessions") {
        return {
          delete: () => ({
            eq: () => ({
              select: () =>
                Promise.resolve({
                  data: [],
                  error: null,
                }),
            }),
          }),
        };
      }
      return {};
    });

    const { result } = renderHook(() => useSessionActions());

    await act(async () => {
      await result.current.deleteSession("session-1");
    });

    expect(toastApi.error).toHaveBeenCalledWith("Error deleting session");
  });
});

describe("useSessionActions.updateSessionStatus", () => {
  const baseSession = {
    id: "session-1",
    status: "planned",
    session_date: "2024-05-01",
    session_time: "10:00",
    location: "Studio",
    lead_id: "lead-1",
    project_id: "project-1",
    organization_id: "org-1",
    leads: { name: "Alice" },
  };

  beforeEach(() => {
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "sessions") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: baseSession, error: null })),
            })),
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ error: null })),
          })),
        };
      }
      return {};
    });
  });

  it("updates status to completed and triggers workflow", async () => {
    const { result } = renderHook(() => useSessionActions());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.updateSessionStatus("session-1", "completed");
    });

    expect(success).toBe(true);
    expect(triggerSessionCompletedMock).toHaveBeenCalledWith(
      "session-1",
      "org-1",
      expect.objectContaining({ old_status: "planned", new_status: "completed" })
    );
    expect(toastApi.success).toHaveBeenCalledWith("Successfully updated");
  });

  it("shows warning toast if workflow trigger fails", async () => {
    triggerSessionCompletedMock.mockRejectedValueOnce(new Error("workflow"));

    const { result } = renderHook(() => useSessionActions());

    await act(async () => {
      await result.current.updateSessionStatus("session-1", "completed");
    });

    expect(toastApi.warning).toHaveBeenCalledWith(
      "Status updated successfully, but notifications may not be sent."
    );
  });

  it("returns false when fetch fails", async () => {
    supabaseFromMock.mockImplementationOnce(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: new Error("not found") })),
        })),
      })),
    }));

    const { result } = renderHook(() => useSessionActions());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.updateSessionStatus("session-1", "cancelled");
    });

    expect(success).toBe(false);
    expect(toastApi.error).toHaveBeenCalledWith("Unable to update session status.");
  });
});
