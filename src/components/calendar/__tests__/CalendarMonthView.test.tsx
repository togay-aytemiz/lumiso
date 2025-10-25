import { fireEvent, render, screen, within } from "@/utils/testUtils";
import { CalendarMonthView } from "../CalendarMonthView";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.count != null ? `${key}:${options.count}` : key,
  }),
}));

jest.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/lib/utils", () => ({
  ...(jest.requireActual("@/lib/utils") as Record<string, unknown>),
  getUserLocale: jest.fn(() => "en-US"),
  getDateFnsLocale: jest.fn(() => undefined),
  formatTime: jest.fn((value: string) => `formatted-${value}`),
  formatDate: jest.fn((value: string) => `formatted-date-${value}`),
}));

describe("CalendarMonthView", () => {
  const currentDate = new Date("2024-05-15T00:00:00Z");
  const session = {
    id: "session-1",
    session_date: "2024-05-15",
    session_time: "09:00",
    status: "scheduled",
    lead_id: "lead-1",
    project_id: "project-1",
    notes: "Bring contract",
  };
  const activity = {
    id: "activity-1",
    content: "Send invoice",
    reminder_date: "2024-05-15",
    reminder_time: "10:00",
    type: "call",
    lead_id: "lead-2",
    project_id: null,
    completed: false,
  };

  const getEventsForDate = jest.fn((date: Date) => {
    const key = date.toISOString().slice(0, 10);
    if (key === "2024-05-15") {
      return { sessions: [session], activities: [activity] };
    }
    if (key === "2024-05-16") {
      return {
        sessions: [
          { ...session, id: "session-2", session_time: "11:00" },
          { ...session, id: "session-3", session_time: "12:00" },
        ],
        activities: [activity],
      };
    }
    return { sessions: [], activities: [] };
  });

  const leadsMap = {
    "lead-1": { name: "Alice" },
    "lead-2": { name: "Bob" },
  };
  const projectsMap = {
    "project-1": { name: "Wedding" },
  };

  beforeEach(() => {
    getEventsForDate.mockClear();
  });

  it("renders events for the active month and handles clicks", () => {
    const onSessionClick = jest.fn();
    const onActivityClick = jest.fn();

    render(
      <CalendarMonthView
        currentDate={currentDate}
        getEventsForDate={getEventsForDate}
        showSessions
        showReminders
        leadsMap={leadsMap}
        projectsMap={projectsMap}
        onSessionClick={onSessionClick}
        onActivityClick={onActivityClick}
        touchHandlers={{
          handleTouchStart: jest.fn(),
          handleTouchMove: jest.fn(),
          handleTouchEnd: jest.fn(),
          handleTouchCancel: jest.fn(),
        }}
      />
    );

    const sessionButton = screen
      .getByText(/formatted-09:00 Alice/i)
      .closest("button");
    expect(sessionButton).toBeTruthy();
    fireEvent.click(sessionButton!);
    expect(onSessionClick).toHaveBeenCalledWith(expect.objectContaining({ id: "session-1" }));

    const activityButton = screen
      .getByText(/formatted-10:00 Bob/i)
      .closest("button");
    expect(activityButton).toBeTruthy();
    fireEvent.click(activityButton!);
    expect(onActivityClick).toHaveBeenCalledWith(expect.objectContaining({ id: "activity-1" }));
  });

  it("shows overflow tooltip indicator when more events exist", () => {
    render(
      <CalendarMonthView
        currentDate={currentDate}
        getEventsForDate={getEventsForDate}
        showSessions
        showReminders
        leadsMap={leadsMap}
        projectsMap={projectsMap}
        onSessionClick={jest.fn()}
        onActivityClick={jest.fn()}
        onDayClick={jest.fn()}
        touchHandlers={{
          handleTouchStart: jest.fn(),
          handleTouchMove: jest.fn(),
          handleTouchEnd: jest.fn(),
          handleTouchCancel: jest.fn(),
        }}
      />
    );

    const overflowText = screen.getByText("calendar.labels.moreEvents:1");
    expect(overflowText).toBeInTheDocument();
  });

  it("invokes day click callback when provided", () => {
    const onDayClick = jest.fn();

    render(
      <CalendarMonthView
        currentDate={currentDate}
        getEventsForDate={getEventsForDate}
        showSessions
        showReminders
        leadsMap={leadsMap}
        projectsMap={projectsMap}
        onSessionClick={jest.fn()}
        onActivityClick={jest.fn()}
        onDayClick={onDayClick}
        touchHandlers={{
          handleTouchStart: jest.fn(),
          handleTouchMove: jest.fn(),
          handleTouchEnd: jest.fn(),
          handleTouchCancel: jest.fn(),
        }}
      />
    );

    const maySixteenthCell = screen.getAllByText("16").find((node) => {
      const button = node.closest("button");
      if (!button) return false;
      return within(button).queryByText(/formatted-11:00 Alice/i) !== null;
    });

    expect(maySixteenthCell).toBeTruthy();
    if (maySixteenthCell) {
      fireEvent.click(maySixteenthCell.closest("button")!);
    }

    expect(onDayClick).toHaveBeenCalled();
  });
});
