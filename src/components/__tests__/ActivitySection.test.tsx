import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import ActivitySection from "../ActivitySection";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useFormsTranslation, useCommonTranslation } from "@/hooks/useTypedTranslation";

jest.mock("@/hooks/use-toast", () => {
  const toastSpy = jest.fn();
  const useToastMock = jest.fn(() => ({ toast: toastSpy }));
  return {
    __esModule: true,
    useToast: useToastMock,
    toast: jest.fn(),
    __toastSpy: toastSpy,
    __useToastMock: useToastMock,
  };
});

const { __toastSpy, __useToastMock } = jest.requireMock("@/hooks/use-toast");
const toastSpy = __toastSpy as jest.Mock;
const useToastMock = __useToastMock as jest.Mock;

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
  useCommonTranslation: jest.fn(),
}));

jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: jest.fn(),
}));

jest.mock("@/components/ui/select", () => {
  const React = require("react");
  const SelectContext = React.createContext<{ onValueChange: (value: string) => void }>({
    onValueChange: () => {},
  });

  return {
    __esModule: true,
    Select: ({ onValueChange, children }: any) => (
      <SelectContext.Provider value={{ onValueChange }}>{children}</SelectContext.Provider>
    ),
    SelectTrigger: ({ children }: any) => <button type="button">{children}</button>,
    SelectContent: ({ children }: any) => <div>{children}</div>,
    SelectValue: ({ children }: any) => <span>{children}</span>,
    SelectItem: ({ value, children }: any) => {
      const ctx = React.useContext(SelectContext);
      return (
        <button type="button" onClick={() => ctx.onValueChange(value)}>
          {children}
        </button>
      );
    },
  };
});

jest.mock("@/components/ui/tabs", () => {
  const React = require("react");
  const TabsContext = React.createContext<{ value: string; onValueChange: (value: string) => void }>({
    value: "",
    onValueChange: () => {},
  });

  return {
    __esModule: true,
    Tabs: ({ value, onValueChange, children }: any) => (
      <TabsContext.Provider value={{ value, onValueChange }}>{children}</TabsContext.Provider>
    ),
    TabsList: ({ children }: any) => <div>{children}</div>,
    TabsTrigger: ({ value, children }: any) => {
      const ctx = React.useContext(TabsContext);
      const isActive = ctx.value === value;
      return (
        <button type="button" aria-pressed={isActive} onClick={() => ctx.onValueChange(value)}>
          {children}
        </button>
      );
    },
    TabsContent: ({ value, children }: any) => {
      const ctx = React.useContext(TabsContext);
      return ctx.value === value ? <div>{children}</div> : null;
    },
  };
});

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  },
}));

describe("ActivitySection", () => {
  const mockUseFormsTranslation = useFormsTranslation as jest.Mock;
  const mockUseCommonTranslation = useCommonTranslation as jest.Mock;
  const mockGetUserOrganizationId = getUserOrganizationId as jest.Mock;
  const supabaseFromMock = supabase.from as jest.Mock;
  const supabaseAuthGetUserMock = supabase.auth.getUser as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    toastSpy.mockReset();

    mockUseFormsTranslation.mockReturnValue({
      t: (key: string) => key,
    });
    mockUseCommonTranslation.mockReturnValue({
      t: (key: string) => key,
    });
    mockGetUserOrganizationId.mockResolvedValue("org-123");
    supabaseAuthGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  const setupSupabase = () => {
    const activities = [
      {
        id: "activity-1",
        type: "note",
        content: "Initial follow-up",
        reminder_date: null,
        reminder_time: null,
        organization_id: "org-123",
        user_id: "user-1",
        lead_id: "lead-1",
        project_id: null,
        completed: false,
        created_at: "2025-02-01T10:00:00.000Z",
        updated_at: "2025-02-01T10:00:00.000Z",
      },
      {
        id: "activity-2",
        type: "call",
        content: "Completed call",
        reminder_date: null,
        reminder_time: null,
        organization_id: "org-123",
        user_id: "user-1",
        lead_id: "lead-1",
        project_id: null,
        completed: true,
        created_at: "2025-02-02T12:00:00.000Z",
        updated_at: "2025-02-02T12:00:00.000Z",
      },
    ];

    const sessions = [
      {
        id: "session-1",
        session_name: "Strategy Session",
        session_date: "2025-02-05",
        session_time: "10:00",
        location: "Studio",
        notes: "Discuss next steps",
        status: "scheduled",
        created_at: "2025-02-03T09:00:00.000Z",
        updated_at: "2025-02-03T09:00:00.000Z",
      },
    ];

    const activitiesSelectMock = jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: activities, error: null })),
      })),
    }));

    const sessionsSelectMock = jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: sessions, error: null })),
      })),
    }));

    const auditSelectMock = jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    }));

    const profilesSelectMock = jest.fn(() => ({
      in: jest.fn(() => Promise.resolve({ data: [], error: null })),
    }));

    const insertMock = jest.fn(() => Promise.resolve({ error: null }));
    const updateEqMock = jest.fn(() => Promise.resolve({ error: null }));
    const updateMock = jest.fn(() => ({ eq: updateEqMock }));
    const deleteEqMock = jest.fn(() => Promise.resolve({ error: null }));
    const deleteMock = jest.fn(() => ({ eq: deleteEqMock }));

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "activities") {
        return {
          select: activitiesSelectMock,
          insert: insertMock,
          update: updateMock,
          delete: deleteMock,
        };
      }
      if (table === "sessions") {
        return {
          select: sessionsSelectMock,
        };
      }
      if (table === "audit_log") {
        return {
          select: auditSelectMock,
        };
      }
      if (table === "profiles") {
        return {
          select: profilesSelectMock,
        };
      }
      return {};
    });

    return { activitiesSelectMock, insertMock };
  };

  it("renders fetched activities and filters completed items", async () => {
    const { activitiesSelectMock } = setupSupabase();

    render(<ActivitySection entityType="lead" entityId="lead-1" />);

    await waitFor(() => {
      expect(screen.getByText("Initial follow-up")).toBeInTheDocument();
      expect(screen.getByText("Completed call")).toBeInTheDocument();
    });

    expect(screen.getByText("Strategy Session")).toBeInTheDocument();

    fireEvent.click(screen.getByText("activities.filter_completed"));

    await waitFor(() => {
      expect(screen.queryByText("Initial follow-up")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Completed call")).toBeInTheDocument();

    expect(activitiesSelectMock).toHaveBeenCalledTimes(1);
  });

  it("creates a new activity and refreshes the list", async () => {
    const { activitiesSelectMock, insertMock } = setupSupabase();
    const onUpdate = jest.fn();

    render(<ActivitySection entityType="lead" entityId="lead-1" onUpdate={onUpdate} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("placeholders.enter_activity_content")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("placeholders.enter_activity_content"), {
      target: { value: "New activity" },
    });

    fireEvent.click(screen.getByText("activities.add_activity"));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
        type: "note",
        content: "New activity",
        lead_id: "lead-1",
        organization_id: "org-123",
        user_id: "user-1",
      }));
    });

    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "actions.success",
        description: "messages.success.save",
      })
    );

    expect(activitiesSelectMock).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText("placeholders.enter_activity_content")).toHaveValue("");
  });
});
