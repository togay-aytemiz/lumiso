import React from "react";
import { fireEvent, render, screen } from "@/utils/testUtils";
import ProjectKanbanBoard from "../ProjectKanbanBoard";
import type { ProjectListItem, ProjectStatusSummary } from "@/pages/projects/types";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => options?.defaultValue ?? key,
  }),
}));

jest.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: any) => <div data-testid="drag-drop-context">{children}</div>,
  Droppable: ({ droppableId, children }: any) => (
    <div data-testid={`droppable-${droppableId}`}>
      {children(
        {
          innerRef: jest.fn(),
          droppableProps: {},
          placeholder: <div data-testid={`placeholder-${droppableId}`} />,
        },
        { isDraggingOver: false }
      )}
    </div>
  ),
  Draggable: ({ draggableId, children }: any) => (
    <div data-testid={`draggable-${draggableId}`}>
      {children({
        innerRef: jest.fn(),
        draggableProps: {},
        dragHandleProps: {},
      })}
    </div>
  ),
}));

const professionalCardMock = jest.fn(({ project, onClick }: any) => (
  <button data-testid={`project-card-${project.id}`} onClick={onClick}>
    {project.name}
  </button>
));

jest.mock("@/components/ProfessionalKanbanCard", () => ({
  ProfessionalKanbanCard: (props: any) => professionalCardMock(props),
}));

jest.mock("@/components/EnhancedProjectDialog", () => ({
  EnhancedProjectDialog: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="enhanced-project-dialog">{children}</div>
  ),
}));

jest.mock("@/components/ViewProjectDialog", () => ({
  ViewProjectDialog: () => <div data-testid="view-project-dialog" />,
}));

jest.mock("@/hooks/useNotificationTriggers", () => ({
  useNotificationTriggers: () => ({ triggerProjectMilestone: jest.fn() }),
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ activeOrganization: { id: "org-1" } }),
}));

jest.mock("@/hooks/useKanbanSettings", () => ({
  useKanbanSettings: () => ({ settings: {} }),
}));

jest.mock("@/lib/toastHelpers", () => ({
  useI18nToast: () => ({ success: jest.fn(), error: jest.fn() }),
}));

jest.mock("@/components/ui/loading-presets", () => ({
  KanbanLoadingSkeleton: () => <div data-testid="kanban-loading" />,
}));

describe("ProjectKanbanBoard", () => {
  const onProjectsChange = jest.fn();
  const onQuickView = jest.fn();
  const onLoadMore = jest.fn();

  const createProject = (overrides: Partial<ProjectListItem>): ProjectListItem => ({
    id: "project-1",
    name: "Project Alpha",
    description: null,
    lead_id: "lead-1",
    user_id: "user-1",
    created_at: new Date("2024-01-01").toISOString(),
    updated_at: new Date("2024-01-02").toISOString(),
    status_id: "status-1",
    project_type_id: null,
    base_price: null,
    sort_order: null,
    lead: null,
    project_status: null,
    project_type: null,
    session_count: 0,
    upcoming_session_count: 0,
    planned_session_count: 0,
    next_session_date: null,
    todo_count: 0,
    completed_todo_count: 0,
    open_todos: [],
    paid_amount: null,
    remaining_amount: null,
    services: [],
    ...overrides,
  });

  const statuses: ProjectStatusSummary[] = [
    { id: "status-1", name: "In Progress", color: "#00FF00", lifecycle: "active" },
    { id: "status-2", name: "Completed", color: "#0000FF", lifecycle: "completed" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderBoard = (props: Partial<React.ComponentProps<typeof ProjectKanbanBoard>> = {}) =>
    render(
      <ProjectKanbanBoard
        projects={[
          createProject({ id: "project-1", status_id: "status-1", name: "Project Alpha" }),
          createProject({ id: "project-2", status_id: "status-2", name: "Project Beta" }),
          createProject({ id: "project-3", status_id: null, name: "Unsorted" }),
        ]}
        projectStatuses={statuses}
        onProjectsChange={onProjectsChange}
        onQuickView={onQuickView}
        onLoadMore={onLoadMore}
        hasMore
        {...props}
      />
    );

  it("renders provided project statuses with their project counts", () => {
    renderBoard();

    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();

    const droppable = screen.getByTestId("droppable-status-1");
    expect(droppable).toBeInTheDocument();

    expect(screen.getAllByText(/add_project/i).length).toBeGreaterThan(0);
  });

  it("exposes a column for projects without status", () => {
    renderBoard();

    expect(screen.getByTestId("droppable-no-status")).toBeInTheDocument();
    // Uses translation fallback when no explicit status is supplied
    expect(screen.getAllByText("pages:projects.noStatus").length).toBeGreaterThan(0);
  });

  it("invokes quick view callback when a project card is clicked", () => {
    renderBoard();

    fireEvent.click(screen.getByTestId("project-card-project-1"));
    expect(onQuickView).toHaveBeenCalledWith(expect.objectContaining({ id: "project-1" }));
  });

  it("shows a load more button when additional projects are available", () => {
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
