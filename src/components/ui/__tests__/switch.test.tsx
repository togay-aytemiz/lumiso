import userEvent from "@testing-library/user-event";
import { render, screen } from "@/utils/testUtils";
import { Switch } from "../switch";

describe("Switch", () => {
  it("reflects its checked state through data attributes", async () => {
    const user = userEvent.setup();
    render(<Switch />);

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("data-state", "unchecked");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("data-state", "checked");
  });

  it("supports controlled checked state", () => {
    const { rerender } = render(<Switch checked={false} onCheckedChange={() => {}} />);

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("data-state", "unchecked");

    rerender(<Switch checked onCheckedChange={() => {}} />);
    expect(toggle).toHaveAttribute("data-state", "checked");
  });
});
