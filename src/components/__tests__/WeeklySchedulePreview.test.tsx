import { render, screen } from "@/utils/testUtils";
import {
  WeeklySchedulePreview,
  __testUtils,
  WeeklyScheduleSession,
} from "../WeeklySchedulePreview";

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: () => ({ t: (key: string) => key }),
}));

const { PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT } = __testUtils;

describe("WeeklySchedulePreview", () => {
  const monday = new Date("2024-05-20T09:00:00Z");

  it("renders empty message when no sessions provided", () => {
    render(
      <WeeklySchedulePreview
        sessions={[]}
        referenceDate={monday}
        selectedDate={monday}
      />
    );

    expect(
      screen.getByText("sessionScheduling.weekly_preview_empty")
    ).toBeInTheDocument();
  });

  it("stretches session blocks based on duration", () => {
  const sessions: WeeklyScheduleSession[] = [
      {
        id: "session-short",
        session_date: "2024-05-20",
        session_time: "09:00",
        duration_minutes: 60,
        session_type_name: "Mini",
        lead_name: "Alex",
      },
      {
        id: "session-long",
        session_date: "2024-05-20",
        session_time: "11:00",
        duration_minutes: 90,
        session_type_name: "Extended",
        lead_name: "Jamie",
      },
    ];

    render(
      <WeeklySchedulePreview
        sessions={sessions}
        referenceDate={monday}
        selectedDate={monday}
        locale="en-GB"
      />
    );

    const shortBlock = screen.getByTestId("weekly-session-session-short");
    const longBlock = screen.getByTestId("weekly-session-session-long");

    const shortHeight = Math.max(60 * PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT);
    const longHeight = Math.max(90 * PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT);

    expect(shortBlock).toHaveStyle(`height: ${shortHeight}px`);
    expect(longBlock).toHaveStyle(`height: ${longHeight}px`);
    expect(shortBlock).toHaveTextContent("Alex");
    expect(shortBlock.getAttribute("aria-label")).toContain("Mini");
    expect(shortBlock.getAttribute("aria-label")).toContain("9:00");
    expect(shortBlock.getAttribute("aria-label")).toContain("10:00");
  });

  it("splits overlapping sessions into columns", () => {
    const sessions: WeeklyScheduleSession[] = [
      {
        id: "session-a",
        session_date: "2024-05-21",
        session_time: "10:00",
        duration_minutes: 60,
        session_type_name: "Standard",
        lead_name: "Casey",
      },
      {
        id: "session-b",
        session_date: "2024-05-21",
        session_time: "10:15",
        duration_minutes: 45,
        session_type_name: "Mini",
        lead_name: "River",
      },
    ];

    render(
      <WeeklySchedulePreview
        sessions={sessions}
        referenceDate={monday}
        selectedDate={new Date("2024-05-21T10:00:00Z")}
        locale="en-GB"
      />
    );

    const firstBlock = screen.getByTestId("weekly-session-session-a");
    const secondBlock = screen.getByTestId("weekly-session-session-b");

    expect(firstBlock.style.left).toBe("calc(0% + 4px)");
    expect(secondBlock.style.left).toBe("calc(50% + 4px)");
    expect(firstBlock.style.width).toBe("calc(50% - 8px)");
    expect(secondBlock.style.width).toBe("calc(50% - 8px)");
  });
});
