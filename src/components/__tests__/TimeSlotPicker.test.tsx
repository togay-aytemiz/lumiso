import { fireEvent, render, screen } from "@/utils/testUtils";
import { TimeSlotPicker } from "../TimeSlotPicker";
import { useWorkingHours as useWorkingHoursMock } from "@/hooks/useWorkingHours";

jest.mock("@/hooks/useWorkingHours", () => ({
  useWorkingHours: jest.fn(),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: () => ({ t: (key: string) => key }),
  useCommonTranslation: () => ({ t: (key: string) => key }),
  useMessagesTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

const mockUseWorkingHours = useWorkingHoursMock as jest.Mock;

beforeAll(() => {
  Object.defineProperty(window.navigator, "language", {
    value: "en-US",
    configurable: true,
  });
});

beforeEach(() => {
  mockUseWorkingHours.mockReturnValue({
    loading: false,
    workingHours: [
      {
        day_of_week: 2,
        enabled: true,
        start_time: "09:00",
        end_time: "11:00",
      },
    ],
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("TimeSlotPicker", () => {
  it("renders available time slots centered with soft hover", () => {
    const handleSelect = jest.fn();
    const selectedDate = new Date("2024-05-21T00:00:00"); // Tuesday (day_of_week = 2)

    render(
      <TimeSlotPicker
        selectedDate={selectedDate}
        selectedTime="09:00"
        onTimeSelect={handleSelect}
      />
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(1);
    const selectedButton = buttons[0];
    const hoverButton = buttons[1];
    expect(selectedButton.className).toContain("justify-center");
    expect(selectedButton.className).toContain("text-center");
    expect(hoverButton.className).toContain("hover:bg-primary/10");

    fireEvent.click(hoverButton);
    expect(handleSelect).toHaveBeenCalledWith(expect.any(String));
  });
});
