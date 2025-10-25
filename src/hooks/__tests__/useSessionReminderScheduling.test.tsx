import { renderHook, act } from "@testing-library/react";
import { useSessionReminderScheduling } from "../useSessionReminderScheduling";

const toastMock = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: (...args: unknown[]) => toastMock(...args),
  }),
}));

const supabaseFromMock = jest.fn();
const supabaseRpcMock = jest.fn();

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => supabaseRpcMock(...args),
    from: (...args: unknown[]) => supabaseFromMock(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  toastMock.mockReset();
  supabaseRpcMock.mockReset();
  supabaseFromMock.mockReset();
});

describe("useSessionReminderScheduling", () => {
  it("schedules reminders via RPC and verifies records", async () => {
    supabaseRpcMock.mockResolvedValue({ error: null });
    supabaseFromMock.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const { result } = renderHook(() => useSessionReminderScheduling());

    await act(async () => {
      await result.current.scheduleSessionReminders("session-1");
    });

    expect(supabaseRpcMock).toHaveBeenCalledWith("schedule_session_reminders", {
      session_id_param: "session-1",
    });
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("shows warning toast when RPC fails", async () => {
    supabaseRpcMock.mockResolvedValue({ error: new Error("failed") });

    const { result } = renderHook(() => useSessionReminderScheduling());

    await act(async () => {
      await result.current.scheduleSessionReminders("session-2");
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: "Warning",
      description: "Session created but reminders could not be scheduled automatically",
      variant: "destructive",
    });
  });

  it("cancels reminders without toasting on failure", async () => {
    supabaseFromMock.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: new Error("cancel-error") }),
        }),
      }),
    });

    const { result } = renderHook(() => useSessionReminderScheduling());

    await act(async () => {
      await result.current.cancelSessionReminders("session-3");
    });

    expect(toastMock).not.toHaveBeenCalled();
  });

  it("reschedules by chaining cancel then schedule", async () => {
    const updateMock = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    const selectMock = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    supabaseFromMock.mockImplementation((table) => {
      if (table === "scheduled_session_reminders") {
        return {
          update: updateMock,
          select: selectMock,
        };
      }
      return {};
    });
    supabaseRpcMock.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useSessionReminderScheduling());

    await act(async () => {
      await result.current.rescheduleSessionReminders("session-4");
    });

    expect(updateMock).toHaveBeenCalled();
    expect(supabaseRpcMock).toHaveBeenCalledTimes(1);
    expect(toastMock).not.toHaveBeenCalled();
  });
});
