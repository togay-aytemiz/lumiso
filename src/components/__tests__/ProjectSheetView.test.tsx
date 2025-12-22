import type { ComponentProps, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { ProjectSheetView } from "../ProjectSheetView";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { onArchiveToggle } from "@/components/projectArchiveToggle";
import { useProjectHeaderSummary } from "@/hooks/useProjectHeaderSummary";
import { useProjectSessionsSummary } from "@/hooks/useProjectSessionsSummary";
import { useIsMobile } from "@/hooks/use-mobile";

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  },
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}));

jest.mock("@/components/projectArchiveToggle", () => ({
  onArchiveToggle: jest.fn(),
}));

jest.mock("@/hooks/useProjectHeaderSummary", () => ({
  useProjectHeaderSummary: jest.fn(),
}));

jest.mock("@/hooks/useProjectSessionsSummary", () => ({
  useProjectSessionsSummary: jest.fn(),
}));

jest.mock("@/hooks/use-mobile", () => ({
  useIsMobile: jest.fn(),
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(() => ({
    activeOrganizationId: "org-1",
    activeOrganization: { id: "org-1" },
    loading: false,
    refreshOrganization: jest.fn(),
    setActiveOrganization: jest.fn(),
  })),
}));

jest.mock("@/features/project-creation", () => ({
  ProjectCreationWizardSheet: ({ isOpen }: { isOpen?: boolean }) =>
    isOpen ? <div data-testid="project-creation-wizard" /> : null,
}));

jest.mock("@/components/SessionSchedulingSheet", () => ({
  SessionSchedulingSheet: () => (
    <div data-testid="session-scheduling-sheet" />
  ),
}));

jest.mock("@/components/ProjectPackageSummaryCard", () => ({
  ProjectPackageSummaryCard: ({
    onEditDetails,
    onEditPackage,
  }: {
    onEditDetails?: () => void;
    onEditPackage?: () => void;
  }) => (
    <div>
      <button type="button" data-testid="edit-project-details" onClick={onEditDetails}>
        edit-details
      </button>
      <button type="button" data-testid="edit-project-package" onClick={onEditPackage}>
        edit-package
      </button>
    </div>
  ),
}));

type WithChildren = { children?: ReactNode };

interface ProjectStagePipelineMockProps {
  onStatusChange?: () => void;
  editable?: boolean;
}

jest.mock("@/components/ProjectStagePipeline", () => ({
  ProjectStagePipeline: ({ onStatusChange, editable }: ProjectStagePipelineMockProps) => (
    <button data-testid="project-stage-pipeline" onClick={onStatusChange} disabled={!editable}>
      pipeline
    </button>
  ),
}));

interface LayoutSection {
  id: string;
  title: ReactNode;
  content: ReactNode;
}

interface ProjectDetailsLayoutMockProps {
  sections?: LayoutSection[];
  header?: ReactNode;
  left?: ReactNode;
  rightFooter?: ReactNode;
}

jest.mock("@/components/project-details/ProjectDetailsLayout", () => ({
  __esModule: true,
  default: ({ sections, header, left, rightFooter }: ProjectDetailsLayoutMockProps) => (
    <div data-testid="project-details-layout">
      <div data-testid="layout-header">{header}</div>
      <div data-testid="layout-left">{left}</div>
      <div data-testid="layout-sections">
        {sections?.map((section) => (
          <section key={section.id} data-testid={`section-${section.id}`}>
            <h2>{section.title}</h2>
            <div>{section.content}</div>
          </section>
        ))}
      </div>
      <div data-testid="layout-footer">{rightFooter}</div>
    </div>
  ),
}));

interface UnifiedClientDetailsMockProps {
  lead?: { name?: string } | null;
}

jest.mock("@/components/UnifiedClientDetails", () => ({
  UnifiedClientDetails: ({ lead }: UnifiedClientDetailsMockProps) => (
    <div data-testid="unified-client-details">{lead?.name}</div>
  ),
}));

jest.mock("@/components/ProjectPaymentsSection", () => ({
  ProjectPaymentsSection: ({ onPaymentsUpdated }: { onPaymentsUpdated?: () => void }) => (
    <div data-testid="project-payments-section" onClick={onPaymentsUpdated}>
      payments
    </div>
  ),
}));

jest.mock("@/components/ProjectServicesSection", () => ({
  ProjectServicesSection: ({ onServicesUpdated }: { onServicesUpdated?: () => void }) => (
    <div data-testid="project-services-section" onClick={() => onServicesUpdated?.()}>
      services
    </div>
  ),
}));

