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

    expect(firstBlock.style.left).toBe("calc(0% + 1px)");
    expect(secondBlock.style.left).toBe("calc(50% + 1px)");
    expect(firstBlock.style.width).toBe("calc(50% - 2px)");
    expect(secondBlock.style.width).toBe("calc(50% - 2px)");
  });

  it("renders localized day headers with the provided locale", () => {
    const sessions: WeeklyScheduleSession[] = [
      {
        id: "session-localized",
        session_date: "2024-05-20",
        session_time: "09:00",
        duration_minutes: 60,
        lead_name: "Morgan",
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

    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("20/05")).toBeInTheDocument();
    expect(screen.queryByText("05/20")).not.toBeInTheDocument();
  });

  it("applies accent styling and lightweight typography to session blocks", () => {
    const sessions: WeeklyScheduleSession[] = [
      {
        id: "session-style",
        session_date: "2024-05-22",
        session_time: "14:00",
        duration_minutes: 75,
        lead_name: "Dakota",
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

    const sessionBlock = screen.getByTestId("weekly-session-session-style");
    expect(sessionBlock).toHaveClass("bg-emerald-50");
    expect(sessionBlock).toHaveClass("border-emerald-300/80");

    const leadText = screen.getByText("Dakota");
    expect(leadText).toHaveClass("font-light");
    expect(leadText).toHaveClass("line-clamp-6");
  });

  it("renders a draft selection block when both date and time are chosen", () => {
    render(
      <WeeklySchedulePreview
        sessions={[]}
        referenceDate={monday}
        selectedDate={new Date("2024-05-23T00:00:00Z")}
        selectedTime="15:30"
        locale="en-GB"
      />
    );

    const draftBlock = screen.getByTestId("weekly-draft-selection");
    expect(draftBlock).toBeInTheDocument();
    const draftBox = draftBlock.firstElementChild as HTMLElement;
    expect(draftBox).toHaveClass("border-dashed");
    expect(draftBox).toHaveClass("border-amber-400/80");
    expect(draftBlock.textContent).toContain("15:30");
    expect(draftBlock.textContent).toContain(
      "sessionScheduling.weekly_preview_draft_label"
    );
  });

  it("uses the provided session duration for the draft preview", () => {
    render(
      <WeeklySchedulePreview
        sessions={[]}
        referenceDate={monday}
        selectedDate={new Date("2024-05-24T00:00:00Z")}
        selectedTime="10:00"
        selectedDurationMinutes={90}
        locale="en-GB"
      />
    );

    const draftBlock = screen.getByTestId("weekly-draft-selection");
    const draftBox = draftBlock.firstElementChild as HTMLElement;
    const expectedHeight = Math.max(90 * PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT);

    expect(draftBlock.textContent).toContain("10:00");
    expect(draftBlock.textContent).toContain("11:30");
    expect(draftBox).toHaveStyle(`height: ${expectedHeight}px`);
  });

  it("shares the available column space when the draft overlaps an existing session", () => {
    const sessions: WeeklyScheduleSession[] = [
      {
        id: "planned-session",
        session_date: "2024-05-25",
        session_time: "14:00",
        duration_minutes: 60,
        lead_name: "Jamie",
      },
    ];

    render(
      <WeeklySchedulePreview
        sessions={sessions}
        referenceDate={new Date("2024-05-22T00:00:00Z")}
        selectedDate={new Date("2024-05-25T00:00:00Z")}
        selectedTime="14:00"
        selectedDurationMinutes={60}
        locale="en-GB"
      />
    );

    const plannedBlock = screen.getByTestId("weekly-session-planned-session");
    const draftBlock = screen.getByTestId("weekly-draft-selection");

    expect(plannedBlock.style.width).toBe("calc(50% - 2px)");
    expect(plannedBlock.style.left).toBe("calc(0% + 1px)");
    expect(draftBlock).toHaveStyle("width: calc(50% - 2px)");
    expect(draftBlock).toHaveStyle("left: calc(50% + 1px)");
  });

  it("labels the time column using whole-hour increments", () => {
    const sessions: WeeklyScheduleSession[] = [
      {
        id: "half-hour-session",
        session_date: "2024-05-26",
        session_time: "12:30",
        duration_minutes: 45,
        lead_name: "Jordan",
      },
    ];

    render(
      <WeeklySchedulePreview
        sessions={sessions}
        referenceDate={new Date("2024-05-26T00:00:00Z")}
        selectedDate={new Date("2024-05-26T00:00:00Z")}
        selectedTime="12:30"
        locale="en-GB"
      />
    );

    const markers = screen
      .getAllByTestId("weekly-hour-marker")
      .map((marker) => marker.textContent ?? "");

    expect(markers.length).toBeGreaterThan(0);
    markers.forEach((label) => {
      expect(label).toMatch(/:00/);
      expect(label).not.toMatch(/:30/);
    });
  });
});
