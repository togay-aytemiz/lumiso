import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import ActivitySection from "../ActivitySection";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useFormsTranslation, useCommonTranslation } from "@/hooks/useTypedTranslation";

jest.mock("@/hooks/use-toast", () => {
  const toastMock = jest.fn();
  const useToastMock = jest.fn(() => ({ toast: toastMock }));
  return {
    __esModule: true,
    useToast: useToastMock,
    toast: toastMock,
  };
});

const { toast: toastSpy, useToast: useToastMock } = jest.requireMock("@/hooks/use-toast") as {
  toast: jest.Mock;
  useToast: jest.Mock;
};

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
  useCommonTranslation: jest.fn(),
}));

jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: jest.fn(),
}));

jest.mock("@/components/ui/select", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  type SelectContextValue = { onValueChange: (value: string) => void };
  const SelectContext = React.createContext<SelectContextValue>({
    onValueChange: () => {},
  });

  interface SelectProps {
    onValueChange: (value: string) => void;
    children: ReactNode;
  }

  interface SelectItemProps {
    value: string;
    children: ReactNode;
  }

  type SelectChildProps = { children: ReactNode };

  return {
    __esModule: true,
    Select: ({ onValueChange, children }: SelectProps) => (
      <SelectContext.Provider value={{ onValueChange }}>{children}</SelectContext.Provider>
    ),
    SelectTrigger: ({ children }: SelectChildProps) => <button type="button">{children}</button>,
    SelectContent: ({ children }: SelectChildProps) => <div>{children}</div>,
    SelectValue: ({ children }: SelectChildProps) => <span>{children}</span>,
    SelectItem: ({ value, children }: SelectItemProps) => {
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
  const React = jest.requireActual<typeof import("react")>("react");
  type TabsContextValue = { value: string; onValueChange: (value: string) => void };
  const TabsContext = React.createContext<TabsContextValue>({
    value: "",
    onValueChange: () => {},
  });

  interface TabsProps {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }

  type TabsChildProps = { children: ReactNode };

  interface TabsTriggerProps {
    value: string;
    children: ReactNode;
  }

  interface TabsContentProps {
    value: string;
    children: ReactNode;
  }

  return {
    __esModule: true,
    Tabs: ({ value, onValueChange, children }: TabsProps) => (
      <TabsContext.Provider value={{ value, onValueChange }}>{children}</TabsContext.Provider>
    ),
    TabsList: ({ children }: TabsChildProps) => <div>{children}</div>,
    TabsTrigger: ({ value, children }: TabsTriggerProps) => {
      const ctx = React.useContext(TabsContext);
      const isActive = ctx.value === value;
      return (
        <button type="button" aria-pressed={isActive} onClick={() => ctx.onValueChange(value)}>
          {children}
        </button>
      );
    },
    TabsContent: ({ value, children }: TabsContentProps) => {
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

interface ActivityRow {
  id: string;
  type: string;
  content: string;
  reminder_date: string | null;
  reminder_time: string | null;
  organization_id: string;
  user_id: string;
  lead_id: string | null;
  project_id: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  id: string;
  session_name: string;
  session_date: string | null;
  session_time: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

describe("ActivitySection", () => {
  const mockUseFormsTranslation = useFormsTranslation as jest.MockedFunction<typeof useFormsTranslation>;
  const mockUseCommonTranslation = useCommonTranslation as jest.MockedFunction<typeof useCommonTranslation>;
  const mockGetUserOrganizationId = getUserOrganizationId as jest.MockedFunction<typeof getUserOrganizationId>;
  const supabaseFromMock = supabase.from as jest.MockedFunction<typeof supabase.from>;
  const supabaseAuthGetUserMock = supabase.auth.getUser as jest.MockedFunction<typeof supabase.auth.getUser>;

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
    const activities: ActivityRow[] = [
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

    const sessions: SessionRow[] = [
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

    const activitiesOrderMock = jest.fn(() => Promise.resolve({ data: activities, error: null as null }));
    const activitiesEqMock = jest.fn(() => ({ order: activitiesOrderMock }));
    const activitiesSelectMock = jest.fn(() => ({ eq: activitiesEqMock }));

    const sessionsOrderMock = jest.fn(() => Promise.resolve({ data: sessions, error: null as null }));
    const sessionsEqMock = jest.fn(() => ({ order: sessionsOrderMock }));
    const sessionsSelectMock = jest.fn(() => ({ eq: sessionsEqMock }));

    const auditLimitMock = jest.fn(() => Promise.resolve({ data: [], error: null as null }));
    const auditOrderMock = jest.fn(() => ({ limit: auditLimitMock }));
    const auditEqMock = jest.fn(() => ({ order: auditOrderMock }));
    const auditSelectMock = jest.fn(() => ({ eq: auditEqMock }));

    const profilesInMock = jest.fn(() => Promise.resolve({ data: [], error: null as null }));
    const profilesSelectMock = jest.fn(() => ({ in: profilesInMock }));

    const insertMock = jest.fn(() => Promise.resolve({ error: null as null }));
    const updateEqMock = jest.fn(() => Promise.resolve({ error: null as null }));
    const updateMock = jest.fn(() => ({ eq: updateEqMock }));
    const deleteEqMock = jest.fn(() => Promise.resolve({ error: null as null }));
    const deleteMock = jest.fn(() => ({ eq: deleteEqMock }));

    supabaseFromMock.mockImplementation((table: string) => {
      switch (table) {
        case "activities":
          return {
            select: activitiesSelectMock,
            insert: insertMock,
            update: updateMock,
            delete: deleteMock,
          };
        case "sessions":
          return {
            select: sessionsSelectMock,
          };
        case "audit_log":
          return {
            select: auditSelectMock,
          };
        case "profiles":
          return {
            select: profilesSelectMock,
          };
        default:
          throw new Error(`Unexpected table ${table}`);
      }
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