jest.mock("@/components/SessionsSection", () => ({
  SessionsSection: ({
    sessions,
    onDeleteSession,
    onSessionUpdated,
  }: {
    sessions: Array<unknown>;
    onDeleteSession?: (sessionId: string) => void;
    onSessionUpdated?: () => void;
  }) => (
    <div>
      <div data-testid="sessions-section-count">{sessions.length}</div>
      <button data-testid="sessions-delete" onClick={() => onDeleteSession?.("session-1")}>delete</button>
      <button data-testid="sessions-update" onClick={() => onSessionUpdated?.()}>update</button>
    </div>
  ),
}));

jest.mock("@/components/ProjectActivitySection", () => ({
  ProjectActivitySection: ({ onActivityUpdated }: { onActivityUpdated?: () => void }) => (
    <div data-testid="project-activity-section" onClick={() => onActivityUpdated?.()}>
      activities
    </div>
  ),
}));

jest.mock("@/components/ProjectTodoListEnhanced", () => ({
  ProjectTodoListEnhanced: ({ onTodosUpdated }: { onTodosUpdated?: () => void }) => (
    <div data-testid="project-todos-section" onClick={() => onTodosUpdated?.()}>
      todos
    </div>
  ),
}));

jest.mock("@/components/SimpleProjectTypeSelect", () => ({
  SimpleProjectTypeSelect: ({ value, onValueChange, disabled }: { value: string; onValueChange: (newValue: string) => void; disabled?: boolean }) => (
    <select
      data-testid="project-type-select"
      value={value}
      onChange={event => onValueChange(event.target.value)}
      disabled={disabled}
    >
      <option value="">Select</option>
      <option value="type-1">Type One</option>
      <option value="type-2">Type Two</option>
    </select>
  ),
}));

jest.mock("@/components/EntityHeader", () => ({
  EntityHeader: ({ title, actions, summaryItems }: { title?: ReactNode; actions?: ReactNode; summaryItems?: unknown[] }) => (
    <div data-testid="entity-header">
      <div>{title}</div>
      <div data-testid="entity-summary-count">{summaryItems?.length ?? 0}</div>
      <div>{actions}</div>
    </div>
  ),
}));

jest.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: WithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: WithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: WithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: WithChildren & { onSelect?: () => void }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: WithChildren) => <div data-testid="sheet">{children}</div>,
  SheetContent: ({ children }: WithChildren) => <div>{children}</div>,
  SheetHeader: ({ children }: WithChildren) => <div>{children}</div>,
  SheetTitle: ({ children }: WithChildren) => <div>{children}</div>,
  SheetFooter: ({ children }: WithChildren) => <div>{children}</div>,
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: WithChildren) => <div>{children}</div>,
  DialogContent: ({ children }: WithChildren) => <div>{children}</div>,
  DialogHeader: ({ children }: WithChildren) => <div>{children}</div>,
  DialogTitle: ({ children }: WithChildren) => <div>{children}</div>,
}));

jest.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: WithChildren) => <div>{children}</div>,
  AlertDialogContent: ({ children }: WithChildren) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: WithChildren) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: WithChildren) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: WithChildren) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: WithChildren) => <div>{children}</div>,
  AlertDialogCancel: ({ children, ...rest }: WithChildren & { onClick?: () => void }) => (
    <button {...rest} type="button">
      {children}
    </button>
  ),
  AlertDialogAction: ({ children, onClick, disabled }: WithChildren & { onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

jest.mock("react-i18next", () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options && typeof options.amount !== "undefined") {
        return `${key}:${options.amount}`;
      }
      if (options && typeof options.count !== "undefined") {
        return `${key}:${options.count}`;
      }
      return key;
    },
  }),
  Trans: ({ i18nKey, children }: { i18nKey?: string; children?: ReactNode }) =>
    children ?? i18nKey ?? null,
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: () => ({
    t: (key: string) => key,
  }),
  useMessagesTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockToast = jest.fn();
(useToast as jest.Mock).mockReturnValue({ toast: mockToast });
(useIsMobile as jest.Mock).mockReturnValue(false);

const mockHeaderSummary = {
  payments: { currency: "TRY", remaining: 2500 },
  todos: {},
  services: {},
};

const mockSessionsSummary = {
  planned: 1,
  completed: 0,
};

