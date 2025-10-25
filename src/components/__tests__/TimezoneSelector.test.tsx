import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimezoneSelector } from "../TimezoneSelector";
import {
  detectBrowserTimezone,
  getSupportedTimezones,
} from "@/lib/dateFormatUtils";

jest.mock("@/lib/dateFormatUtils", () => ({
  getSupportedTimezones: jest.fn(),
  detectBrowserTimezone: jest.fn(),
}));

describe("TimezoneSelector", () => {
  const mockOnValueChange = jest.fn();
  const mockTimezones = [
    { region: "America", label: "New York (EST)", value: "America/New_York" },
    { region: "Europe", label: "London (GMT)", value: "Europe/London" },
    { region: "Asia", label: "Tokyo (JST)", value: "Asia/Tokyo" },
  ];

  beforeEach(() => {
    (getSupportedTimezones as jest.Mock).mockReturnValue(mockTimezones);
    mockOnValueChange.mockReset();
  });

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: jest.fn(),
    });
  });

  it("renders auto-detect shortcut when browser timezone differs", async () => {
    (detectBrowserTimezone as jest.Mock).mockReturnValue("Europe/London");

    const user = userEvent.setup();

    render(
      <TimezoneSelector
        value="America/New_York"
        onValueChange={mockOnValueChange}
      />
    );

    const autoDetectButton = screen.getByRole("button", { name: "Auto-detect" });
    expect(autoDetectButton).toBeInTheDocument();

    await user.click(autoDetectButton);
    expect(mockOnValueChange).toHaveBeenCalledWith("Europe/London");
  });

  it("lists grouped timezone options and propagates selection", async () => {
    (detectBrowserTimezone as jest.Mock).mockReturnValue("America/New_York");

    const user = userEvent.setup();

    render(
      <TimezoneSelector value="" onValueChange={mockOnValueChange} />
    );

    const trigger = screen.getByRole("combobox", { name: "Timezone" });
    await user.click(trigger);

    const tokyoOption = await screen.findByRole("option", {
      name: /Tokyo \(JST\)/,
    });

    expect(tokyoOption).toBeInTheDocument();

    await user.click(tokyoOption);
    expect(mockOnValueChange).toHaveBeenCalledWith("Asia/Tokyo");
  });

  it("hides auto-detect button when already using detected timezone", () => {
    (detectBrowserTimezone as jest.Mock).mockReturnValue("Asia/Tokyo");

    render(
      <TimezoneSelector value="Asia/Tokyo" onValueChange={mockOnValueChange} />
    );

    expect(screen.queryByRole("button", { name: "Auto-detect" })).not.toBeInTheDocument();
  });
});
