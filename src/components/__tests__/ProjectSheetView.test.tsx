import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { ProjectSheetView } from "../ProjectSheetView";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { onArchiveToggle } from "@/components/ViewProjectDialog";
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

jest.mock("@/components/ViewProjectDialog", () => ({
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

jest.mock("@/components/ProjectStatusBadge", () => ({
  ProjectStatusBadge: ({ onStatusChange, editable }: any) => (
    <button data-testid="project-status-badge" onClick={onStatusChange} disabled={!editable}>
      status
    </button>
  ),
}));

jest.mock("@/components/project-details/ProjectDetailsLayout", () => ({
  __esModule: true,
  default: ({ sections, header, left, rightFooter }: any) => (
    <div data-testid="project-details-layout">
      <div data-testid="layout-header">{header}</div>
      <div data-testid="layout-left">{left}</div>
      <div data-testid="layout-sections">
        {sections?.map((section: any) => (
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

jest.mock("@/components/UnifiedClientDetails", () => ({
  UnifiedClientDetails: ({ lead }: any) => (
    <div data-testid="unified-client-details">{lead?.name}</div>
  ),
}));

jest.mock("@/components/ProjectPaymentsSection", () => ({
  ProjectPaymentsSection: ({ onPaymentsUpdated }: any) => (
    <div data-testid="project-payments-section" onClick={onPaymentsUpdated}>
      payments
    </div>
  ),
}));

jest.mock("@/components/ProjectServicesSection", () => ({
  ProjectServicesSection: ({ onServicesUpdated }: any) => (
    <div data-testid="project-services-section" onClick={() => onServicesUpdated?.()}>
      services
    </div>
  ),
}));

jest.mock("@/components/SessionsSection", () => ({
  SessionsSection: ({ sessions, onDeleteSession, onSessionUpdated }: any) => (
    <div>
      <div data-testid="sessions-section-count">{sessions.length}</div>
      <button data-testid="sessions-delete" onClick={() => onDeleteSession?.("session-1")}>delete</button>
      <button data-testid="sessions-update" onClick={() => onSessionUpdated?.()}>update</button>
    </div>
  ),
}));

jest.mock("@/components/ProjectActivitySection", () => ({
  ProjectActivitySection: ({ onActivityUpdated }: any) => (
    <div data-testid="project-activity-section" onClick={() => onActivityUpdated?.()}>
      activities
    </div>
  ),
}));

jest.mock("@/components/ProjectTodoListEnhanced", () => ({
  ProjectTodoListEnhanced: ({ onTodosUpdated }: any) => (
    <div data-testid="project-todos-section" onClick={() => onTodosUpdated?.()}>
      todos
    </div>
  ),
}));

jest.mock("@/components/SimpleProjectTypeSelect", () => ({
  SimpleProjectTypeSelect: ({ value, onValueChange, disabled }: any) => (
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
  EntityHeader: ({ title, actions, summaryItems }: any) => (
    <div data-testid="entity-header">
      <div>{title}</div>
      <div data-testid="entity-summary-count">{summaryItems?.length ?? 0}</div>
      <div>{actions}</div>
    </div>
  ),
}));

jest.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: any) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: any) => <div data-testid="sheet">{children}</div>,
  SheetContent: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: any) => <div>{children}</div>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogCancel: ({ children, ...rest }: any) => (
    <button {...rest} type="button">
      {children}
    </button>
  ),
  AlertDialogAction: ({ children, onClick, disabled }: any) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, any>) => {
      if (options?.amount !== undefined) {
        return `${key}:${options.amount}`;
      }
      if (options?.count !== undefined) {
        return `${key}:${options.count}`;
      }
      return key;
    },
  }),
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

const createQueryBuilder = (response: any, overrides: Record<string, any> = {}) => {
  let current = response;
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn(() => builder),
    maybeSingle: jest.fn(() => Promise.resolve(current)),
    single: jest.fn(() => Promise.resolve(current)),
    update: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    in: jest.fn(() => builder),
    not: jest.fn(() => builder),
    is: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    then: (resolve: any, reject?: any) => Promise.resolve(current).then(resolve, reject),
    catch: (reject: any) => Promise.resolve(current).catch(reject),
    finally: (onFinally: any) => Promise.resolve(current).finally(onFinally),
  };

  Object.entries(overrides).forEach(([key, value]) => {
    builder[key] = value;
  });

  return builder;
};

const mockSupabaseFrom = supabase.from as jest.Mock;

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
], error: null };

const leadResponse = {
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

const projectTypeResponse = {
  data: { id: "type-1", name: "Wedding" },
  error: null,
};

const projectStatusResponse = {
  data: { id: "status-active", name: "active" },
  error: null,
};

const projectRowResponse = {
  data: { status_id: "status-active", previous_status_id: "status-archived" },
  error: null,
};

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
        const builder = createQueryBuilder({ data: null, error: null });
        builder.eq.mockImplementation(() => builder);
        builder.delete.mockImplementation(() => builder);
        builder.insert.mockImplementation(() => builder);
        return builder;
      }
      default:
        return createQueryBuilder({ data: null, error: null });
    }
  });

  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "user-1" } } });
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

  it("allows editing and saving project details", async () => {
    const { onProjectUpdated } = renderComponent();

    await waitFor(() => screen.getByTestId("project-payments-section"));

    fireEvent.click(screen.getByText("project_sheet.edit_project"));

    const nameInput = screen.getByPlaceholderText("labels.project_name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Updated Project" } });

    const descriptionTextarea = screen.getByPlaceholderText("labels.project_description") as HTMLTextAreaElement;
    fireEvent.change(descriptionTextarea, { target: { value: "New description" } });

    const typeSelect = screen.getByTestId("project-type-select") as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: "type-2" } });

    fireEvent.click(screen.getByText("common:buttons.save"));

    await waitFor(() => {
      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: "Success",
        description: "success.projectUpdated",
      });
    });

    expect(onProjectUpdated).toHaveBeenCalled();
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