(useProjectHeaderSummary as jest.Mock).mockReturnValue({ summary: mockHeaderSummary });
(useProjectSessionsSummary as jest.Mock).mockReturnValue({ summary: mockSessionsSummary });

type SupabaseResponse<T> = { data: T; error: unknown };

type QueryBuilder<T> = {
  select: jest.Mock<QueryBuilder<T>, [unknown?]>;
  eq: jest.Mock<QueryBuilder<T>, [string, unknown]>;
  order: jest.Mock<QueryBuilder<T>, [string, unknown?]>;
  maybeSingle: jest.Mock<Promise<T>, []>;
  single: jest.Mock<Promise<T>, []>;
  update: jest.Mock<QueryBuilder<T>, [unknown]>;
  insert: jest.Mock<QueryBuilder<T>, [unknown]>;
  delete: jest.Mock<QueryBuilder<T>, []>;
  in: jest.Mock<QueryBuilder<T>, [string, unknown[]]>;
  not: jest.Mock<QueryBuilder<T>, [string, string, unknown]>;
  is: jest.Mock<QueryBuilder<T>, [string, string]>;
  limit: jest.Mock<QueryBuilder<T>, [number]>;
  then: jest.Mock<Promise<T>, [((value: T) => unknown), ((reason: unknown) => unknown)?]>;
  catch: jest.Mock<Promise<T>, [(reason: unknown) => unknown]>;
  finally: jest.Mock<Promise<T>, [() => void]>;
};

function createQueryBuilder<T>(response: T, overrides: Partial<QueryBuilder<T>> = {}): QueryBuilder<T> {
  const builder = {} as QueryBuilder<T>;

  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.order = jest.fn(() => builder);
  builder.maybeSingle = jest.fn(() => Promise.resolve(response));
  builder.single = jest.fn(() => Promise.resolve(response));
  builder.update = jest.fn(() => builder);
  builder.insert = jest.fn(() => builder);
  builder.delete = jest.fn(() => builder);
  builder.in = jest.fn(() => builder);
  builder.not = jest.fn(() => builder);
  builder.is = jest.fn(() => builder);
  builder.limit = jest.fn(() => builder);
  builder.then = jest.fn((onFulfilled, onRejected) =>
    Promise.resolve(response).then(onFulfilled, onRejected)
  );
  builder.catch = jest.fn((onRejected) => Promise.resolve(response).catch(onRejected));
  builder.finally = jest.fn((onFinally) => Promise.resolve(response).finally(onFinally));

  Object.assign(builder, overrides);

  return builder;
}

const mockSupabaseFrom = supabase.from as jest.MockedFunction<typeof supabase.from>;
const mockSupabaseAuthGetUser = supabase.auth.getUser as jest.MockedFunction<typeof supabase.auth.getUser>;

const baseProject = {
  id: "project-1",
  name: "Project One",
  description: "Important project",
  lead_id: "lead-1",
  user_id: "user-1",
  status_id: "status-active",
  project_type_id: "type-1",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-02T00:00:00.000Z",
};

const sessionsResponse = { data: [
  {
    id: "session-1",
    status: "planned",
    session_time: "10:00",
    session_date: "2025-01-03",
  },
], error: null } as SupabaseResponse<Array<{ id: string; status: string; session_time: string; session_date: string }>>;

const leadResponse: SupabaseResponse<{
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  notes: string;
}> = {
  data: {
    id: "lead-1",
    name: "Lead Name",
    email: "lead@example.com",
    phone: "+123",
    status: "active",
    notes: "Important lead",
  },
  error: null,
};

const projectTypeResponse: SupabaseResponse<{ id: string; name: string }> = {
  data: { id: "type-1", name: "Wedding" },
  error: null,
};

const projectStatusResponse: SupabaseResponse<Array<{ id: string; name: string; color: string }>> = {
  data: [{ id: "status-active", name: "active", color: "#2E7D32" }],
  error: null,
};

const projectRowResponse: SupabaseResponse<{ status_id: string; previous_status_id: string | null }> = {
  data: { status_id: "status-active", previous_status_id: "status-archived" },
  error: null,
};

const emptyResponse: SupabaseResponse<null> = { data: null, error: null };

const authenticatedUserResponse = {
  data: { user: { id: "user-1" } },
  error: null,
} as Awaited<ReturnType<typeof supabase.auth.getUser>>;

