import { render, screen } from "@/utils/testUtils";
import { PaymentsMetricsSummary } from "../PaymentsMetricsSummary";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/components/ui/progress", () => {
  const Progress = jest.fn(({ value }: { value?: number }) => (
    <div data-testid="collection-progress" data-value={value} />
  ));
  return { Progress };
});

describe("PaymentsMetricsSummary", () => {
  const progressModule = jest.requireMock("@/components/ui/progress") as {
    Progress: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders formatted totals and progress", () => {
    const formatCurrency = jest.fn((value: number) => `TRY ${value.toFixed(0)}`);
    const formatPercent = jest.fn((value: number) => `${Math.round(value * 100)}%`);

    render(
      <PaymentsMetricsSummary
        metrics={{
          totalInvoiced: 12345,
          totalPaid: 8900,
          totalRefunded: 1200,
          remainingBalance: 345,
          collectionRate: 0.72,
          netCollected: 7700,
        }}
        formatCurrency={formatCurrency}
        formatPercent={formatPercent}
      />
    );

    expect(formatCurrency).toHaveBeenCalledWith(12345);
    expect(formatCurrency).toHaveBeenCalledWith(8900);
    expect(formatCurrency).toHaveBeenCalledWith(1200);
    expect(formatCurrency).toHaveBeenCalledWith(345);
    expect(formatCurrency).toHaveBeenCalledWith(7700);
    // Hint uses net and invoiced again
    expect(formatCurrency).toHaveBeenCalledWith(7700);
    expect(formatCurrency).toHaveBeenCalledWith(12345);
    expect(formatPercent).toHaveBeenCalledWith(0.72);

    expect(screen.getByText("TRY 12345")).toBeInTheDocument();
    expect(screen.getByText("TRY 8900")).toBeInTheDocument();
    expect(screen.getByText("TRY 7700")).toBeInTheDocument();
    expect(screen.getByText("TRY 345")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();

    expect(progressModule.Progress).toHaveBeenCalledWith(
      expect.objectContaining({ value: 72 }),
      {}
    );
    expect(screen.getByTestId("collection-progress")).toHaveAttribute("data-value", "72");
  });
});
