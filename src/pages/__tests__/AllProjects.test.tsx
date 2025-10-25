import type { ReactNode } from "react";

import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import AllProjects from "../AllProjects";
import { toast } from "@/hooks/use-toast";
import type { ProjectListItem } from "@/pages/projects/types";
import { useProjectsData } from "@/pages/projects/hooks/useProjectsData";
import { useProjectsListFilters, useProjectsArchivedFilters } from "@/pages/projects/hooks/useProjectsFilters";
import { useProjectTypes, useProjectStatuses, useServices } from "@/hooks/useOrganizationData";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useConnectivity } from "@/contexts/ConnectivityContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useDashboardTranslation, useFormsTranslation } from "@/hooks/useTypedTranslation";

jest.mock("@/components/EnhancedProjectDialog", () => ({
  EnhancedProjectDialog: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/ViewProjectDialog", () => ({
  ViewProjectDialog: () => <div data-testid="view-project-dialog" />,
}));

jest.mock("@/components/ProjectSheetView", () => ({
  ProjectSheetView: ({ open, project }: { open: boolean; project: ProjectListItem | null }) => (
    <div data-testid="project-sheet-view">{open ? `open:${project?.name}` : "closed"}</div>
  ),
}));

jest.mock("@/components/ProjectKanbanBoard", () => ({
  __esModule: true,
  default: () => <div data-testid="kanban-board" />,
}));

jest.mock("@/components/GlobalSearch", () => ({
  __esModule: true,
  default: () => <div data-testid="global-search">search</div>,
}));

jest.mock("@/components/ui/page-header", () => ({
  PageHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageHeaderSearch: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageHeaderActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, "data-testid": dataTestId }: any) => (
    <button type="button" onClick={onClick} disabled={disabled} data-testid={dataTestId}>
      {children}
    </button>
  ),
}));

jest.mock("lucide-react", () => ({
  Plus: () => <span data-testid="icon-plus" />,
  LayoutGrid: () => <span data-testid="icon-grid" />,
  List: () => <span data-testid="icon-list" />,
  Archive: () => <span data-testid="icon-archive" />,
  Settings: () => <span data-testid="icon-settings" />,
  FileDown: () => <span data-testid="icon-file" />,
  Loader2: () => <span data-testid="icon-loader" />,
}));

jest.mock("@/components/ProjectStatusBadge", () => ({
  ProjectStatusBadge: () => <div data-testid="status-badge" />,
}));

jest.mock("@/components/KanbanSettingsSheet", () => ({
  KanbanSettingsSheet: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/data-table", () => ({
  AdvancedDataTable: ({
    title,
    data,
    onRowClick,
    onSortChange,
    actions,
    hasMore,
    onLoadMore,
  }: any) => {
    const normalizedTitle = String(title).replace(/[^a-z0-9_-]+/gi, "-");
    return (
      <div data-testid={`advanced-table-${normalizedTitle}`}>
        <span>{title}</span>
        <div data-testid={`rows-${normalizedTitle}`}>{data.length}</div>
        <button
          type="button"
          data-testid={`row-trigger-${normalizedTitle}`}
          onClick={() => onRowClick?.(data[0])}
        >
          row
        </button>
        <button
          type="button"
          data-testid={`sort-trigger-${normalizedTitle}`}
          onClick={() => onSortChange?.({ columnId: "name", direction: "asc" })}
        >
          sort
        </button>
        {hasMore ? (
          <button type="button" data-testid={`load-more-${normalizedTitle}`} onClick={() => onLoadMore?.()}>
            more
          </button>
        ) : null}
        <div data-testid={`actions-${normalizedTitle}`}>{actions}</div>
      </div>
    );
  },
}));

jest.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
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

jest.mock("@/contexts/ConnectivityContext", () => ({
  useConnectivity: jest.fn(),
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(),
}));

jest.mock("@/contexts/OnboardingContext", () => ({
  useOnboarding: jest.fn(),
}));

jest.mock("@/hooks/useThrottledRefetchOnFocus", () => ({
  useThrottledRefetchOnFocus: jest.fn(),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useDashboardTranslation: jest.fn(),
  useFormsTranslation: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/lib/debug", () => ({
  startTimer: () => ({ end: jest.fn() }),
}));

const mockToast = toast as jest.Mock;
const mockUseProjectsData = useProjectsData as jest.Mock;
const mockUseProjectsListFilters = useProjectsListFilters as jest.Mock;
const mockUseProjectsArchivedFilters = useProjectsArchivedFilters as jest.Mock;
const mockUseProjectTypes = useProjectTypes as jest.Mock;
const mockUseProjectStatuses = useProjectStatuses as jest.Mock;
const mockUseServices = useServices as jest.Mock;
const mockUseConnectivity = useConnectivity as jest.Mock;
const mockUseOrganization = useOrganization as jest.Mock;
const mockUseOnboarding = useOnboarding as jest.Mock;
const mockUseFormsTranslation = useFormsTranslation as jest.Mock;
const mockUseDashboardTranslation = useDashboardTranslation as jest.Mock;