const setupSupabaseMocks = () => {
  mockSupabaseFrom.mockImplementation((table: string) => {
    switch (table) {
      case "sessions": {
        const builder = createQueryBuilder(sessionsResponse);
        builder.eq.mockImplementation(() => builder);
        return builder;
      }
      case "project_types": {
        const builder = createQueryBuilder(projectTypeResponse);
        builder.eq.mockImplementation(() => builder);
        return builder;
      }
      case "leads": {
        const builder = createQueryBuilder(leadResponse);
        builder.eq.mockImplementation(() => builder);
        return builder;
      }
      case "project_statuses": {
        const builder = createQueryBuilder(projectStatusResponse);
        builder.eq.mockImplementation(() => builder);
        return builder;
      }
      case "projects": {
        const builder = createQueryBuilder(projectRowResponse);
        builder.eq.mockImplementation(() => builder);
        builder.update.mockImplementation(() => builder);
        builder.delete.mockImplementation(() => builder);
        return builder;
      }
      case "project_services":
      case "todos":
      case "activities":
      case "payments": {
        const builder = createQueryBuilder(emptyResponse);
        builder.eq.mockImplementation(() => builder);
        builder.delete.mockImplementation(() => builder);
        builder.insert.mockImplementation(() => builder);
        return builder;
      }
      default:
        return createQueryBuilder(emptyResponse);
    }
  });

  mockSupabaseAuthGetUser.mockResolvedValue(authenticatedUserResponse);
};

const renderComponent = (props: Partial<ComponentProps<typeof ProjectSheetView>> = {}) => {
  setupSupabaseMocks();
  const onOpenChange = jest.fn();
  const onProjectUpdated = jest.fn();
  const onActivityUpdated = jest.fn();

  render(
    <ProjectSheetView
      project={baseProject}
      open
      onOpenChange={onOpenChange}
      onProjectUpdated={onProjectUpdated}
      onActivityUpdated={onActivityUpdated}
      leadName="Lead Name"
      {...props}
    />
  );

  return { onOpenChange, onProjectUpdated, onActivityUpdated };
};

beforeEach(() => {
  jest.clearAllMocks();
  (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
  (useIsMobile as jest.Mock).mockReturnValue(false);
  (useProjectHeaderSummary as jest.Mock).mockReturnValue({ summary: mockHeaderSummary });
  (useProjectSessionsSummary as jest.Mock).mockReturnValue({ summary: mockSessionsSummary });
  mockSupabaseAuthGetUser.mockResolvedValue(authenticatedUserResponse);
});

describe("ProjectSheetView", () => {
  it("renders project content and sections after data loads", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("project-payments-section")).toBeInTheDocument();
    });

    expect(mockSupabaseFrom).toHaveBeenCalledWith("sessions");
    expect(mockSupabaseFrom).toHaveBeenCalledWith("leads");
    expect(screen.getByText("Project One")).toBeInTheDocument();
    expect(screen.getByTestId("unified-client-details")).toHaveTextContent("Lead Name");
    expect(screen.getByTestId("section-project-sheet-payments")).toBeInTheDocument();
    expect(screen.getByTestId("project-todos-section")).toBeInTheDocument();
  });

  it("opens the edit wizard from the package summary card", async () => {
    renderComponent();

    await waitFor(() => screen.getByTestId("project-payments-section"));

    fireEvent.click(screen.getByTestId("edit-project-details"));

    await waitFor(() =>
      expect(screen.getByTestId("project-creation-wizard")).toBeInTheDocument()
    );
  });

  it("shows archive confirmation when outstanding payments exist", async () => {
    (useProjectHeaderSummary as jest.Mock).mockReturnValue({
      summary: {
        payments: { currency: "TRY", remaining: 1000 },
        todos: {},
        services: {},
      },
    });

    const archiveToggleMock = onArchiveToggle as jest.Mock;
    archiveToggleMock.mockResolvedValue({ isArchived: true });

    const { onProjectUpdated, onActivityUpdated } = renderComponent();

    await waitFor(() => screen.getByTestId("project-payments-section"));

    fireEvent.click(screen.getByText("project_sheet.archive_project"));

    const confirmButton = await screen.findByText("projectDetail.archiveConfirm.confirm");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(archiveToggleMock).toHaveBeenCalledWith({ id: "project-1", status_id: "status-active" });
    });

    expect(onProjectUpdated).toHaveBeenCalled();
    expect(onActivityUpdated).toHaveBeenCalled();
  });
});
