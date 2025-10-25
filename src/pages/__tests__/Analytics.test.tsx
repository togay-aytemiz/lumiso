import React from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import Analytics from "../Analytics";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type QueryResponse = { data: any; error: any };

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
  return {
    ToggleGroup: ({ value, onValueChange, children }: any) => (
      <div data-testid="toggle-group" data-value={value}>
        {React.Children.map(children, (child: React.ReactElement) =>
          React.cloneElement(child, {
            onSelect: (nextValue: string) => onValueChange?.(nextValue),
            isActive: child.props.value === value,
          })
        )}
      </div>
    ),
    ToggleGroupItem: ({ value, children, onSelect }: any) => (
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

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children, data }: any) => (
    <div data-testid="line-chart" data-points={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  PieChart: ({ children, data }: any) => (
    <div data-testid="pie-chart" data-points={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Pie: ({ children, data }: any) => (
    <div data-testid="pie" data-points={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Cell: () => <div data-testid="cell" />,
  BarChart: ({ children, data }: any) => (
    <div data-testid="bar-chart" data-points={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Bar: () => <div data-testid="bar" />,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const getSupabaseFromMock = () => supabase.from as jest.Mock;

describe("Analytics page", () => {
  let responseQueue: QueryResponse[];

  const enqueueResponse = (data: any, error: any = null) => {
    responseQueue.push({ data, error });
  };

  beforeEach(() => {
    responseQueue = [];
    jest.clearAllMocks();

    getSupabaseFromMock().mockImplementation((table: string) => {
      const chain: Record<string, any> = {};

      chain.select = jest.fn().mockImplementation((columns: string) => {
        if (table === "sessions" && columns === "status") {
          const response = responseQueue.shift() ?? { data: [], error: null };
          return Promise.resolve(response);
        }
        chain.__columns = columns;
        return chain;
      });

      chain.gte = jest.fn().mockImplementation(() => chain);
      chain.lte = jest.fn().mockImplementation(() => {
        const response = responseQueue.shift() ?? { data: [], error: null };
        return Promise.resolve(response);
      });

      chain.eq = jest.fn().mockImplementation(() => chain);
      chain.in = jest.fn().mockImplementation(() => chain);
      chain.order = jest.fn().mockImplementation(() => chain);
      chain.limit = jest.fn().mockImplementation(() => chain);
      chain.single = jest.fn();

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
