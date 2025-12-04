import { render, screen } from "@/utils/testUtils";
import userEvent from "@testing-library/user-event";
import { DateTimePicker } from "../date-time-picker";

describe("DateTimePicker behavior", () => {
  it("keeps the popover open when interacting with built-in controls", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<DateTimePicker value="2024-11-06T18:05" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /2024/ }));

    const todayButton = await screen.findByRole("button", { name: /Today/i });
    expect(todayButton).toBeInTheDocument();

    await user.click(todayButton);
    expect(onChange).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Done/i })).toBeInTheDocument();

    const [hourSelect] = screen.getAllByRole("combobox");
    await user.selectOptions(hourSelect, "10");

    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T10:/)
    );
    expect(screen.getByRole("button", { name: /Done/i })).toBeInTheDocument();
  });

  it("applies provided defaultTime when value only has a date", async () => {
    render(
      <DateTimePicker
        value="2025-09-24"
        onChange={jest.fn()}
        defaultTime="12:00"
      />
    );

    expect(screen.getByRole("button", { name: /12:00/ })).toBeInTheDocument();
  });
});
