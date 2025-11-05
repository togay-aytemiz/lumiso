import React from "react";
import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import Payments from "../Payments";
import type { PaymentsDateControls as PaymentsDateControlsComponent } from "@/pages/payments/components/PaymentsDateControls";
import type { PaymentsTrendChart as PaymentsTrendChartComponent } from "@/pages/payments/components/PaymentsTrendChart";
import type { PaymentsMetricsSummary as PaymentsMetricsSummaryComponent } from "@/pages/payments/components/PaymentsMetricsSummary";
import type { PaymentsTableSection as PaymentsTableSectionComponent } from "@/pages/payments/components/PaymentsTableSection";
import type { ProjectSheetView as ProjectSheetViewComponent } from "@/components/ProjectSheetView";
import type { Payment } from "@/pages/payments/types";
import type {
  AdvancedDataTableFiltersConfig,
  AdvancedTableColumn,
} from "@/components/data-table";
import type { usePaymentsFilters as usePaymentsFiltersFn } from "@/pages/payments/hooks/usePaymentsFilters";
import type { usePaymentsData as usePaymentsDataFn } from "@/pages/payments/hooks/usePaymentsData";
import type { usePaymentsTableColumns as usePaymentsTableColumnsFn } from "@/pages/payments/hooks/usePaymentsTableColumns";
import type { useThrottledRefetchOnFocus as useThrottledRefetchOnFocusFn } from "@/hooks/useThrottledRefetchOnFocus";

type PaymentsDateControlsProps = ComponentProps<typeof PaymentsDateControlsComponent>;
type PaymentsTrendChartProps = ComponentProps<typeof PaymentsTrendChartComponent>;
type PaymentsMetricsSummaryProps = ComponentProps<typeof PaymentsMetricsSummaryComponent>;
type PaymentsTableSectionProps = ComponentProps<typeof PaymentsTableSectionComponent>;
type ProjectSheetViewProps = ComponentProps<typeof ProjectSheetViewComponent>;

type UsePaymentsFiltersArgs = Parameters<typeof usePaymentsFiltersFn>;
type UsePaymentsFiltersReturn = ReturnType<typeof usePaymentsFiltersFn>;

type UsePaymentsDataArgs = Parameters<typeof usePaymentsDataFn>;
type UsePaymentsDataReturn = ReturnType<typeof usePaymentsDataFn>;

type UsePaymentsTableColumnsArgs = Parameters<typeof usePaymentsTableColumnsFn>;
type UsePaymentsTableColumnsReturn = ReturnType<typeof usePaymentsTableColumnsFn>;

type UseThrottledRefetchOnFocusArgs = Parameters<typeof useThrottledRefetchOnFocusFn>;

const mockUsePaymentsFilters = jest.fn<UsePaymentsFiltersReturn, UsePaymentsFiltersArgs>();
const mockUsePaymentsData = jest.fn<UsePaymentsDataReturn, UsePaymentsDataArgs>();
const mockUsePaymentsTableColumns = jest.fn<UsePaymentsTableColumnsReturn, UsePaymentsTableColumnsArgs>();
const mockUseThrottledRefetchOnFocus = jest.fn<void, UseThrottledRefetchOnFocusArgs>();

const mockPaymentsDateControls = jest.fn(
  (props: PaymentsDateControlsProps) => (
    <div data-testid="payments-date-controls">
      <button
        type="button"
        onClick={() => props.onSelectedFilterChange("last7days")}
      >
        change-filter
      </button>
    </div>
  )
);

const mockPaymentsTrendChart = jest.fn(
  (_props: PaymentsTrendChartProps) => <div data-testid="payments-trend-chart" />
);

const mockPaymentsMetricsSummary = jest.fn(
  (_props: PaymentsMetricsSummaryProps) => <div data-testid="payments-metrics-summary" />
);

const mockPaymentsTableSection = jest.fn(
  (props: PaymentsTableSectionProps) => (
    <div data-testid="payments-table-section">
      <div data-testid="table-actions">{props.actions}</div>
    </div>
  )
);

const mockProjectSheetView = jest.fn(
  (_props: ProjectSheetViewProps) => <div data-testid="project-sheet-view" />
);

const mockToast = jest.fn<void, unknown[]>();
const mockWriteFileXLSX = jest.fn<void, unknown[]>();
const mockJsonToSheet = jest.fn<Record<string, unknown>, [unknown]>(() => ({ sheet: true }));
const mockBookNew = jest.fn<Record<string, unknown>, []>(() => ({ workbook: true }));
const mockBookAppendSheet = jest.fn<void, [unknown, unknown, string]>();

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
  PaymentsDateControls: (props: PaymentsDateControlsProps) => mockPaymentsDateControls(props),
}));

jest.mock("@/pages/payments/components/PaymentsTrendChart", () => ({
  PaymentsTrendChart: (props: PaymentsTrendChartProps) => mockPaymentsTrendChart(props),
}));

