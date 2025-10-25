import React from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import Templates from "../Templates";
import { useTemplateOperations } from "@/hooks/useTemplateOperations";
import { Template } from "@/types/template";

jest.mock("@/components/template-builder/TemplateErrorBoundary", () => ({
  TemplateErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="template-error-boundary">{children}</div>
  ),
}));

jest.mock("@/components/template-builder/DeleteTemplateDialog", () => ({
  DeleteTemplateDialog: ({
    open,
    onClose,
    onConfirm,
    templateName,
    loading,
  }: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void> | void;
    templateName: string;
    loading?: boolean;
  }) =>
    open ? (
      <div data-testid="delete-template-dialog">
        <span>{templateName}</span>
        {loading && <span data-testid="delete-loading">loading</span>}
        <button type="button" onClick={onConfirm}>
          confirm delete
        </button>
        <button type="button" onClick={onClose}>
          cancel
        </button>
      </div>
    ) : null,
}));

jest.mock("@/components/ui/page-header", () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header data-testid="page-header">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  ),
}));

jest.mock("@/components/ui/button", () => {
  const React = require("react");
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

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
}));

jest.mock("@/components/data-table", () => ({
  AdvancedDataTable: ({
    data,
    columns,
    actions,
    searchValue,
    onSearchChange,
    emptyState,
    onRowClick,
    rowActions,
    onLoadMore,
    hasMore,
  }: any) => (
    <div data-testid="advanced-data-table">
      <div data-testid="table-actions">{actions}</div>
      <input
        data-testid="table-search"
        value={searchValue ?? ""}
        onChange={(event) => onSearchChange?.(event.target.value)}
      />
      {data.length ? (
        data.map((row: any) => (
          <div
            key={row.id}
            data-testid={`template-row-${row.id}`}
            onClick={() => onRowClick?.(row)}
          >
            {columns?.map((column: any) => (
              <div key={column.id} data-testid={`template-${row.id}-${column.id}`}>
                {column.render?.(row)}
              </div>
            ))}
            <div data-testid={`template-actions-${row.id}`}>
              {rowActions?.(row)}
            </div>
          </div>
        ))
      ) : (
        <div data-testid="empty-state">{emptyState}</div>
      )}
      {onLoadMore && hasMore && (
        <button data-testid="load-more" type="button" onClick={() => onLoadMore?.()}>
          Load more
        </button>
      )}
    </div>
  ),
}));

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock("date-fns", () => ({
  formatDistanceToNow: () => "3 days ago",
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        "templates.title": "Message Templates",
        "templates.subtitle": "Design and manage reusable email templates",
        "templates.table.title": "Templates Table",
        "templates.table.templateName": "Template Name",
        "templates.table.preview": "Preview",
        "templates.table.status": "Status",
        "templates.table.lastUpdated": "Last Updated",
        "templates.status.published": "Published",
        "templates.status.draft": "Draft",
        "templates.buttons.newTemplate": "New Template",
        "templates.buttons.createFirstTemplate": "Create Your First Template",
        "templates.buttons.edit": "Edit",
        "templates.buttons.duplicate": "Duplicate template",
        "templates.buttons.delete": "Delete template",
        "templates.search": "Search templates...",
        "templates.emptyState.noTemplatesFound": "No templates found",
        "templates.emptyState.noTemplatesYet": "No templates created yet",
        "templates.emptyState.adjustSearch": "Try adjusting your search terms to find what you're looking for.",
        "templates.emptyState.createFirstMessage": "Create your first email template to get started with automated communications.",
        "templates.error.loadingTemplates": "Error Loading Templates",
        "templates.preview.noPreview": "No preview available translation",
      };

      if (key === "templates.table.title" && options && "defaultValue" in options) {
        return map[key] ?? String(options.defaultValue);
      }

      return map[key] ?? key;
    },
    i18n: { language: "en" },
  }),
}));

jest.mock("@/hooks/useTemplateOperations");

const mockUseTemplateOperations = useTemplateOperations as jest.Mock<TemplateOperationsMock, []>;

