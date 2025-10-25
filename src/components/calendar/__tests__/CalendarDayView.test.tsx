import { fireEvent, render, screen } from "@/utils/testUtils";
import { CalendarDayView } from "../CalendarDayView";

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

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/lib/utils", () => ({
  ...(jest.requireActual("@/lib/utils") as Record<string, unknown>),
  getUserLocale: jest.fn(() => "en-US"),
  formatTime: jest.fn((value: string) => `formatted-${value}`),
  formatDate: jest.fn((value: string) => `formatted-date-${value}`),
}));

const mockUseOrganizationTimezone = jest.fn(() => ({
  formatTime: (value: string) => `org-${value}`,
}));

jest.mock("@/hooks/useOrganizationTimezone", () => ({
  useOrganizationTimezone: () => mockUseOrganizationTimezone(),
}));

describe("CalendarDayView", () => {
  const baseDate = new Date("2024-05-15T00:00:00Z");
  const touchHandlers = {
    handleTouchStart: jest.fn(),
    handleTouchMove: jest.fn(),
    handleTouchEnd: jest.fn(),
    handleTouchCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(touchHandlers).forEach((handler) => handler.mockClear());
  });

  it("renders sessions and reminders with click handlers", () => {
    const onSessionClick = jest.fn();
    const onActivityClick = jest.fn();

    render(
      <CalendarDayView
        currentDate={baseDate}
        getEventsForDate={() => ({
          sessions: [
            {
              id: "session-1",
              session_date: "2024-05-15",
              session_time: "09:00",
              status: "scheduled",
              notes: "Bring contract",
              lead_id: "lead-1",
              project_id: "project-1",
            },
          ],
          activities: [
            {
              id: "activity-1",
              content: "Call bride",
              reminder_date: "2024-05-15",
              reminder_time: "08:30",
              type: "call",
              lead_id: "lead-2",
              project_id: null,
            },
          ],
        })}
        showSessions
        showReminders
        leadsMap={{
          "lead-1": { name: "Alice" },
          "lead-2": { name: "Bob" },
        }}
        projectsMap={{
          "project-1": { name: "Wedding" },
        }}
        onSessionClick={onSessionClick}
        onActivityClick={onActivityClick}
        touchHandlers={touchHandlers}
      />
    );

    expect(
      screen.getByText((content) => content.includes("calendar.sections.sessions"))
    ).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes("calendar.sections.reminders"))
    ).toBeInTheDocument();
    expect(screen.getByText("org-09:00")).toBeInTheDocument();
    expect(screen.getByText("org-08:30")).toBeInTheDocument();

    fireEvent.click(screen.getByText("org-09:00"));
    expect(onSessionClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "session-1" })
    );

    fireEvent.click(screen.getByText("Call bride"));
    expect(onActivityClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "activity-1" })
    );
  });

  it("renders empty state when filters disable all sections", () => {
    render(
      <CalendarDayView
        currentDate={baseDate}
        getEventsForDate={() => ({ sessions: [], activities: [] })}
        showSessions={false}
        showReminders={false}
        leadsMap={{}}
        projectsMap={{}}
        onSessionClick={jest.fn()}
        onActivityClick={jest.fn()}
        touchHandlers={touchHandlers}
      />
    );

    expect(screen.getByText("calendar.emptyStates.noEvents")).toBeInTheDocument();
    expect(screen.getByText("calendar.emptyStates.enableFilters")).toBeInTheDocument();
  });

  it("wires touch handlers for gesture navigation", () => {
    render(
      <CalendarDayView
        currentDate={baseDate}
        getEventsForDate={() => ({ sessions: [], activities: [] })}
        showSessions={false}
        showReminders={false}
        leadsMap={{}}
        projectsMap={{}}
        onSessionClick={jest.fn()}
        onActivityClick={jest.fn()}
        touchHandlers={touchHandlers}
      />
    );

    const container = screen.getByText("calendar.emptyStates.noEvents").parentElement?.parentElement;
    expect(container).toBeTruthy();

    if (container) {
      fireEvent.touchStart(container, { touches: [] });
      fireEvent.touchMove(container, { touches: [] });
      fireEvent.touchEnd(container, { changedTouches: [] });
      fireEvent.touchCancel(container);
    }

    expect(touchHandlers.handleTouchStart).toHaveBeenCalled();
    expect(touchHandlers.handleTouchMove).toHaveBeenCalled();
    expect(touchHandlers.handleTouchEnd).toHaveBeenCalled();
    expect(touchHandlers.handleTouchCancel).toHaveBeenCalled();
  });
});
