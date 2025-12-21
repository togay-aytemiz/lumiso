import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import AllProjects from "../AllProjects";
import { toast } from "@/hooks/use-toast";
import { useProjectsListFilters, useProjectsArchivedFilters } from "@/pages/projects/hooks/useProjectsFilters";
import { useProjectsData } from "@/pages/projects/hooks/useProjectsData";
import { useOnboarding } from "@/contexts/useOnboarding";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useConnectivity } from "@/contexts/useConnectivity";
import { useProjectTypes, useProjectStatuses, useServices } from "@/hooks/useOrganizationData";
import { useThrottledRefetchOnFocus } from "@/hooks/useThrottledRefetchOnFocus";

jest.mock("@/features/project-creation", () => ({
  ProjectCreationWizardSheet: ({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) => (
    <button
      type="button"
      data-testid="project-wizard-sheet"
      data-open={String(isOpen)}
      onClick={() => onOpenChange(false)}
    >
      Wizard
    </button>
  ),
}));

jest.mock("@/components/ViewProjectDialog", () => ({
  ViewProjectDialog: () => null,
}));

jest.mock("@/components/ProjectSheetView", () => ({
  ProjectSheetView: () => null,
}));

jest.mock("@/components/ProjectKanbanBoard", () => ({
  __esModule: true,
  default: ({ projects }: { projects: Array<{ id: string; name: string }> }) => (
    <div data-testid="kanban-board">
      {projects.map((project) => (
        <div key={project.id}>{project.name}</div>
      ))}
    </div>
  ),
}));

jest.mock("@/components/GlobalSearch", () => ({
  __esModule: true,
  default: () => <div data-testid="global-search" />,
}));

jest.mock("@/components/ui/page-header", () => ({
  PageHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-header">{children}</div>
  ),
  PageHeaderSearch: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-header-search">{children}</div>
  ),
  PageHeaderActions: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-header-actions">{children}</div>
  ),
}));

jest.mock("@/components/ui/button", () => {
  const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ children, ...props }, ref) => (
      <button ref={ref} {...props}>
        {children}
      </button>
    )
  );
  Button.displayName = "Button";
  return {
    __esModule: true,
    Button,
  };
});

jest.mock("@/components/ProjectStatusBadge", () => ({
  ProjectStatusBadge: ({ currentStatusId }: { currentStatusId?: string }) => (
    <span data-testid="project-status">{currentStatusId}</span>
  ),
}));

type MockProject = {
  id: string;
  name: string;
  description: string;
  status_id: string;
  lead: { id: string; name: string };
  project_type: { id: string; name: string };
  project_status: { id: string; name: string };
  session_count: number;
  services: Array<{ id: string; name: string }>;
  completed_todo_count: number;
  todo_count: number;
  open_todos: unknown[];
  created_at: string;
  updated_at: string;
  paid_amount: number;
  remaining_amount: number;
} & Record<string, unknown>;

type AdvancedDataTableProps = {
  data: MockProject[];
  actions?: React.ReactNode;
};

jest.mock("@/components/KanbanSettingsSheet", () => ({
  KanbanSettingsSheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/data-table", () => ({
  AdvancedDataTable: ({ data, actions }: AdvancedDataTableProps) => (
    <div data-testid="advanced-data-table">
      <div data-testid="data-table-actions">{actions}</div>
      <div>
        {data.map((row) => (
          <div key={row.id}>{row.name}</div>
        ))}
      </div>
    </div>
  ),
}));

jest.mock("@/components/shared/OnboardingTutorial", () => ({
  OnboardingTutorial: () => <div data-testid="onboarding-tutorial" />,
}));

jest.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options && "visible" in options && "total" in options) {
        return `${key}:${options.visible}/${options.total}`;
      }
      return key;
    },
  }),
  useDashboardTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/hooks/useOrganizationData", () => ({
  useProjectTypes: jest.fn(),
  useProjectStatuses: jest.fn(),
  useServices: jest.fn(),
}));

jest.mock("@/pages/projects/hooks/useProjectsFilters", () => ({
  useProjectsListFilters: jest.fn(),
  useProjectsArchivedFilters: jest.fn(),
}));

jest.mock("@/pages/projects/hooks/useProjectsData", () => ({
  useProjectsData: jest.fn(),
}));