const writeFileXLSX = jest.fn();
const jsonToSheet = jest.fn(() => ({}));
const bookNew = jest.fn(() => ({}));
const bookAppendSheet = jest.fn();

jest.mock("xlsx/xlsx.mjs", () => ({
  __esModule: true,
  writeFileXLSX: (...args: unknown[]) => writeFileXLSX(...args),
  utils: {
    json_to_sheet: (...args: unknown[]) => jsonToSheet(...args),
    book_new: (...args: unknown[]) => bookNew(...args),
    book_append_sheet: (...args: unknown[]) => bookAppendSheet(...args),
  },
}));

jest.mock("date-fns", () => ({
  format: () => "2024-01-01_0000",
}));

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
  };
});

const createProject = (overrides: Partial<ProjectListItem> = {}): ProjectListItem => ({
  id: "project-1",
  name: "Project Alpha",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  session_count: 1,
  todo_count: 2,
  completed_todo_count: 1,
  lead: { id: "lead-1", name: "Alice" },
  services: [],
  project_type: { id: "type-1", name: "Wedding" } as any,
  project_status: { id: "status-1", name: "Planning" } as any,
  status_id: "status-1",
  ...overrides,
} as ProjectListItem);

const setupDefaults = (overrides?: Partial<ReturnType<typeof createMocks>>) => {
  const mocks = createMocks();
  const merged = { ...mocks, ...(overrides ?? {}) };

  mockUseProjectTypes.mockReturnValue({ data: [] });
  mockUseProjectStatuses.mockReturnValue({ data: [], isLoading: false });
  mockUseServices.mockReturnValue({ data: [] });

  mockUseProjectsListFilters.mockReturnValue({
    state: { types: [], stages: [], sessionPresence: "any", progress: "any", services: [] },
    filtersConfig: {},
    activeCount: 0,
    summaryChips: [],
    reset: jest.fn(),
  });

  mockUseProjectsArchivedFilters.mockReturnValue({
    state: { types: [], balancePreset: "any", balanceMin: null, balanceMax: null },
    filtersConfig: {},
    activeCount: 0,
    summaryChips: [],
    reset: jest.fn(),
  });

  mockUseOrganization.mockReturnValue({ activeOrganizationId: "org-1" });
  mockUseConnectivity.mockReturnValue({
    reportNetworkError: jest.fn(),
    reportRecovery: jest.fn(),
    registerRetry: jest.fn(() => jest.fn()),
  });

  mockUseFormsTranslation.mockReturnValue({ t: (key: string) => key });
  mockUseDashboardTranslation.mockReturnValue({ t: (key: string) => key });

  const onboardingState = {
    completeCurrentStep: jest.fn().mockResolvedValue(undefined),
    shouldLockNavigation: false,
    currentStepInfo: null,
  };
  mockUseOnboarding.mockImplementation(() => onboardingState);

  mockUseProjectsData.mockReturnValue(merged.projectsData);
};

const createMocks = () => {
  const listProjects = [createProject()];
  const archivedProjects = [createProject({ id: "project-2", name: "Project Beta" })];
  const fetchProjectsData = jest.fn().mockImplementation(async (scope: string) => ({
    projects: scope === "active" ? listProjects : archivedProjects,
    count: scope === "active" ? listProjects.length : archivedProjects.length,
    source: "network",
  }));

  return {
    projectsData: {
      listProjects,
      archivedProjects,
      listTotalCount: listProjects.length,
      archivedTotalCount: archivedProjects.length,
      listLoading: false,
      archivedLoading: false,
      refetch: jest.fn().mockResolvedValue(undefined),
      fetchProjectsData,
      getCachedProjects: jest.fn(() => []),
      getCacheStatus: jest.fn(() => ({ cached: 0, hasFull: false, total: 0 })),
    },
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigate.mockReset();
  writeFileXLSX.mockReset();
  jsonToSheet.mockClear();
  bookNew.mockClear();
  bookAppendSheet.mockClear();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  setupDefaults();
});

describe("AllProjects", () => {
  it("renders list view by default and opens quick view when a row is clicked", () => {
    render(<AllProjects />);

    expect(screen.getByTestId("advanced-table-projects-list_view")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("row-trigger-projects-list_view"));

    expect(screen.getByTestId("project-sheet-view")).toHaveTextContent("open:Project Alpha");
  });

  it("switches to archived view when the archived tab is selected", () => {
    render(<AllProjects />);

    fireEvent.click(screen.getByRole("button", { name: /projects.archived/i }));

    expect(screen.getByTestId("advanced-table-projects-archived_view")).toBeInTheDocument();
  });

  it("exports active projects and shows a success toast", async () => {
    const mocks = createMocks();
    setupDefaults({ projectsData: mocks.projectsData });

    render(<AllProjects />);

    fireEvent.click(screen.getByText("projects.export.button"));

    await waitFor(() => {
      expect(mocks.projectsData.fetchProjectsData).toHaveBeenCalledWith("active", expect.any(Object));
      expect(writeFileXLSX).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: "projects.export.successTitle",
        description: "projects.export.successDescription",
      });
    });
  });
});
