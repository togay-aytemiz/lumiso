import { render } from "@/utils/testUtils";
import { PaymentsTableSection } from "../PaymentsTableSection";
import type { AdvancedDataTableSortState, AdvancedTableColumn } from "@/components/data-table";
import type { Payment } from "../../types";

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

    const payment: Payment = {
      id: "payment-1",
      amount: 150,
      date_paid: null,
      status: "paid",
      description: null,
      type: "base_price",
      project_id: "project-1",
      created_at: "2024-01-01T00:00:00Z",
      projects: null,
    };

    const columns: AdvancedTableColumn<Payment>[] = [
      { id: "amount", label: "Amount", accessor: (row) => row.amount },
    ];

    render(
      <PaymentsTableSection
        title="Payments"
        data={[payment]}
        columns={columns}
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