jest.mock("@/contexts/useOnboarding", () => ({
  useOnboarding: jest.fn(),
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(),
}));

jest.mock("@/contexts/useConnectivity", () => ({
  useConnectivity: jest.fn(),
}));

jest.mock("@/hooks/useThrottledRefetchOnFocus", () => ({
  useThrottledRefetchOnFocus: jest.fn(),
}));

jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
}));

jest.mock("@/lib/utils", () => ({
  formatDate: (value: string | null) => value ?? "",
  isNetworkError: () => false,
}));

jest.mock("@/lib/debug", () => ({
  startTimer: () => ({ end: jest.fn() }),
}));

jest.mock("xlsx/xlsx.mjs", () => ({
  writeFileXLSX: jest.fn(),
  utils: {
    json_to_sheet: jest.fn(() => ({})),
    book_new: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
  },
}));

jest.mock("date-fns", () => ({
  format: () => "2024-01-01_0100",
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options && "visible" in options && "total" in options) {
        return `${key}:${options.visible}/${options.total}`;
      }
      return key;
    },
  }),
}));

const mockUseProjectsListFilters = useProjectsListFilters as jest.Mock;
const mockUseProjectsArchivedFilters = useProjectsArchivedFilters as jest.Mock;
const mockUseProjectsData = useProjectsData as jest.Mock;
const mockUseOnboarding = useOnboarding as jest.Mock;
const mockUseOrganization = useOrganization as jest.Mock;
const mockUseConnectivity = useConnectivity as jest.Mock;
const mockUseProjectTypes = useProjectTypes as jest.Mock;
const mockUseProjectStatuses = useProjectStatuses as jest.Mock;
const mockUseServices = useServices as jest.Mock;
const mockUseThrottledRefetchOnFocus = useThrottledRefetchOnFocus as jest.Mock;

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const createProject = (overrides: Partial<MockProject> = {}): MockProject => ({
  id: "project-1",
  name: "Sample Project",
  description: "Description",
  status_id: "status-1",
  lead: { id: "lead-1", name: "Client" },
  project_type: { id: "type-1", name: "Wedding" },
  project_status: { id: "status-1", name: "In Progress" },
  session_count: 2,
  services: [{ id: "service-1", name: "Photography" }],
  completed_todo_count: 1,
  todo_count: 3,
  open_todos: [],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-02T00:00:00Z",
  paid_amount: 0,
  remaining_amount: 0,
  ...overrides,
});

const defaultFilters = {
  state: {},
  filtersConfig: [],
  activeCount: 0,
  summaryChips: [],
  reset: jest.fn(),
};

const connectivity = {
  reportNetworkError: jest.fn(),
  reportRecovery: jest.fn(),
  registerRetry: jest.fn(() => () => {}),
  isOffline: false,
  isRetrying: false,
  issueCause: null,
  runRetryAll: jest.fn(),
};

const onboarding = {
  completeCurrentStep: jest.fn().mockResolvedValue(undefined),
  shouldLockNavigation: false,
  currentStepInfo: null,
};

const setupDefaults = (overrides?: {
  projects?: ReturnType<typeof createProject>[];
  listTotal?: number;
  archivedTotal?: number;
}) => {
  const projects = overrides?.projects ?? [createProject()];
  mockUseProjectsListFilters.mockReturnValue({ ...defaultFilters });
  mockUseProjectsArchivedFilters.mockReturnValue({ ...defaultFilters });
  mockUseProjectTypes.mockReturnValue({ data: [] });
  mockUseProjectStatuses.mockReturnValue({ data: [], isLoading: false });
  mockUseServices.mockReturnValue({ data: [] });
  mockUseOnboarding.mockReturnValue(onboarding);
  mockUseOrganization.mockReturnValue({ activeOrganizationId: "org-1" });
  mockUseConnectivity.mockReturnValue(connectivity);
  mockUseThrottledRefetchOnFocus.mockImplementation(() => {});

  mockUseProjectsData.mockReturnValue({
    listProjects: projects,
    archivedProjects: [],
    listTotalCount: overrides?.listTotal ?? projects.length,
    archivedTotalCount: overrides?.archivedTotal ?? 0,
    initialLoading: false,
    listLoading: false,
    archivedLoading: false,
    refetch: jest.fn().mockResolvedValue(undefined),
    fetchProjectsData: jest.fn().mockResolvedValue({
      projects,
      count: projects.length,
      source: "network",
    }),
    getCachedProjects: jest.fn(() => []),
    getCacheStatus: jest.fn(() => ({
      total: 0,
      cached: 0,
      contiguous: 0,
      hasFull: false,
      key: null,
      lastFetched: 0,
    })),
  });
};

