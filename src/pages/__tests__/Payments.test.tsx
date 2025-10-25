import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import Payments from "../Payments";

const mockUsePaymentsFilters = jest.fn();
const mockUsePaymentsData = jest.fn();
const mockUsePaymentsTableColumns = jest.fn();
const mockUseThrottledRefetchOnFocus = jest.fn();
const mockPaymentsDateControls = jest.fn(({ onSelectedFilterChange }: any) => (
  <div data-testid="payments-date-controls">
    <button type="button" onClick={() => onSelectedFilterChange("last7days")}>change-filter</button>
  </div>
));
const mockPaymentsTrendChart = jest.fn(() => <div data-testid="payments-trend-chart" />);
const mockPaymentsMetricsSummary = jest.fn(() => <div data-testid="payments-metrics-summary" />);
const mockPaymentsTableSection = jest.fn((props: any) => (
  <div data-testid="payments-table-section">
    <div data-testid="table-actions">{props.actions}</div>
  </div>
));
const mockProjectSheetView = jest.fn(() => <div data-testid="project-sheet-view" />);

const mockToast = jest.fn();
const mockWriteFileXLSX = jest.fn();
const mockJsonToSheet = jest.fn(() => ({ sheet: true }));
const mockBookNew = jest.fn(() => ({ workbook: true }));
const mockBookAppendSheet = jest.fn();

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/components/GlobalSearch", () => ({
  __esModule: true,
  default: () => <div data-testid="global-search" />,
}));

jest.mock("@/components/ui/page-header", () => ({
  PageHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-header">{children}</div>
  ),
  PageHeaderSearch: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-header-search">{children}</div>
  ),
}));

jest.mock("@/components/ui/loading-presets", () => ({
  TableLoadingSkeleton: () => <div data-testid="payments-loading" />,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock("@/pages/payments/components/PaymentsDateControls", () => ({
  PaymentsDateControls: (props: any) => mockPaymentsDateControls(props),
}));

jest.mock("@/pages/payments/components/PaymentsTrendChart", () => ({
  PaymentsTrendChart: (props: any) => mockPaymentsTrendChart(props),
}));

jest.mock("@/pages/payments/components/PaymentsMetricsSummary", () => ({
  PaymentsMetricsSummary: (props: any) => mockPaymentsMetricsSummary(props),
}));

jest.mock("@/pages/payments/components/PaymentsTableSection", () => ({
  PaymentsTableSection: (props: any) => mockPaymentsTableSection(props),
}));

jest.mock("@/components/ProjectSheetView", () => ({
  ProjectSheetView: (props: any) => mockProjectSheetView(props),
}));

jest.mock("@/hooks/use-toast", () => ({
  toast: (...args: any[]) => mockToast(...args),
}));

jest.mock("@/hooks/useThrottledRefetchOnFocus", () => ({
  useThrottledRefetchOnFocus: (...args: any[]) => mockUseThrottledRefetchOnFocus(...args),
}));

jest.mock("@/pages/payments/hooks/usePaymentsFilters", () => ({
  usePaymentsFilters: (...args: any[]) => mockUsePaymentsFilters(...args),
}));

jest.mock("@/pages/payments/hooks/usePaymentsData", () => ({
  usePaymentsData: (...args: any[]) => mockUsePaymentsData(...args),
}));

jest.mock("@/pages/payments/hooks/usePaymentsTableColumns", () => ({
  usePaymentsTableColumns: (...args: any[]) => mockUsePaymentsTableColumns(...args),
}));

jest.mock("xlsx/xlsx.mjs", () => ({
  writeFileXLSX: (...args: any[]) => mockWriteFileXLSX(...args),
  utils: {
    json_to_sheet: (...args: any[]) => mockJsonToSheet(...args),
    book_new: (...args: any[]) => mockBookNew(...args),
    book_append_sheet: (...args: any[]) => mockBookAppendSheet(...args),
  },
}));

describe("Payments page", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUsePaymentsFilters.mockReturnValue({
      state: { status: [], type: [], amountMin: null, amountMax: null, search: "" },
      filtersConfig: { groups: [] },
      searchValue: "",
      onSearchChange: jest.fn(),
      onSearchClear: jest.fn(),
      activeFilterCount: 0,
    });

    mockUsePaymentsTableColumns.mockReturnValue([
      { id: "date_paid", label: "Date" },
      { id: "amount", label: "Amount" },
    ]);

    mockUsePaymentsData.mockReturnValue({
      paginatedPayments: [],
      metricsPayments: [],
      totalCount: 0,
      initialLoading: true,
      tableLoading: false,
      fetchPayments: jest.fn(),
      fetchPaymentsData: jest.fn().mockResolvedValue({ payments: [], count: 0, metricsData: [] }),
    });
  });

  it("shows a loading skeleton on initial load", () => {
    render(<Payments />);

    expect(screen.getByTestId("payments-loading")).toBeInTheDocument();
    expect(mockUseThrottledRefetchOnFocus).toHaveBeenCalled();
  });

  it("renders table section and executes export flow", async () => {
    const paymentRow = {
      id: "payment-1",
      date_paid: "2024-05-10T00:00:00.000Z",
      created_at: "2024-05-09T00:00:00.000Z",
      amount: 1500,
      description: "Milestone",
      status: "paid",
      type: "base_price",
      project_id: "project-1",
      projects: {
        id: "project-1",
        name: "Project Alpha",
        leads: { id: "lead-1", name: "Jane" },
      },
    };

    const fetchPaymentsData = jest.fn().mockResolvedValue({
      payments: [paymentRow],
      count: 1,
      metricsData: [],
    });

    mockUsePaymentsData.mockReturnValue({
      paginatedPayments: [paymentRow],
      metricsPayments: [paymentRow],
      totalCount: 1,
      initialLoading: false,
      tableLoading: false,
      fetchPayments: jest.fn(),
      fetchPaymentsData,
    });

    render(<Payments />);

    expect(screen.queryByTestId("payments-loading")).not.toBeInTheDocument();
    expect(mockPaymentsTableSection).toHaveBeenCalled();

    const tableProps = mockPaymentsTableSection.mock.calls[0][0];
    expect(tableProps.data).toHaveLength(1);
    expect(tableProps.searchPlaceholder).toBe("payments.searchPlaceholder");

    const exportButton = screen.getByRole("button", { name: "payments.export.button" });

    await act(async () => {
      fireEvent.click(exportButton);
      await waitFor(() => expect(fetchPaymentsData).toHaveBeenCalled());
    });

    expect(mockJsonToSheet).toHaveBeenCalled();
    expect(mockBookNew).toHaveBeenCalled();
    expect(mockBookAppendSheet).toHaveBeenCalled();
    expect(mockWriteFileXLSX).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "payments.export.successTitle",
        description: "payments.export.successDescription",
      })
    );
  });
});
