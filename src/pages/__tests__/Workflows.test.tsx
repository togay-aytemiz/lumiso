import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@/utils/testUtils";
import Workflows from "../Workflows";
import { useWorkflows } from "@/hooks/useWorkflows";

interface MockWorkflow {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  is_active: boolean;
  created_at: string;
  channels: string[];
}

const createWorkflow = (overrides: Partial<MockWorkflow> = {}): MockWorkflow => ({
  id: "workflow-1",
  name: "Workflow 1",
  description: "Test workflow",
  trigger_type: "onboarding",
  is_active: true,
  created_at: "2024-01-01T00:00:00.000Z",
  channels: ["email"],
  ...overrides,
});

jest.mock("@/hooks/useWorkflows", () => ({
  useWorkflows: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, any>) => {
      if (key === "workflows.stats.summary") {
        return `summary ${options?.active ?? 0}/${options?.paused ?? 0}`;
      }
      if (key === "workflows.table.header") {
        return "Workflow List";
      }
      return key;
    },
    i18n: { language: "en" },
  }),
}));

jest.mock("date-fns", () => ({
  formatDistanceToNow: () => "moments ago",
}));

jest.mock("@/components/ui/page-header", () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

jest.mock("@/components/ui/button", () => {
  const React = require("react");
  const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ children, ...props }, ref) => {
      const childArray = React.Children.toArray(children);
      const iconChild = childArray.find((child) =>
        React.isValidElement(child) && child.props["data-icon"]
      ) as React.ReactElement | undefined;
      const iconName = iconChild?.props?.["data-icon"]?.toLowerCase();
      const dataTestId = iconName ? `icon-button-${iconName}` : undefined;

      return (
        <button ref={ref} type="button" {...props} data-testid={dataTestId}>
          {children}
        </button>
      );
    }
  );
  Button.displayName = "Button";
  return { Button };
});

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <label>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        data-testid="workflow-switch"
      />
    </label>
  ),
}));

jest.mock("@/components/ui/kpi-card", () => ({
  KpiCard: ({
    title,
    value,
    description,
    progress,
    footer,
  }: {
    title: string;
    value: React.ReactNode;
    description?: React.ReactNode;
    progress?: { action?: React.ReactNode };
    footer?: React.ReactNode;
  }) => {
    const slug = title.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
    return (
      <div data-testid={`kpi-card-${slug}`}>
        <span>{title}</span>
        <span data-testid={`kpi-value-${slug}`}>{value}</span>
        {description && <div>{description}</div>}
        {progress?.action && (
          <div data-testid={`kpi-progress-${slug}`}>{progress.action}</div>
        )}
        {footer && <div data-testid={`kpi-footer-${slug}`}>{footer}</div>}
      </div>
    );
  },
}));

jest.mock("@/components/ui/kpi-presets", () => ({
  getKpiIconPreset: () => ({ iconClassName: "", iconWrapperClassName: "" }),
  KPI_ACTION_BUTTON_CLASS: "kpi-action",
}));

jest.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: ({
    options,
    value,
    onValueChange,
  }: {
    options: Array<{ value: string; label: string }>;
    value: string;
    onValueChange?: (value: string) => void;
  }) => (
    <div data-testid="segmented-control">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onValueChange?.(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/components/data-table", () => ({
  AdvancedDataTable: ({
    title,
    data,
    actions,
    searchValue,
    onSearchChange,
    onLoadMore,
    hasMore,
    rowActions,
    emptyState,
  }: any) => (
    <div data-testid="advanced-data-table">
      <h2>{title}</h2>
      <div data-testid="table-actions">{actions}</div>
      <input
        data-testid="table-search"
        value={searchValue}
        onChange={(event) => onSearchChange?.(event.target.value)}
      />
      <div>
        {data.length > 0 ? (
          data.map((row: any) => (
            <div data-testid={`workflow-row-${row.id}`} key={row.id}>
              <span>{row.name}</span>
              <div data-testid={`row-actions-${row.id}`}>
                {rowActions?.(row)}
              </div>
            </div>
          ))
        ) : (
          <div data-testid="empty-state">{emptyState}</div>
        )}
      </div>
      {onLoadMore && hasMore && (
        <button
          type="button"
          onClick={() => onLoadMore?.()}
          data-testid="load-more"
        >
          Load more
        </button>
      )}
    </div>
  ),
}));

jest.mock("@/components/CreateWorkflowSheet", () => ({
  CreateWorkflowSheet: ({
    children,
    editWorkflow,
  }: {
    children: React.ReactNode;
    editWorkflow?: { name?: string } | null;
  }) => (
    <div data-testid="create-workflow-sheet">
      <div data-testid="editing-workflow">
        {editWorkflow ? editWorkflow.name : "none"}
      </div>
      {children}
    </div>
  ),
}));