jest.mock("@/pages/payments/components/PaymentsMetricsSummary", () => ({
  PaymentsMetricsSummary: (props: PaymentsMetricsSummaryProps) => mockPaymentsMetricsSummary(props),
}));

jest.mock("@/pages/payments/components/PaymentsTableSection", () => ({
  PaymentsTableSection: (props: PaymentsTableSectionProps) => mockPaymentsTableSection(props),
}));

jest.mock("@/components/ProjectSheetView", () => ({
  ProjectSheetView: (props: ProjectSheetViewProps) => mockProjectSheetView(props),
}));

jest.mock("@/hooks/use-toast", () => ({
  toast: (...args: Parameters<typeof mockToast>) => mockToast(...args),
}));

jest.mock("@/hooks/useThrottledRefetchOnFocus", () => ({
  useThrottledRefetchOnFocus: (
    ...args: Parameters<typeof mockUseThrottledRefetchOnFocus>
  ) => mockUseThrottledRefetchOnFocus(...args),
}));

jest.mock("@/pages/payments/hooks/usePaymentsFilters", () => ({
  usePaymentsFilters: (...args: Parameters<typeof mockUsePaymentsFilters>) =>
    mockUsePaymentsFilters(...args),
}));

jest.mock("@/pages/payments/hooks/usePaymentsData", () => ({
  usePaymentsData: (...args: Parameters<typeof mockUsePaymentsData>) =>
    mockUsePaymentsData(...args),
}));

jest.mock("@/pages/payments/hooks/usePaymentsTableColumns", () => ({
  usePaymentsTableColumns: (...args: Parameters<typeof mockUsePaymentsTableColumns>) =>
    mockUsePaymentsTableColumns(...args),
}));

jest.mock("xlsx/xlsx.mjs", () => ({
  writeFileXLSX: (...args: Parameters<typeof mockWriteFileXLSX>) =>
    mockWriteFileXLSX(...args),
  utils: {
    json_to_sheet: (...args: Parameters<typeof mockJsonToSheet>) =>
      mockJsonToSheet(...args),
    book_new: (...args: Parameters<typeof mockBookNew>) => mockBookNew(...args),
    book_append_sheet: (...args: Parameters<typeof mockBookAppendSheet>) =>
      mockBookAppendSheet(...args),
  },
}));

describe("Payments page", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUsePaymentsFilters.mockReturnValue({
      state: { status: [], type: [], amountMin: null, amountMax: null, search: "" },
      filtersConfig: { content: null } satisfies AdvancedDataTableFiltersConfig,
      searchValue: "",
      onSearchChange: jest.fn<void, [string]>(),
      onSearchClear: jest.fn<void, []>(),
      activeFilterCount: 0,
    });

    mockUsePaymentsTableColumns.mockReturnValue([
      {
        id: "date_paid",
        label: "Date",
        render: () => null,
      } satisfies AdvancedTableColumn<Payment>,
      {
        id: "amount",
        label: "Amount",
        render: () => null,
      } satisfies AdvancedTableColumn<Payment>,
    ]);

    const fetchPayments = jest.fn<
      ReturnType<UsePaymentsDataReturn["fetchPayments"]>,
      Parameters<UsePaymentsDataReturn["fetchPayments"]>
    >().mockResolvedValue(undefined);

    const fetchPaymentsData = jest.fn<
      ReturnType<UsePaymentsDataReturn["fetchPaymentsData"]>,
      Parameters<UsePaymentsDataReturn["fetchPaymentsData"]>
    >().mockResolvedValue({
      payments: [],
      count: 0,
      metricsData: [],
    });

    mockUsePaymentsData.mockReturnValue({
      paginatedPayments: [],
      metricsPayments: [],
      totalCount: 0,
      initialLoading: true,
      tableLoading: false,
      fetchPayments,
      fetchPaymentsData,
    });
  });

  it("shows a loading skeleton on initial load", () => {
    render(<Payments />);

    expect(screen.getByTestId("payments-loading")).toBeInTheDocument();
    expect(mockUseThrottledRefetchOnFocus).toHaveBeenCalled();
  });

  it("renders table section and executes export flow", async () => {
    const paymentRow: Payment = {
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
        base_price: 1500,
        lead_id: "lead-1",
        leads: { id: "lead-1", name: "Jane" },
      },
    };

    const fetchPaymentsData = jest.fn<
      ReturnType<UsePaymentsDataReturn["fetchPaymentsData"]>,
      Parameters<UsePaymentsDataReturn["fetchPaymentsData"]>
    >().mockResolvedValue({
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
      fetchPayments: jest.fn<
        ReturnType<UsePaymentsDataReturn["fetchPayments"]>,
        Parameters<UsePaymentsDataReturn["fetchPayments"]>
      >().mockResolvedValue(undefined),
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
