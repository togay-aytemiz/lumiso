import React from "react";
import { render, screen } from "@/utils/testUtils";
import { PaymentsTrendChart } from "../PaymentsTrendChart";

type SegmentedProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: React.ReactNode }[];
};

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/components/ui/segmented-control", () => {
  const SegmentedControl = jest.fn(
    ({ value, onValueChange, options }: SegmentedProps) => (
      <div data-testid="segmented-control" data-value={value}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            data-testid={`segmented-${option.value}`}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    )
  );
  return { SegmentedControl };
});

jest.mock("@/components/ui/chart", () => {
  const ChartContainer = jest.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart-container">{children}</div>
  ));
  const ChartTooltipContent = jest.fn(
    ({ formatter }: { formatter: (value: number, name: string) => React.ReactNode }) => (
      <div data-testid="chart-tooltip-content" data-has-formatter={typeof formatter === "function"} />
    )
  );
  const ChartTooltip = ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) => (
    <div data-testid="chart-tooltip">
      {content}
      {children}
    </div>
  );
  return { ChartContainer, ChartTooltip, ChartTooltipContent };
});

jest.mock("recharts", () => ({
  LineChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="line-chart" data-point-count={data.length}>
      {children}
    </div>
  ),
  Line: ({ dataKey }: { dataKey: string }) => (
    <div data-testid={`line-${dataKey}`} />
  ),
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
}));

describe("PaymentsTrendChart", () => {
  const segmentedModule = jest.requireMock("@/components/ui/segmented-control") as {
    SegmentedControl: jest.Mock;
  };
  const chartModule = jest.requireMock("@/components/ui/chart") as {
    ChartContainer: jest.Mock;
    ChartTooltipContent: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders chart elements when data is available", () => {
    const formatCurrency = jest.fn((value: number) => `TRY ${value.toFixed(2)}`);

    render(
      <PaymentsTrendChart
        hasTrendData
        chartConfig={{
          paid: { label: "payments.chart.legend.paid", color: "#00ff00" },
          due: { label: "payments.chart.legend.due", color: "#ff0000" },
          refund: { label: "payments.chart.legend.refund", color: "#0000ff" },
        }}
        chartLegendLabels={{ paid: "Paid label", due: "Due label", refund: "Refund label" }}
        paymentsTrend={[
          { period: "2024-05-01", paid: 1200, due: 300, refund: 200 },
          { period: "2024-05-02", paid: 800, due: 450, refund: 0 },
        ]}
        trendGrouping="day"
        onTrendGroupingChange={jest.fn()}
        rangeLabel="Jan 1 – Jan 31"
        compactCurrencyFormatter={new Intl.NumberFormat("en-US", { notation: "compact" })}
        formatCurrency={formatCurrency}
      />
    );

    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toHaveAttribute("data-point-count", "2");
    expect(screen.getByTestId("line-refund")).toBeInTheDocument();

    const tooltipCall = chartModule.ChartTooltipContent.mock.calls[0]?.[0];
    expect(typeof tooltipCall?.formatter).toBe("function");

    const { formatter } = tooltipCall!;
    const { getByText } = render(<>{formatter(1500, "paid")}</>);
    expect(getByText("Paid label")).toBeInTheDocument();
    expect(getByText("TRY 1500.00")).toBeInTheDocument();
  });

  it("invokes grouping change when segmented control option is used", () => {
    const handleGroupingChange = jest.fn();

    render(
      <PaymentsTrendChart
        hasTrendData
        chartConfig={{
          paid: { label: "payments.chart.legend.paid", color: "#00ff00" },
          due: { label: "payments.chart.legend.due", color: "#ff0000" },
          refund: { label: "payments.chart.legend.refund", color: "#0000ff" },
        }}
        chartLegendLabels={{ paid: "Paid", due: "Due", refund: "Refund" }}
        paymentsTrend={[]}
        trendGrouping="day"
        onTrendGroupingChange={handleGroupingChange}
        rangeLabel=""
        compactCurrencyFormatter={new Intl.NumberFormat("en-US")}
        formatCurrency={(value) => `TRY ${value}`}
      />
    );

    const segmentedProps = segmentedModule.SegmentedControl.mock.calls[0][0] as SegmentedProps;
    segmentedProps.onValueChange("week");

    expect(handleGroupingChange).toHaveBeenCalledWith("week");
  });

  it("renders empty state when no trend data exists", () => {
    render(
      <PaymentsTrendChart
        hasTrendData={false}
        chartConfig={{
          paid: { label: "payments.chart.legend.paid", color: "#00ff00" },
          due: { label: "payments.chart.legend.due", color: "#ff0000" },
          refund: { label: "payments.chart.legend.refund", color: "#0000ff" },
        }}
        chartLegendLabels={{ paid: "Paid", due: "Due", refund: "Refund" }}
        paymentsTrend={[]}
        trendGrouping="day"
        onTrendGroupingChange={jest.fn()}
        rangeLabel=""
        compactCurrencyFormatter={new Intl.NumberFormat("en-US")}
        formatCurrency={(value) => `TRY ${value}`}
      />
    );

    expect(screen.getByText("payments.chart.empty")).toBeInTheDocument();
  });
});