jest.mock("@/components/WorkflowDeleteDialog", () => ({
  WorkflowDeleteDialog: ({
    open,
    workflow,
    onConfirm,
    onCancel,
    isDeleting,
  }: {
    open: boolean;
    workflow?: { id: string; name: string } | null;
    onConfirm: () => void;
    onCancel: () => void;
    isDeleting: boolean;
  }) =>
    open ? (
      <div data-testid="workflow-delete-dialog">
        <p>{workflow?.name}</p>
        <button type="button" onClick={onConfirm} disabled={isDeleting}>
          Confirm Delete
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

jest.mock("@/components/ui/loading-presets", () => ({
  PageLoadingSkeleton: () => <div data-testid="loading-skeleton" />,
}));

jest.mock("lucide-react", () => {
  const React = require("react");
  const createIcon = (name: string) => (props: any) => (
    <svg data-icon={name.toLowerCase()} {...props} />
  );
  return {
    Plus: createIcon("Plus"),
    Zap: createIcon("Zap"),
    CheckCircle: createIcon("CheckCircle"),
    Clock: createIcon("Clock"),
    AlertTriangle: createIcon("AlertTriangle"),
    Edit: createIcon("Edit"),
    Trash2: createIcon("Trash2"),
    Mail: createIcon("Mail"),
    MessageCircle: createIcon("MessageCircle"),
    Phone: createIcon("Phone"),
  };
});

const mockUseWorkflows = useWorkflows as jest.Mock;

const setupMockReturn = (overrides: Partial<ReturnType<typeof useWorkflows>> = {}) => {
  const defaultWorkflows = [
    createWorkflow({ id: "workflow-1", name: "Active Workflow", is_active: true }),
    createWorkflow({ id: "workflow-2", name: "Paused Workflow", is_active: false }),
    createWorkflow({ id: "workflow-3", name: "Another Active", is_active: true }),
  ];

  const mockCreate = jest.fn();
  const mockUpdate = jest.fn();
  const mockDelete = jest.fn().mockResolvedValue(undefined);
  const mockToggle = jest.fn();

  mockUseWorkflows.mockReturnValue({
    workflows: defaultWorkflows,
    loading: false,
    createWorkflow: mockCreate,
    updateWorkflow: mockUpdate,
    deleteWorkflow: mockDelete,
    toggleWorkflowStatus: mockToggle,
    ...overrides,
  });

  return { mockCreate, mockUpdate, mockDelete, mockToggle, workflows: overrides.workflows ?? defaultWorkflows };
};

describe("Workflows page", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows stats and filters workflows by status", async () => {
    const { workflows } = setupMockReturn();

    render(<Workflows />);

    expect(screen.getByTestId("kpi-value-workflows-stats-totalworkflows")).toHaveTextContent(
      String(workflows.length)
    );
    expect(screen.getByTestId("kpi-value-workflows-stats-active")).toHaveTextContent("2");
    expect(screen.getByTestId("kpi-value-workflows-stats-paused")).toHaveTextContent("1");
    expect(screen.getByText("summary 2/1")).toBeInTheDocument();

    const activeFilterButton = screen.getByRole("button", {
      name: "workflows.stats.quickFilterActive",
    });
    fireEvent.click(activeFilterButton);

    await waitFor(() => {
      const rows = screen.getAllByTestId(/^workflow-row-/);
      expect(rows).toHaveLength(2);
      rows.forEach((row) => {
        expect(row).toHaveTextContent(/Active Workflow|Another Active/);
      });
    });

    const pausedTab = screen.getByRole("button", { name: "workflows.tabs.paused" });
    fireEvent.click(pausedTab);

    await waitFor(() => {
      const rows = screen.getAllByTestId(/^workflow-row-/);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveTextContent("Paused Workflow");
    });
  });

  it("loads more workflows when requesting additional pages", async () => {
    const workflows = Array.from({ length: 30 }, (_, index) =>
      createWorkflow({ id: `workflow-${index + 1}`, name: `Workflow ${index + 1}` })
    );

    setupMockReturn({ workflows });

    render(<Workflows />);

    expect(screen.getAllByTestId(/^workflow-row-/)).toHaveLength(25);

    fireEvent.click(screen.getByTestId("load-more"));

    await waitFor(() => {
      expect(screen.getAllByTestId(/^workflow-row-/)).toHaveLength(workflows.length);
    });
  });

  it("handles row actions for toggling, editing, and deleting workflows", async () => {
    const { mockToggle, mockDelete } = setupMockReturn();

    render(<Workflows />);

    const firstRow = screen.getByTestId("workflow-row-workflow-1");
    const toggle = within(firstRow).getByRole("checkbox");
    fireEvent.click(toggle);
    expect(mockToggle).toHaveBeenCalledWith("workflow-1", false);

    const rowButtons = within(firstRow).getAllByRole("button");
    const [editButton, deleteButton] = rowButtons;
    fireEvent.click(editButton);
    expect(screen.getByTestId("editing-workflow")).toHaveTextContent("Active Workflow");

    fireEvent.click(deleteButton);
    expect(screen.getByTestId("workflow-delete-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Confirm Delete"));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith("workflow-1");
      expect(screen.queryByTestId("workflow-delete-dialog")).not.toBeInTheDocument();
    });
  });
});
