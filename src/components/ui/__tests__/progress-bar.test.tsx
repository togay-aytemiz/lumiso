import { render, screen } from "@/utils/testUtils";
import { ProgressBar } from "../progress-bar";

describe("ProgressBar", () => {
  it("renders the completion label when requested", () => {
    const { container } = render(
      <ProgressBar value={40} total={5} completed={2} showLabel />
    );

    expect(screen.getByText("2/5")).toBeInTheDocument();

    const indicator = container.querySelector(
      '[style*="width: 40%"]'
    ) as HTMLElement | null;
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveStyle({ width: "40%" });
  });

  it("applies the success color once complete and adjusts height for size", () => {
    const { container } = render(
      <ProgressBar
        value={100}
        total={3}
        completed={3}
        size="md"
        showLabel
      />
    );

    const track = container.querySelector(".h-3");
    expect(track).toBeInTheDocument();

    const indicator = container.querySelector(".bg-green-600") as HTMLElement | null;
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveStyle({ width: "100%" });
  });

  it("hides the label when total is zero or showLabel is false", () => {
    const { rerender } = render(
      <ProgressBar value={10} total={0} completed={0} showLabel />
    );

    expect(screen.queryByText("0/0")).not.toBeInTheDocument();

    rerender(
      <ProgressBar value={10} total={4} completed={1} showLabel={false} />
    );

    expect(screen.queryByText("1/4")).not.toBeInTheDocument();
  });
});
