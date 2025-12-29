import type { ChangeEvent, ReactNode } from "react";
import { render, screen, waitFor } from "@/utils/testUtils";
import ProjectDetail from "../ProjectDetail";
import { mockSupabaseClient } from "@/utils/testUtils";
import { useToast } from "@/hooks/use-toast";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useProjectHeaderSummary } from "@/hooks/useProjectHeaderSummary";
import { useProjectSessionsSummary } from "@/hooks/useProjectSessionsSummary";
import { buildProjectSummaryItems } from "@/lib/projects/buildProjectSummaryItems";

jest.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient,
}));

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "project-1" }),
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
  };
});

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/hooks/useProjectHeaderSummary", () => ({
  useProjectHeaderSummary: jest.fn(),
}));

jest.mock("@/hooks/useProjectSessionsSummary", () => ({
  useProjectSessionsSummary: jest.fn(),
}));

jest.mock("@/contexts/useOnboarding", () => ({
  useOnboarding: () => ({
    completeMultipleSteps: jest.fn(),
    isInGuidedSetup: false,
    currentStep: 1,
  }),
}));

jest.mock("@/lib/projects/buildProjectSummaryItems", () => ({
  buildProjectSummaryItems: jest.fn(),
}));

jest.mock("@/components/EntityHeader", () => ({
  EntityHeader: ({
    title,
    subtitle,
    actions,
    banner,
  }: {
    title?: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
    banner?: ReactNode;
  }) => (
    <div data-testid="entity-header">
      <div>{title}</div>
      {subtitle ? <div>{subtitle}</div> : null}
      {actions}
      {banner}
    </div>
  ),
}));

jest.mock("@/components/ProjectStatusBadge", () => ({
  ProjectStatusBadge: ({ currentStatusId }: { currentStatusId?: string }) => (
    <div data-testid="stage-pipeline">{currentStatusId}</div>
  ),
}));

jest.mock("@/components/UnifiedClientDetails", () => ({
  UnifiedClientDetails: ({ lead }: { lead?: { name?: ReactNode } }) => (
    <div data-testid="unified-client-details">{lead?.name}</div>
  ),
}));

jest.mock("@/components/ProjectPaymentsSection", () => ({
  ProjectPaymentsSection: ({ projectId }: { projectId: string }) => (
    <div data-testid="payments-section">payments-{projectId}</div>
  ),
}));

jest.mock("@/components/ProjectServicesSection", () => ({
  ProjectServicesSection: ({ projectId }: { projectId: string }) => (
    <div data-testid="services-section">services-{projectId}</div>
  ),
}));

jest.mock("@/components/SessionsSection", () => ({
  SessionsSection: ({ sessions }: { sessions: Array<{ id: string }> }) => (
    <div data-testid="sessions-section">sessions-{sessions.length}</div>
  ),
}));

jest.mock("@/components/ProjectActivitySection", () => ({
  ProjectActivitySection: ({ projectId }: { projectId: string }) => (
    <div data-testid="activity-section">activity-{projectId}</div>
  ),
}));

jest.mock("@/components/ProjectTodoListEnhanced", () => ({
  ProjectTodoListEnhanced: ({ projectId }: { projectId: string }) => (
    <div data-testid="todos-section">todos-{projectId}</div>
  ),
}));

jest.mock("@/components/ProjectStagePipeline", () => ({
  ProjectStagePipeline: ({ currentStatusId }: { currentStatusId?: string }) => (
    <div data-testid="stage-pipeline">{currentStatusId}</div>
  ),
}));

jest.mock("@/components/SimpleProjectTypeSelect", () => ({
  SimpleProjectTypeSelect: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange: (newValue: string) => void;
  }) => (
    <select
      data-testid="project-type-select"
      value={value}
      onChange={(event: ChangeEvent<HTMLSelectElement>) => onValueChange(event.target.value)}
    >
      <option value="">none</option>
      <option value="type-1">type-1</option>
    </select>
  ),
}));

jest.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) => (
    <div role="menuitem" onClick={onSelect}>
      {children}
    </div>
  ),
}));

jest.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children, disabled }: { children: ReactNode; disabled?: boolean }) => (
    <button disabled={disabled}>{children}</button>
  ),
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/project-details/ProjectDetailsLayout", () => ({
  __esModule: true,
  default: ({
    header,
    left,
    sections,
    rightFooter,
  }: {
    header: ReactNode;
    left: ReactNode;
    sections: Array<{ id: string; title: ReactNode; content: ReactNode }>;
    rightFooter?: ReactNode;
  }) => (
    <div data-testid="project-details-layout">
      <div data-testid="layout-header">{header}</div>
      <div data-testid="layout-left">{left}</div>
      <div data-testid="layout-sections">
        {sections.map(section => (
          <div key={section.id} data-testid={`section-${section.id}`}>
            <span>{section.title}</span>
            <div>{section.content}</div>
          </div>
        ))}
      </div>
      {rightFooter}
    </div>
  ),
}));

jest.mock("@/components/projectArchiveToggle", () => ({
  onArchiveToggle: jest.fn().mockResolvedValue({ isArchived: false }),
}));

