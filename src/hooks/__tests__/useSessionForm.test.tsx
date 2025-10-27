import { renderHook, act, waitFor } from "@testing-library/react";
import { useSessionForm } from "../useSessionForm";

const toastMock = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

const triggerSessionScheduledMock = jest.fn();
jest.mock("@/hooks/useWorkflowTriggers", () => ({
  useWorkflowTriggers: () => ({
    triggerSessionScheduled: triggerSessionScheduledMock,
  }),
}));

const scheduleSessionRemindersMock = jest.fn();
jest.mock("@/hooks/useSessionReminderScheduling", () => ({
  useSessionReminderScheduling: () => ({
    scheduleSessionReminders: scheduleSessionRemindersMock,
  }),
}));

let getUserOrganizationIdMock: jest.Mock;
jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: (...args: unknown[]) => getUserOrganizationIdMock(...args),
}));

type SupabaseMock = {
  auth: {
    getUser: jest.Mock;
  };
  from: jest.Mock;
  storage: {
    from: jest.Mock;
  };
};

jest.mock("@/integrations/supabase/client", () => {
  const storageBucket = {
    remove: jest.fn(),
    upload: jest.fn(),
    getPublicUrl: jest.fn(() => ({ data: { publicUrl: "https://example.com/logo.png" } })),
  };

  return {
    supabase: {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
      storage: {
        from: jest.fn(() => storageBucket),
      },
    },
  };
});

const { supabase: supabaseMock } = jest.requireMock("@/integrations/supabase/client") as {
  supabase: SupabaseMock;
};

let storageBucketMock: {
  remove: jest.Mock;
  upload: jest.Mock;
  getPublicUrl: jest.Mock;
};

let consoleErrorSpy: jest.SpyInstance;

let leadsSelectMethod: jest.Mock;
let leadsSelectSingleMock: jest.Mock;
let leadsUpdateMethod: jest.Mock;
let leadsUpdateEqMock: jest.Mock;
let sessionsInsertMethod: jest.Mock;
let sessionsSelectMethod: jest.Mock;
let sessionsSingleMock: jest.Mock;
let activitiesInsertMock: jest.Mock;

beforeEach(() => {
  toastMock.mockClear();
  triggerSessionScheduledMock.mockReset();
  scheduleSessionRemindersMock.mockReset();
  triggerSessionScheduledMock.mockResolvedValue({ ok: true });
  scheduleSessionRemindersMock.mockResolvedValue(undefined);
  getUserOrganizationIdMock = jest.fn().mockResolvedValue("org-1");
  supabaseMock.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
  supabaseMock.from.mockReset();
  supabaseMock.storage.from.mockClear();
  storageBucketMock = supabaseMock.storage.from();
  storageBucketMock.remove.mockReset();
  storageBucketMock.upload.mockReset();
  storageBucketMock.getPublicUrl.mockReset();

  leadsSelectSingleMock = jest.fn().mockResolvedValue({
    data: { status: "contacted" },
    error: null,
  });
  const leadsSelectEqMock = jest.fn(() => ({
    single: leadsSelectSingleMock,
  }));
  leadsSelectMethod = jest.fn(() => ({
    eq: leadsSelectEqMock,
  }));

  leadsUpdateEqMock = jest.fn(() =>
    Promise.resolve({
      error: null,
    })
  );
  leadsUpdateMethod = jest.fn(() => ({
    eq: leadsUpdateEqMock,
  }));

  sessionsSingleMock = jest.fn().mockResolvedValue({
    data: { id: "session-123" },
    error: null,
  });
  sessionsSelectMethod = jest.fn(() => ({
    single: sessionsSingleMock,
  }));
  sessionsInsertMethod = jest.fn(() => ({
    select: sessionsSelectMethod,
  }));

  activitiesInsertMock = jest.fn(() => Promise.resolve({ error: null }));

  supabaseMock.from.mockImplementation((table: string) => {
    switch (table) {
      case "leads":
        return {
          select: leadsSelectMethod,
          update: leadsUpdateMethod,
        };
      case "sessions":
        return {
          insert: sessionsInsertMethod,
        };
      case "activities":
        return {
          insert: activitiesInsertMock,
        };
      default:
        return {};
    }
  });

  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.clearAllMocks();
  consoleErrorSpy.mockRestore();
});

const fillValidForm = (
  hookResult: ReturnType<typeof renderHook<typeof useSessionForm>>["result"]
) => {
  act(() => {
    hookResult.current.handleInputChange("session_name", " Engagement Session ");
    hookResult.current.handleInputChange("session_date", "2024-05-20");
    hookResult.current.handleInputChange("session_time", "15:30");
    hookResult.current.handleInputChange("notes", " Bring props ");
    hookResult.current.handleInputChange("location", " Studio ");
  });
};