const renderAllProjects = async () => {
  let renderResult: ReturnType<typeof render> | null = null;
  await act(async () => {
    renderResult = render(<AllProjects />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  if (!renderResult) {
    throw new Error("Failed to render AllProjects");
  }
  return renderResult;
};

beforeEach(() => {
  jest.clearAllMocks();
  setupDefaults();
  window.localStorage.clear();
  window.history.pushState({}, "", "http://localhost/projects");
});

afterEach(() => {
  jest.clearAllMocks();
});

it("persists view mode selection to localStorage and url", async () => {
  window.history.pushState({}, "", "http://localhost/projects");
  await renderAllProjects();

  const boardButton = screen.getByRole("button", { name: "projects.board" });
  await act(async () => {
    fireEvent.click(boardButton);
  });

  expect(window.localStorage.getItem("projects:viewMode")).toBe("board");
  expect(window.location.search).toBe("?view=board");
});

it("loads board projects and keeps list view data in sync when toggling views", async () => {
  const boardProjects = [createProject({ id: "project-2", name: "Board Project" })];
  const fetchProjectsData = jest.fn().mockResolvedValue({
    projects: boardProjects,
    count: boardProjects.length,
    source: "network",
  });

  mockUseProjectsData.mockReturnValue({
    listProjects: boardProjects,
    archivedProjects: [],
    listTotalCount: boardProjects.length,
    archivedTotalCount: 0,
    initialLoading: false,
    listLoading: false,
    archivedLoading: false,
    refetch: jest.fn().mockResolvedValue(undefined),
    fetchProjectsData,
    getCachedProjects: jest.fn(() => []),
    getCacheStatus: jest.fn(() => ({
      total: 0,
      cached: 0,
      contiguous: 0,
      hasFull: false,
      key: null,
      lastFetched: 0,
    })),
  });

  window.history.pushState({}, "", "http://localhost/projects?view=board");

  await renderAllProjects();

  await waitFor(() => {
    expect(screen.getByTestId("kanban-board")).toHaveTextContent("Board Project");
  });

  expect(fetchProjectsData).toHaveBeenCalledWith("active", expect.objectContaining({ includeCount: true }));

  const listButton = screen.getByRole("button", { name: "projects.list" });
  await act(async () => {
    fireEvent.click(listButton);
  });

  await waitFor(() => {
    expect(screen.getByTestId("advanced-data-table")).toHaveTextContent("Board Project");
  });
});

it("shows an error toast when exporting projects fails", async () => {
  const consoleErrorSpy = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});
  const projects = [createProject({ id: "project-3", name: "Export Project" })];
  const fetchProjectsData = jest.fn().mockRejectedValue(new Error("export failed"));

  mockUseProjectsData.mockReturnValue({
    listProjects: projects,
    archivedProjects: [],
    listTotalCount: projects.length,
    archivedTotalCount: 0,
    initialLoading: false,
    listLoading: false,
    archivedLoading: false,
    refetch: jest.fn().mockResolvedValue(undefined),
    fetchProjectsData,
    getCachedProjects: jest.fn(() => []),
    getCacheStatus: jest.fn(() => ({
      total: 0,
      cached: 0,
      contiguous: 0,
      hasFull: false,
      key: null,
      lastFetched: 0,
    })),
  });

  window.history.pushState({}, "", "http://localhost/projects?view=list");

  await renderAllProjects();

  const exportButton = screen.getByRole("button", { name: /projects.export.button/i });
  await act(async () => {
    fireEvent.click(exportButton);
  });

  await waitFor(() => {
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "projects.export.errorTitle",
      variant: "destructive",
      description: "export failed",
    }));
  });

  expect(consoleErrorSpy).toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
});
