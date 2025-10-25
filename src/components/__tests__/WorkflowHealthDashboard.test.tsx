import { fireEvent, render, screen } from "@/utils/testUtils";
import { WorkflowHealthDashboard } from "../WorkflowHealthDashboard";
import { useWorkflowHealth } from "@/hooks/useWorkflowHealth";

jest.mock("@/hooks/useWorkflowHealth", () => ({
  useWorkflowHealth: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, any>, defaultValue?: string) => {
      const translations: Record<string, string> = {
        "workflows.health.unableToLoad": "Unable to load",
        "workflows.health.status.title": "Workflow health",
        "workflows.health.status.description": "Monitor your automations",
        "workflows.health.status.labels.healthy": "Healthy",
        "workflows.health.status.labels.warning": "Warning",
        "workflows.health.status.labels.critical": "Critical",
        "workflows.health.critical.title": "Critical issues detected",
        "workflows.health.warning.title": "Needs attention",
        "workflows.health.actions.cleanup": "Clean up stuck runs",
        "workflows.health.actions.refresh": "Refresh",
        "workflows.health.actions.systemTitle": "System actions",
        "workflows.health.actions.systemDescription": "Keep workflows humming",
        "workflows.health.metrics.totalWorkflows": "Total workflows",
        "workflows.health.metrics.successRate": "Success rate",
        "workflows.health.metrics.recentExecutions": "Recent executions",
        "workflows.health.metrics.averageExecutionTime": "Avg execution time",
        "workflows.health.metrics.dailyTitle": "Daily performance",
        "workflows.health.metrics.dailyDescription": "Per-day stats",
        "workflows.health.metrics.successRateSubtitle": "Success over last 7 days",
        "workflows.health.metrics.recentExecutionsSubtitle": "Runs in the last 24h",
        "workflows.health.metrics.averageExecutionTimeSubtitle": "Average time per workflow",
      };

      switch (key) {
        case "workflows.health.metrics.totalSubtitle":
          return `Active ${options?.active} · Paused ${options?.paused}`;
        case "workflows.health.metrics.dailyTotal":
          return `Total ${options?.count}`;
        case "workflows.health.metrics.dailySuccess":
          return `Success ${options?.rate}%`;
        case "workflows.health.metrics.dailyAverage":
          return `Avg ${options?.time}`;
        case "workflows.health.critical.stuckExecutions":
          return `Stuck ${options?.count}`;
        case "workflows.health.critical.lowSuccessRate":
          return `Low success ${options?.rate}%`;
        case "common:abbreviations.notAvailable":
          return defaultValue ?? "N/A";
        default:
          return translations[key] ?? key;
      }
    },
  }),
}));

describe("WorkflowHealthDashboard", () => {
  const useWorkflowHealthMock = useWorkflowHealth as jest.Mock;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading skeleton while data is fetching", () => {
    useWorkflowHealthMock.mockReturnValue({
      loading: true,
      health: null,
    });

    const { container } = render(<WorkflowHealthDashboard />);

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(4);
  });

  it("shows empty state when health is unavailable", () => {
    useWorkflowHealthMock.mockReturnValue({
      loading: false,
      health: null,
    });

    render(<WorkflowHealthDashboard />);

    expect(screen.getByText("Unable to load")).toBeInTheDocument();
  });

  it("displays critical health details and triggers actions", () => {
    const cleanupStuckExecutions = jest.fn();
    const refetch = jest.fn();

    useWorkflowHealthMock.mockReturnValue({
      loading: false,
      health: {
        totalWorkflows: 12,
        activeWorkflows: 6,
        pausedWorkflows: 6,
        successRate: 72.3,
        recentExecutions: 45,
        averageExecutionTime: 185,
        stuckExecutions: 3,
        metrics: [
          {
            id: "metric-1",
            date: "2024-10-24T00:00:00Z",
            total_executions: 20,
            successful_executions: 14,
            average_execution_time_ms: 210,
          },
        ],
      },
      cleanupStuckExecutions,
      getHealthIcon: () => <span data-testid="health-icon">!</span>,
      getHealthStatus: () => "critical",
      refetch,
    });

    render(<WorkflowHealthDashboard />);

    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("Stuck 3")).toBeInTheDocument();
    expect(screen.getByText("Low success 72.3%"))
      .toBeInTheDocument();
    expect(screen.getByText("Active 6 · Paused 6")).toBeInTheDocument();
    expect(screen.getByText("Success 70.0%"))
      .toBeInTheDocument();
    expect(screen.getByText("Avg 210"))
      .toBeInTheDocument();

    const cleanupButtons = screen.getAllByText("Clean up stuck runs");
    cleanupButtons.forEach((button) => fireEvent.click(button));
    fireEvent.click(screen.getByText("Refresh"));

    expect(cleanupStuckExecutions).toHaveBeenCalledTimes(2);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
