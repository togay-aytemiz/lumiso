import { fireEvent, render, screen } from "@/utils/testUtils";
import { CalendarWeek } from "../CalendarWeek";

const actualUtils = jest.requireActual("@/lib/utils");

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.count != null ? `${key}:${options.count}` : key,
  }),
}));

jest.mock("@/lib/utils", () => ({
  ...(jest.requireActual("@/lib/utils") as Record<string, unknown>),
  getUserLocale: jest.fn(() => "en-US"),
  getStartOfWeek: jest.fn((date: Date) => actualUtils.getStartOfWeek(date, "en-US")),
  getDateFnsLocale: jest.fn(() => undefined),
  formatTime: jest.fn((value: string) => `formatted-${value}`),
}));

const mockUseSmartTimeRange = jest.fn();

jest.mock("@/hooks/useSmartTimeRange", () => ({
  useSmartTimeRange: () => mockUseSmartTimeRange(),
}));

const mockUseOrganizationTimezone = jest.fn();

jest.mock("@/hooks/useOrganizationTimezone", () => ({
  useOrganizationTimezone: () => mockUseOrganizationTimezone(),
}));

describe("CalendarWeek", () => {
  const currentDate = new Date("2024-05-15T00:00:00Z");
  const sessions = [
    {
      id: "session-1",
      session_date: "2024-05-15",
      session_time: "09:00",
      status: "scheduled",
      lead_id: "lead-1",
      project_id: "project-1",
      notes: "Bring contract",
    },
  ];
  const activities = [
    {
      id: "activity-1",
      content: "Send invoice",
      reminder_date: "2024-05-15",
      reminder_time: "10:00",
      type: "call",
      lead_id: "lead-2",
      project_id: null,
      completed: false,
    },
  ];
  const leadsMap = {
    "lead-1": { id: "lead-1", name: "Alice" },
    "lead-2": { id: "lead-2", name: "Bob" },
  };
  const projectsMap = {
    "project-1": { id: "project-1", name: "Wedding", lead_id: "lead-1" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSmartTimeRange.mockReturnValue({
      timeSlots: [
        { hour: 9, minute: 0, display: "09:00" },
        { hour: 10, minute: 0, display: "10:00" },
      ],
      getSlotIndex: jest.fn(() => 0),
    });
    mockUseOrganizationTimezone.mockReturnValue({
      formatTime: (value: string) => `org-${value}`,
      loading: false,
    });
  });

  it("renders a loading skeleton while timezone data loads", () => {
    mockUseOrganizationTimezone.mockReturnValue({
      formatTime: (value: string) => `org-${value}`,
      loading: true,
    });

    const { container } = render(
      <CalendarWeek
        currentDate={currentDate}
        sessions={sessions}
        activities={activities}
        showSessions
        showReminders
        leadsMap={leadsMap}
        projectsMap={projectsMap}
        isMobile={false}
        getEventsForDate={() => ({ sessions, activities })}
        onSessionClick={jest.fn()}
        onActivityClick={jest.fn()}
      />
    );

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders mobile day summary with interactions", () => {
    const onSessionClick = jest.fn();
    const onActivityClick = jest.fn();
    const onDayClick = jest.fn();

    render(
      <CalendarWeek
        currentDate={currentDate}
        sessions={sessions}
        activities={activities}
        showSessions
        showReminders
        leadsMap={leadsMap}
        projectsMap={projectsMap}
        isMobile
        getEventsForDate={() => ({ sessions, activities })}
        onSessionClick={onSessionClick}
        onActivityClick={onActivityClick}
        onDayClick={onDayClick}
      />
    );

    expect(screen.getByText("calendar.sections.sessions:1")).toBeInTheDocument();
    expect(screen.getByText("calendar.sections.reminders:1")).toBeInTheDocument();

    fireEvent.click(screen.getByText("org-09:00"));
    expect(onSessionClick).toHaveBeenCalledWith(expect.objectContaining({ id: "session-1" }));

    fireEvent.click(screen.getByText("Send invoice"));
    expect(onActivityClick).toHaveBeenCalledWith(expect.objectContaining({ id: "activity-1" }));

    const dayButton = screen
      .getAllByRole("button")
      .find((button) => button.textContent?.includes("15"));
    expect(dayButton).toBeTruthy();
    fireEvent.click(dayButton!);
    expect(onDayClick).toHaveBeenCalled();
  });

  it("renders desktop grid and wires event callbacks", () => {
    const onSessionClick = jest.fn();
    const onActivityClick = jest.fn();

    render(
      <CalendarWeek
        currentDate={currentDate}
        sessions={sessions}
        activities={activities}
        showSessions
        showReminders
        leadsMap={leadsMap}
        projectsMap={projectsMap}
        isMobile={false}
        getEventsForDate={() => ({ sessions, activities })}
        onSessionClick={onSessionClick}
        onActivityClick={onActivityClick}
      />
    );

    const sessionButton = screen.getAllByRole("button", { name: /Alice/ })[0];
    fireEvent.click(sessionButton);
    expect(onSessionClick).toHaveBeenCalledWith(expect.objectContaining({ id: "session-1" }));

    const activityButton = screen.getAllByRole("button", { name: /Bob/ })[0];
    fireEvent.click(activityButton);
    expect(onActivityClick).toHaveBeenCalledWith(expect.objectContaining({ id: "activity-1" }));
  });
});