jest.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({
    activeOrganizationId: "org-123",
    activeOrganization: { id: "org-123", name: "Mock Org", owner_id: "user-1" },
    loading: false,
    refreshOrganization: jest.fn(),
    setActiveOrganization: jest.fn(),
  }),
}));

jest.mock("@/hooks/useNotificationTriggers", () => ({
  useNotificationTriggers: () => ({
    triggerProjectMilestone: jest.fn(),
  }),
}));

jest.mock("@/hooks/useWorkflowTriggers", () => ({
  useWorkflowTriggers: () => ({
    triggerProjectStatusChange: jest.fn(),
  }),
}));

const mockUseToast = useToast as jest.Mock;
const mockUseFormsTranslation = useFormsTranslation as jest.Mock;
const mockUseProjectHeaderSummary = useProjectHeaderSummary as jest.Mock;
const mockUseProjectSessionsSummary = useProjectSessionsSummary as jest.Mock;
const mockBuildProjectSummaryItems = buildProjectSummaryItems as jest.Mock;

describe("ProjectDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockReset();
    mockSupabaseClient.from.mockReset();
    mockSupabaseClient.auth.getUser.mockReset?.();
    mockSupabaseClient.rpc.mockReset?.();

    mockUseToast.mockReturnValue({ toast: jest.fn() });
    mockUseFormsTranslation.mockReturnValue({ t: (key: string) => key });
    mockUseProjectHeaderSummary.mockReturnValue({
      summary: {
        payments: { currency: "TRY", remaining: 250, total: 350 },
        todos: { total: 3, completed: 2 },
        services: { total: 1, value: 150 },
      },
    });
    mockUseProjectSessionsSummary.mockReturnValue({
      summary: { planned: 1, completed: 0, upcoming: 1 },
    });
    mockBuildProjectSummaryItems.mockReturnValue([
      { id: "summary", label: "Summary Item" },
    ]);
  });

  const setupProjectSuccessMocks = () => {
    const project = {
      id: "project-1",
      name: "Mock Project",
      description: "Project description",
      lead_id: "lead-1",
      project_type_id: "type-1",
      status_id: "status-active",
    };

    const sessions = [
      {
        id: "session-1",
        status: "planned",
        session_time: "2024-01-01T00:00:00Z",
        notes: "",
      },
    ];

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const selectProjects = jest.fn().mockImplementation((columns: string) => {
      if (columns === "*") {
        return {
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: project, error: null }),
          }),
        };
      }

      if (columns === "status_id, previous_status_id") {
        return {
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { status_id: "status-active", previous_status_id: "status-prev" },
              error: null,
            }),
          }),
        };
      }

      return {
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const selectSessions = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: sessions, error: null }),
    });

    const selectLeads = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            id: "lead-1",
            name: "Lead Person",
            email: "lead@example.com",
            phone: null,
            status: "active",
            notes: null,
          },
          error: null,
        }),
      }),
    });

    const selectProjectTypes = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: "type-1", name: "Wedding" },
          error: null,
        }),
      }),
    });

    const selectStatuses = jest.fn((columns?: string) => {
      if (columns === "*") {
        return {
          order: jest.fn().mockResolvedValue({
            data: [
              { id: "status-active", name: "Active", color: "#00ff00" },
              { id: "status-archived", name: "Archived", color: "#ff0000" },
            ],
            error: null,
          }),
        };
      }

      return {
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: "status-active", name: "Active" },
            error: null,
          }),
        }),
      };
    });

    mockSupabaseClient.from.mockImplementation((table: string) => {
      switch (table) {
        case "projects":
          return { select: selectProjects };
        case "sessions":
          return { select: selectSessions };
        case "leads":
          return { select: selectLeads };
        case "project_types":
          return { select: selectProjectTypes };
        case "project_statuses":
          return { select: selectStatuses };
        default:
          return { select: jest.fn() };
      }
    });
  };

  it("renders project detail layout once data is loaded", async () => {
    setupProjectSuccessMocks();

    render(<ProjectDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("project-details-layout")).toBeInTheDocument();
    });

    expect(screen.getByTestId("unified-client-details")).toHaveTextContent("Lead Person");
    await waitFor(() => {
      expect(screen.getByTestId("stage-pipeline")).toHaveTextContent("status-active");
    });
    expect(screen.getByTestId("section-sessions")).toBeInTheDocument();
    expect(mockBuildProjectSummaryItems).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionsSummary: { planned: 1, completed: 0, upcoming: 1 },
      })
    );
  });

  it("navigates back to projects and toasts when project lookup fails", async () => {
    const toastSpy = jest.fn();
    mockUseToast.mockReturnValue({ toast: toastSpy });

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({
              single: jest.fn().mockResolvedValue({ data: null, error: new Error("not found") }),
            }),
          }),
        };
      }

      return { select: jest.fn() };
    });

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    render(<ProjectDetail />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/projects");
    });

    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Error",
      })
    );

    consoleErrorSpy.mockRestore();
  });
});
