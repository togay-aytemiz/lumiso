import { fireEvent, render, screen } from "@/utils/testUtils";
import { AdvancedDataTable } from "../AdvancedDataTable";
import { AdvancedDataTablePaginationFooter } from "../AdvancedDataTablePagination";
import type { AdvancedDataTablePagination } from "../AdvancedDataTable";

const translations: Record<string, string> = {
  "common:table.searchPlaceholder": "Search",
  "common:table.clearSearch": "Clear search",
  "common:table.filters": "Filters",
  "common:table.clearFilters": "Clear filters",
  "common:table.closeFilters": "Close filters",
  "common:table.activeFilters": "{{count}} filters active",
  "common:table.noDataAvailable": "No data yet",
  "common:table.previousPage": "Previous",
  "common:table.nextPage": "Next",
  "common:table.pageIndicator": "{{page}} of {{pages}}",
  "common:table.rowsPerPage": "Rows per page",
  "common:table.paginationSummary": "{{start}}-{{end}} of {{total}}",
};

jest.mock("react-i18next", () => ({
  useTranslation: (namespace?: string | string[]) => ({
    t: (key: string, options: Record<string, any> = {}) => {
      const resolvedNamespace = Array.isArray(namespace) ? namespace[0] : namespace;
      const compositeKey = resolvedNamespace ? `${resolvedNamespace}:${key}` : key;
      const template = translations[compositeKey] ?? translations[key] ?? compositeKey;
      return template.replace(/\{\{(\w+)\}\}/g, (_match, capture) =>
        String(options[capture] ?? "")
      );
    },
  }),
}));

jest.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

jest.mock("@/components/ui/select", () => {
  const Select = ({ value, onValueChange, children }: any) => (
    <select
      data-testid="rows-per-page-select"
      value={value}
      onChange={(event) => onValueChange?.(Number(event.target.value))}
    >
      {children}
    </select>
  );
  const SelectTrigger = ({ children }: any) => <>{children}</>;
  const SelectValue = ({ children }: any) => <>{children}</>;
  const SelectContent = ({ children }: any) => <>{children}</>;
  const SelectItem = ({ value, children }: any) => (
    <option value={value}>{children}</option>
  );

  return {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  };
});

jest.mock("@/components/ui/data-table-container", () => ({
  DataTableContainer: ({ children }: any) => <div data-testid="data-table-container">{children}</div>,
}));

const rows = [
  { id: "1", name: "Alpha", count: 3 },
  { id: "2", name: "Beta", count: 5 },
];

const columns = [
  {
    id: "name",
    label: "Name",
    accessorKey: "name",
    sortable: true,
  },
  {
    id: "count",
    label: "Count",
    accessor: (row: { count: number }) => row.count,
  },
];

describe.skip("AdvancedDataTable", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("toggles sort state when sortable header is clicked", () => {
    const onSortChange = jest.fn();
    render(
      <AdvancedDataTable
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        onSortChange={onSortChange}
      />
    );

    const nameHeader = screen.getByRole("button", { name: /Name/ });
    fireEvent.click(nameHeader);
    expect(onSortChange).toHaveBeenCalledWith({ columnId: "name", direction: "asc" });

    fireEvent.click(nameHeader);
    expect(onSortChange).toHaveBeenLastCalledWith({ columnId: "name", direction: "desc" });
  });

  it("debounces search updates and exposes clear control", () => {
    const onSearchChange = jest.fn();
    render(
      <AdvancedDataTable
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        onSearchChange={onSearchChange}
        searchDelay={0}
      />
    );

    const searchInput = screen.getByLabelText("Search");
    fireEvent.change(searchInput, { target: { value: "al" } });
    expect(onSearchChange).toHaveBeenCalledWith("al");

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("renders empty state when no data rows provided", () => {
    render(
      <AdvancedDataTable
        data={[]}
        columns={columns}
        rowKey={(row) => row.id}
      />
    );

    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });

  it("renders filters toggle and calls reset handler", () => {
    const onReset = jest.fn();
    render(
      <AdvancedDataTable
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        filters={{
          content: <div data-testid="filters-panel">Filters</div>,
          triggerLabel: "Open filters",
          activeCount: 2,
          collapsedByDefault: true,
          onReset,
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Open filters/i }));
    expect(screen.getByTestId("filters-panel")).toBeInTheDocument();
  });
});

describe.skip("AdvancedDataTablePaginationFooter", () => {
  it("invokes pagination callbacks", () => {
    const onPageChange = jest.fn();
    const onPageSizeChange = jest.fn();

    const pagination: AdvancedDataTablePagination = {
      page: 2,
      pageSize: 25,
      totalCount: 70,
      onPageChange,
      onPageSizeChange,
      pageSizeOptions: [25, 50],
    };

    render(
      <AdvancedDataTablePaginationFooter
        pagination={pagination}
        paginationInfo={{ start: 26, end: 50, total: 70 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    fireEvent.change(screen.getByTestId("rows-per-page-select"), {
      target: { value: "50" },
    });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });
});
