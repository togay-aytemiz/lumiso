import { fireEvent, render, screen } from "@/utils/testUtils";
import { CalendarDay } from "../CalendarDay";

jest.mock("@/lib/utils", () => ({
  ...(jest.requireActual("@/lib/utils") as Record<string, unknown>),
  formatTime: jest.fn((value: string) => `formatted-${value}`),
  getUserLocale: jest.fn(() => "en-US"),
}));

describe("CalendarDay", () => {
  const baseDate = new Date("2024-05-15T00:00:00Z");
  const currentDate = new Date("2024-05-01T00:00:00Z");
  const onSessionClick = jest.fn();
  const onActivityClick = jest.fn();
  const onDayClick = jest.fn();

  const leadsMap = {
    "lead-1": { id: "lead-1", name: "Alice" },
    "lead-2": { id: "lead-2", name: "Bob" },
  };

  const projectsMap = {
    "project-1": { id: "project-1", name: "Wedding", lead_id: "lead-1" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    onSessionClick.mockClear();
    onActivityClick.mockClear();
    onDayClick.mockClear();
  });

  it("renders sessions and activities for the selected day", () => {
    render(
      <CalendarDay
        date={baseDate}
        currentDate={currentDate}
        sessions={[
          {
            id: "session-1",
            session_date: "2024-05-15",
            session_time: "09:00",
            status: "scheduled",
            lead_id: "lead-1",
            project_id: "project-1",
          },
        ]}
        activities={[
          {
            id: "activity-1",
            content: "Call bride",
            reminder_date: "2024-05-15",
            reminder_time: "08:30",
            type: "call",
            lead_id: "lead-2",
            project_id: null,
            completed: false,
          },
        ]}
        showSessions
        showReminders
        leadsMap={leadsMap}
        projectsMap={projectsMap}
        isMobile={false}
        onSessionClick={onSessionClick}
        onActivityClick={onActivityClick}
      />
    );

    expect(screen.getByText("formatted-09:00 • Alice")).toBeInTheDocument();
    expect(screen.getByText("formatted-08:30 • Bob")).toBeInTheDocument();

    fireEvent.click(screen.getByText("formatted-09:00 • Alice"));
    expect(onSessionClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "session-1" })
    );

    fireEvent.click(screen.getByText("formatted-08:30 • Bob"));
    expect(onActivityClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "activity-1" })
    );
  });

  it("shows overflow indicator when more than two events exist", () => {
    render(
      <CalendarDay
        date={baseDate}
        currentDate={currentDate}
        sessions={[
          {
            id: "session-1",
            session_date: "2024-05-15",
            session_time: "09:00",
            status: "scheduled",
            lead_id: "lead-1",
            project_id: "project-1",
          },
          {
            id: "session-2",
            session_date: "2024-05-15",
            session_time: "10:00",
            status: "scheduled",
            lead_id: "lead-1",
            project_id: "project-1",
          },
        ]}
        activities={[
          {
            id: "activity-1",
            content: "Send invoice",
            reminder_date: "2024-05-15",
            reminder_time: "11:00",
            type: "todo",
            lead_id: "lead-2",
            project_id: null,
          },
        ]}
        showSessions
        showReminders
        leadsMap={leadsMap}
        projectsMap={projectsMap}
        isMobile={false}
        onSessionClick={onSessionClick}
        onActivityClick={onActivityClick}
      />
    );

    expect(screen.getByText("+1 more")).toBeInTheDocument();
  });

  it("invokes day click callback on mobile", () => {
    render(
      <CalendarDay
        date={baseDate}
        currentDate={currentDate}
        sessions={[]}
        activities={[]}
        showSessions={false}
        showReminders={false}
        leadsMap={{}}
        projectsMap={{}}
        isMobile
        onSessionClick={onSessionClick}
        onActivityClick={onActivityClick}
        onDayClick={onDayClick}
      />
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onDayClick).toHaveBeenCalledWith(baseDate);
  });
});
