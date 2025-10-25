import { render } from "@/utils/testUtils";
import { PaymentsTableSection } from "../PaymentsTableSection";
import type { AdvancedDataTableSortState } from "@/components/data-table";

jest.mock("@/components/data-table", () => {
  const AdvancedDataTable = jest.fn(() => <div data-testid="advanced-data-table" />);
  return { AdvancedDataTable };
});

describe("PaymentsTableSection", () => {
  const tableModule = jest.requireMock("@/components/data-table") as {
    AdvancedDataTable: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("forwards props to AdvancedDataTable", () => {
    const handleSortChange = jest.fn();
    const handleRowClick = jest.fn();

    render(
      <PaymentsTableSection
        title="Payments"
        data={[{ id: "payment-1" } as any]}
        columns={[{ id: "amount", label: "Amount" } as any]}
        filters={{ groups: [] }}
        toolbar={<div>Toolbar</div>}
        actions={<button type="button">Export</button>}
        summary={{ text: "Summary", chips: [{ id: "status", label: "Paid" }] }}
        sortState={{ columnId: "date_paid", direction: "desc" }}
        onSortChange={handleSortChange}
        emptyState={<div>No data</div>}
        onRowClick={handleRowClick}
        isLoading
        searchValue="query"
        onSearchChange={jest.fn()}
        searchPlaceholder="Search"
        searchLoading={false}
        searchMinChars={2}
        onLoadMore={jest.fn()}
        hasMore
        isLoadingMore
      />
    );

    expect(tableModule.AdvancedDataTable).toHaveBeenCalledTimes(1);
    const tableProps = tableModule.AdvancedDataTable.mock.calls[0][0];
    expect(tableProps.title).toBe("Payments");
    expect(tableProps.data).toHaveLength(1);
    expect(tableProps.columns[0].id).toBe("amount");
    expect(tableProps.summary.chips).toHaveLength(1);
    expect(tableProps.isLoading).toBe(true);

    const sortState: AdvancedDataTableSortState = { columnId: "amount", direction: "asc" };
    tableProps.onSortChange(sortState);
    expect(handleSortChange).toHaveBeenCalledWith(sortState);

    tableProps.onRowClick?.({ id: "payment-1" });
    expect(handleRowClick).toHaveBeenCalledWith({ id: "payment-1" });
  });
});
