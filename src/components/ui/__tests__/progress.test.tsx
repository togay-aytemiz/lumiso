import { render } from "@/utils/testUtils";
import { Progress } from "../progress";

describe("Progress", () => {
  it("renders with a default transform when no value is provided", () => {
    const { container } = render(<Progress />);
    const indicator = container.querySelector(
      '[style*="translateX"]'
    ) as HTMLElement | null;
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveStyle({ transform: "translateX(-100%)" });
  });

  it("reflects the provided value as a translate offset", () => {
    const { container } = render(<Progress value={65} />);
    const indicator = container.querySelector(
      '[style*="translateX"]'
    ) as HTMLElement | null;
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveStyle({ transform: "translateX(-35%)" });
  });
});
