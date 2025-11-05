import type { ReactElement, ReactNode, SVGProps } from "react";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import Analytics from "../Analytics";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type QueryResponse = { data: unknown; error: unknown };

type SupabaseQueryChain = {
  __columns?: string;
  select: (columns: string) => SupabaseQueryChain | Promise<QueryResponse>;
  gte: (field: string, value: string) => SupabaseQueryChain;
  lte: (field: string, value: string) => Promise<QueryResponse>;
  eq: (field: string, value: unknown) => SupabaseQueryChain;
  in: (field: string, values: unknown[]) => SupabaseQueryChain;
  order: (field: string) => SupabaseQueryChain;
  limit: (value: number) => SupabaseQueryChain;
  single: jest.Mock;
};

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
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
  PageLoadingSkeleton: () => <div data-testid="page-loading" />,
}));

jest.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart-container">{children}</div>
  ),
  ChartTooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart-tooltip">{children}</div>
  ),
  ChartTooltipContent: () => <div data-testid="chart-tooltip-content" />,
  ChartLegend: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart-legend">{children}</div>
  ),
  ChartLegendContent: () => <div data-testid="chart-legend-content" />,
}));

jest.mock("@/components/ui/toggle-group", () => {
  type ToggleGroupProps = {
    value: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  };

  type ToggleGroupItemProps = {
    value: string;
    children: ReactNode;
    onSelect?: (value: string) => void;
    isActive?: boolean;
  };

  return {
    ToggleGroup: ({ value, onValueChange, children }: ToggleGroupProps) => (
      <div data-testid="toggle-group" data-value={value}>
        {React.Children.map(children, (child: ReactNode) =>
          React.isValidElement(child)
            ? React.cloneElement(child as ReactElement<ToggleGroupItemProps>, {
                onSelect: (nextValue: string) => onValueChange?.(nextValue),
                isActive: (child.props as ToggleGroupItemProps).value === value,
              })
            : child
        )}
      </div>
    ),
    ToggleGroupItem: ({ value, children, onSelect }: ToggleGroupItemProps) => (
      <button
        type="button"
        data-testid={`toggle-${value}`}
        aria-pressed={false}
        onClick={() => onSelect?.(value)}
      >
        {children}
      </button>
    ),
  };
});

jest.mock("recharts", () => {
  type ChartDataProps = {
    children?: ReactNode;
    data?: unknown;
  };

  const wrap = (testId: string, { children, data }: ChartDataProps) => (
    <div data-testid={testId} data-points={JSON.stringify(data)}>
      {children}
    </div>
  );

  return {
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    LineChart: (props: ChartDataProps) => wrap("line-chart", props),
    PieChart: (props: ChartDataProps) => wrap("pie-chart", props),
    Pie: (props: ChartDataProps) => wrap("pie", props),
    BarChart: (props: ChartDataProps) => wrap("bar-chart", props),
    Line: () => <div data-testid="line" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Cell: () => <div data-testid="cell" />,
    Bar: () => <div data-testid="bar" />,
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const getSupabaseFromMock = () => supabase.from as jest.Mock;

describe("Analytics page", () => {
  let responseQueue: QueryResponse[];

  const enqueueResponse = (data: unknown, error: unknown = null) => {
    responseQueue.push({ data, error });
  };

  beforeEach(() => {
    responseQueue = [];
    jest.clearAllMocks();

    getSupabaseFromMock().mockImplementation((table: string) => {
      const chain: SupabaseQueryChain = {
        select: (columns: string) => {
          if (table === "sessions" && columns === "status") {
            const response = responseQueue.shift() ?? { data: [], error: null };
            return Promise.resolve(response);
          }
          chain.__columns = columns;
          return chain;
        },
        gte: (_field: string, _value: string) => chain,
        lte: (_field: string, _value: string) => {
          const response = responseQueue.shift() ?? { data: [], error: null };
          return Promise.resolve(response);
        },
        eq: (_field: string, _value: unknown) => chain,
        in: (_field: string, _values: unknown[]) => chain,
        order: (_field: string) => chain,
        limit: (_value: number) => chain,
        single: jest.fn(),
      };

      return chain;
    });
  });

  it("loads analytics data and toggles between scheduled and created sessions", async () => {
    enqueueResponse(
      [
        { session_date: "2024-05-01" },
        { session_date: "2024-05-01" },
        { session_date: "2024-05-02" },
      ]
    );
    enqueueResponse([
      { status: "planned" },
      { status: "completed" },
    ]);
    enqueueResponse([
      { created_at: "2024-02-01T00:00:00.000Z" },
      { created_at: "2024-03-15T00:00:00.000Z" },
    ]);
    enqueueResponse([
      { created_at: "2024-05-10T10:00:00.000Z" },
      { created_at: "2024-05-10T15:00:00.000Z" },
    ]);

    render(<Analytics />);

    await waitFor(() =>
      expect(screen.queryByTestId("page-loading")).not.toBeInTheDocument()
    );

    expect(
      screen.getByText("analytics.sessionsPerDay.scheduled")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("toggle-created"));

    await waitFor(() =>
      expect(
        screen.getByText("analytics.sessionsPerDay.created")
      ).toBeInTheDocument()
    );

    expect(getSupabaseFromMock()).toHaveBeenCalledTimes(4);
    expect(responseQueue).toHaveLength(0);
  });

  it("shows a destructive toast when analytics queries fail", async () => {
    enqueueResponse(null, { message: "network-error" });

    render(<Analytics />);

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "analytics.errorFetching",
          description: "network-error",
          variant: "destructive",
        })
      );
    });

    await waitFor(() =>
      expect(screen.queryByTestId("page-loading")).not.toBeInTheDocument()
    );
  });

  it("renders empty analytics states without crashing", async () => {
    enqueueResponse([]);
    enqueueResponse([]);
    enqueueResponse([]);

    render(<Analytics />);

    await waitFor(() =>
      expect(screen.queryByTestId("page-loading")).not.toBeInTheDocument()
    );

    expect(
      JSON.parse(screen.getByTestId("pie-chart").getAttribute("data-points") || "[]")
    ).toHaveLength(0);

    const barData = JSON.parse(
      screen.getByTestId("bar-chart").getAttribute("data-points") || "[]"
    );
    expect(Array.isArray(barData)).toBe(true);
    expect(barData).toHaveLength(6);

    expect(screen.getByText("analytics.sessionsByStatus.title")).toBeInTheDocument();
    expect(screen.getByText("analytics.leadsByMonth.title")).toBeInTheDocument();
  });
});
