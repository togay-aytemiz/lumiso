import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen } from "@/utils/testUtils";
import { SegmentedControl, type SegmentedOption } from "../segmented-control";

describe("SegmentedControl", () => {
  const options: SegmentedOption[] = [
    { value: "overview", label: "Overview" },
    { value: "details", label: "Details" },
    {
      value: "upcoming",
      label: "Upcoming",
      ariaLabel: "Upcoming view",
      disabled: true,
      tooltip: "Disabled for now",
    },
  ];

  it("calls onValueChange for active buttons and updates pressed state", () => {
    const onValueChange = jest.fn();
    const { rerender } = render(
      <SegmentedControl
        value="overview"
        onValueChange={onValueChange}
        options={options}
      />
    );

    const overviewButton = screen.getByRole("button", { name: "Overview" });
    expect(overviewButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(onValueChange).toHaveBeenCalledWith("details");

    rerender(
      <SegmentedControl
        value="details"
        onValueChange={onValueChange}
        options={options}
      />
    );

    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("ignores disabled options and shows tooltip content", async () => {
    const onValueChange = jest.fn();
    render(
      <SegmentedControl
        value="overview"
        onValueChange={onValueChange}
        options={options}
      />
    );

    const disabledButton = screen.getByRole("button", { name: "Upcoming view" });
    expect(disabledButton).toBeDisabled();

    fireEvent.click(disabledButton);
    expect(onValueChange).not.toHaveBeenCalled();

    const user = userEvent.setup();
    await user.hover(disabledButton);
    const tooltipItems = await screen.findAllByText("Disabled for now");
    expect(tooltipItems.length).toBeGreaterThan(0);
  });
});