describe("useSessionForm", () => {
  it("prevents submission when required fields are missing", async () => {
    const { result } = renderHook(() =>
      useSessionForm({ leadId: "lead-1", leadName: "Alice" })
    );

    let response: boolean | undefined;
    await act(async () => {
      response = await result.current.submitForm();
    });

    expect(response).toBe(false);
    expect(toastMock).toHaveBeenCalledWith({
      title: "Validation error",
      description: "Session name, date and time are required.",
      variant: "destructive",
    });
    expect(supabaseMock.auth.getUser).not.toHaveBeenCalled();
  });

  it("creates session, updates lead, schedules reminders, and resets form", async () => {
    const onSuccessMock = jest.fn();
    const { result } = renderHook(() =>
      useSessionForm({ leadId: "lead-1", leadName: "Alice", onSuccess: onSuccessMock })
    );

    fillValidForm(result);

    await waitFor(() => supabaseMock.from.mock.calls.length > 0);

    await act(async () => {
      const success = await result.current.submitForm();
      expect(success).toBe(true);
    });

    expect(supabaseMock.auth.getUser).toHaveBeenCalled();
    expect(getUserOrganizationIdMock).toHaveBeenCalled();
    expect(leadsSelectMethod).toHaveBeenCalled();
    expect(leadsUpdateMethod).toHaveBeenCalled();
    expect(leadsUpdateEqMock).toHaveBeenCalledWith("id", "lead-1");

    expect(sessionsInsertMethod).toHaveBeenCalledWith({
      user_id: "user-1",
      organization_id: "org-1",
      lead_id: "lead-1",
      session_name: "Engagement Session",
      session_date: "2024-05-20",
      session_time: "15:30",
      notes: "Bring props",
      location: "Studio",
      project_id: null,
      status: "planned",
    });

    expect(triggerSessionScheduledMock).toHaveBeenCalledWith(
      "session-123",
      "org-1",
      expect.objectContaining({
        session_date: "2024-05-20",
        session_time: "15:30",
        location: " Studio ",
        client_name: "Alice",
        lead_id: "lead-1",
        project_id: undefined,
        status: "planned",
      })
    );
    expect(scheduleSessionRemindersMock).toHaveBeenCalledWith("session-123");
    expect(activitiesInsertMock).toHaveBeenCalledWith({
      user_id: "user-1",
      organization_id: "org-1",
      lead_id: "lead-1",
      type: "note",
      content: expect.stringContaining("Photo session scheduled for"),
    });
    expect(toastMock).toHaveBeenCalledWith({
      title: "Success",
      description: "Session scheduled successfully.",
    });
    expect(onSuccessMock).toHaveBeenCalled();
    expect(result.current.formData.session_name).toBe("");
    expect(result.current.formData.session_date).toBe("");
    expect(result.current.formData.session_time).toBe("");
    expect(result.current.isDirty).toBe(false);
  });

  it("continues when workflow trigger fails but warns the user", async () => {
    triggerSessionScheduledMock.mockRejectedValueOnce(new Error("workflow failed"));
    const { result } = renderHook(() =>
      useSessionForm({ leadId: "lead-1", leadName: "Alice" })
    );

    fillValidForm(result);
    await waitFor(() => supabaseMock.from.mock.calls.length > 0);

    await act(async () => {
      const success = await result.current.submitForm();
      expect(success).toBe(true);
    });

    const warningToast = toastMock.mock.calls.find(
      ([payload]) => (payload as { title: string }).title === "Warning"
    );
    expect(warningToast?.[0]).toEqual({
      title: "Warning",
      description: "Session created successfully, but notifications may not be sent.",
      variant: "default",
    });
    expect(triggerSessionScheduledMock).toHaveBeenCalled();
    expect(scheduleSessionRemindersMock).toHaveBeenCalled();
  });

  it("shows error toast when user is not authenticated", async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { result } = renderHook(() =>
      useSessionForm({ leadId: "lead-1", leadName: "Alice" })
    );

    fillValidForm(result);
    await waitFor(() => supabaseMock.from.mock.calls.length > 0);

    let response: boolean | undefined;
    await act(async () => {
      response = await result.current.submitForm();
    });

    expect(response).toBe(false);
    const errorToast = toastMock.mock.calls.find(
      ([payload]) => (payload as { title: string }).title === "Error scheduling session"
    );
    expect(errorToast?.[0]).toEqual({
      title: "Error scheduling session",
      description: "User not authenticated",
      variant: "destructive",
    });
  });
});