const baseTemplate: Template = {
  id: "template-1",
  name: "Welcome Email",
  category: "email",
  master_content: "",
  master_subject: "",
  placeholders: [],
  is_active: true,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-02T00:00:00.000Z",
  user_id: "user-1",
  organization_id: "org-1",
  channels: {},
};

type TemplateOperationsMock = {
  templates: Template[];
  filteredTemplates: Template[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  setSearchTerm: jest.Mock<void, [string]>;
  refreshTemplates: jest.Mock<Promise<void>, []>;
  deleteTemplate: jest.Mock<Promise<boolean>, [string]>;
  duplicateTemplate: jest.Mock<Promise<boolean>, [Template]>;
};

const createOperations = (overrides: Partial<TemplateOperationsMock> = {}): TemplateOperationsMock => ({
  templates: [baseTemplate],
  filteredTemplates: [baseTemplate],
  loading: false,
  error: null,
  searchTerm: "",
  setSearchTerm: jest.fn<void, [string]>(),
  refreshTemplates: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  deleteTemplate: jest.fn<Promise<boolean>, [string]>().mockResolvedValue(true),
  duplicateTemplate: jest.fn<Promise<boolean>, [Template]>().mockResolvedValue(true),
  ...overrides,
});

const setupMockOperations = (overrides: Partial<TemplateOperationsMock> = {}) => {
  const value = createOperations(overrides);
  mockUseTemplateOperations.mockReturnValue(value);
  return value;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTemplateOperations.mockReset();
  mockNavigate.mockReset();
});

const renderTemplates = () => render(<Templates />);

describe("Templates page", () => {
  it("renders template rows with translated preview fallback", () => {
    setupMockOperations();

    renderTemplates();

    expect(screen.getByText("Message Templates")).toBeInTheDocument();
    expect(screen.getByText("No preview available translation")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("navigates to builder when clicking new template action or row", () => {
    setupMockOperations({
      filteredTemplates: [
        {
          ...baseTemplate,
          channels: {
            email: { subject: "Preview subject" },
          },
        },
      ],
    });

    renderTemplates();

    fireEvent.click(screen.getByRole("button", { name: "New Template" }));
    expect(mockNavigate).toHaveBeenCalledWith("/template-builder");

    fireEvent.click(screen.getByTestId("template-row-template-1"));
    expect(mockNavigate).toHaveBeenCalledWith("/template-builder?id=template-1");
  });

  it("shows empty state with create action when there are no templates and no search", () => {
    setupMockOperations({
      filteredTemplates: [],
      templates: [],
      searchTerm: "",
    });

    renderTemplates();

    expect(screen.getByText("No templates created yet")).toBeInTheDocument();
    expect(screen.getByText("Create your first email template to get started with automated communications.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Your First Template" })).toBeInTheDocument();
  });

  it("shows search empty state when a search term yields no results", () => {
    const setSearchTerm = jest.fn<void, [string]>();
    setupMockOperations({
      filteredTemplates: [],
      templates: [],
      searchTerm: "welcome",
      setSearchTerm,
    });

    renderTemplates();

    expect(screen.getByText("No templates found")).toBeInTheDocument();
    expect(
      screen.getByText("Try adjusting your search terms to find what you're looking for.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Your First Template" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("table-search"), { target: { value: "follow up" } });
    expect(setSearchTerm).toHaveBeenCalledWith("follow up");
  });

  it("duplicates and deletes templates via row actions", async () => {
    const deleteTemplate = jest.fn<Promise<boolean>, [string]>().mockResolvedValue(true);
    const duplicateTemplate = jest.fn<Promise<boolean>, [Template]>().mockResolvedValue(true);
    setupMockOperations({ deleteTemplate, duplicateTemplate });

    renderTemplates();

    fireEvent.click(screen.getByTitle("Duplicate template"));
    expect(duplicateTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: "template-1" }));

    fireEvent.click(screen.getByTitle("Delete template"));
    expect(screen.getByTestId("delete-template-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByText("confirm delete"));

    await waitFor(() => {
      expect(deleteTemplate).toHaveBeenCalledWith("template-1");
    });

    await waitFor(() => {
      expect(screen.queryByTestId("delete-template-dialog")).not.toBeInTheDocument();
    });
  });
});
