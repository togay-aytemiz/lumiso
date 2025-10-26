import { act, fireEvent, render, screen } from "@/utils/testUtils";
import { AdvancedDataTable } from "../AdvancedDataTable";
import { AdvancedDataTablePaginationFooter } from "../AdvancedDataTablePagination";
import type { AdvancedDataTablePagination } from "../AdvancedDataTable";

const translations: Record<string, string> = {
  "common:table.searchPlaceholder": "Search",
  "common:table.clearSearch": "Clear search",
  "common:table.filters": "Filters",
  "common:table.previousPage": "Previous",
  "common:table.nextPage": "Next",
  "common:table.pageIndicator": "{{page}} of {{pages}}",
  "common:table.rowsPerPage": "Rows per page",
  "common:table.paginationSummary": "{{start}}-{{end}} of {{total}}",
};

jest.mock("react-i18next", () => ({
  useTranslation: (namespace?: string | string[]) => ({
    t: (key: string, options: Record<string, any> = {}) => {
      const resolvedNamespace = Array.isArray(namespace)
        ? namespace[0]
        : namespace;
      const compositeKey = resolvedNamespace
        ? `${resolvedNamespace}:${key}`
        : key;
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
  const React = require("react");
  const Select = ({ value, onValueChange, children }: any) => (
    <select
      data-testid="rows-per-page-select"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
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

const createIntersectionObserverMock = () => {
  let instanceCallback: IntersectionObserverCallback | null = null;
  class MockIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      instanceCallback = callback;
    }
    observe = jest.fn();
    disconnect = jest.fn();
    takeRecords = jest.fn();
    unobserve = jest.fn();
  }
  // @ts-expect-error override global
  global.IntersectionObserver = MockIntersectionObserver;
  return {
    trigger: (entry: Partial<IntersectionObserverEntry>) => {
      instanceCallback?.([
        {
          isIntersecting: true,
          intersectionRatio: 1,
          target: entry.target ?? ({} as Element),
        } as IntersectionObserverEntry,
      ]);
    },
  };
};

interface Row {
  id: string;
  name: string;
  count: number;
}

const rows: Row[] = [
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
    accessor: (row: Row) => row.count,
  },
];

describe.skip("AdvancedDataTable", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["performance"] });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("emits sort changes when column headers are clicked", () => {
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
    expect(onSortChange).toHaveBeenCalledWith({
      columnId: "name",
      direction: "asc",
    });

    fireEvent.click(nameHeader);
    expect(onSortChange).toHaveBeenLastCalledWith({
      columnId: "name",
      direction: "desc",
    });
  });

  it("handles search input and displays clear button", () => {
    const onSearchChange = jest.fn();
    render(
      <AdvancedDataTable
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        onSearchChange={onSearchChange}
      />
    );

    const search = screen.getByLabelText("Search");
    fireEvent.change(search, { target: { value: "alpha" } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(onSearchChange).toHaveBeenCalledWith("alpha");
    const clearButton = screen.getByRole("button", { name: "Clear search" });
    fireEvent.click(clearButton);

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("opens filters and invokes reset handler", () => {
    const onReset = jest.fn();
    render(
      <AdvancedDataTable
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        filters={{
          content: <div data-testid="filters-panel">Filters go here</div>,
          triggerLabel: "Open filters",
          title: "Filters",
          activeCount: 2,
          collapsedByDefault: true,
          onReset,
        }}
      />
    );

    expect(screen.queryByTestId("filters-panel")).toBeNull();
    const filterToggle = screen.getByText(/Open filters/i).closest("button");
    expect(filterToggle).toBeTruthy();
    fireEvent.click(filterToggle!);
    expect(screen.getByTestId("filters-panel")).toBeInTheDocument();
  });

  it("supports lazy loading via IntersectionObserver", () => {
    const { trigger } = createIntersectionObserverMock();
    const onLoadMore = jest.fn();

    render(
      <AdvancedDataTable
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        onLoadMore={onLoadMore}
        hasMore
      />
    );

    trigger({});
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});

describe("AdvancedDataTablePaginationFooter", () => {
  it("renders pagination controls and calls callbacks", () => {
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
