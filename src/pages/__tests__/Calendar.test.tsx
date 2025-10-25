import React from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import Calendar from "../Calendar";
import { useOptimizedCalendarData } from "@/hooks/useOptimizedCalendarData";
import { useOptimizedCalendarViewport } from "@/hooks/useOptimizedCalendarViewport";
import { useOptimizedCalendarNavigation } from "@/hooks/useOptimizedCalendarNavigation";
import { useOptimizedCalendarEvents } from "@/hooks/useOptimizedCalendarEvents";
import { useOptimizedTouchHandlers } from "@/hooks/useOptimizedTouchHandlers";
import { useCalendarPerformanceMonitor } from "@/hooks/useCalendarPerformanceMonitor";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { useThrottledRefetchOnFocus } from "@/hooks/useThrottledRefetchOnFocus";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: ({ value, onValueChange, options }: any) => (
    <div data-testid="segmented-control" data-value={value}>
      {options.map((option: any) => (
        <button
          key={option.value}
          type="button"
          data-testid={`segment-${option.value}`}
          onClick={() => onValueChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/components/calendar/CalendarSkeleton", () => ({
  CalendarSkeleton: () => <div data-testid="calendar-skeleton" />,
  CalendarWeekSkeleton: () => <div data-testid="calendar-week-skeleton" />,
  CalendarDaySkeleton: () => <div data-testid="calendar-day-skeleton" />,
}));

const monthViewMock = jest.fn(() => <div data-testid="calendar-month-view">Month View</div>);
const weekViewMock = jest.fn(() => <div data-testid="calendar-week-view">Week View</div>);
const dayViewMock = jest.fn(({ onSessionClick }: any) => (
  <button
    type="button"
    data-testid="calendar-day-view"
    onClick={() =>
      onSessionClick &&
      onSessionClick({
        id: "session-123",
        session_date: "2024-05-01",
        session_time: "10:00",
        status: "active",
        lead_id: "lead-1",
      })
    }
  >
    Day View
  </button>
));

jest.mock("@/components/calendar/CalendarMonthView", () => ({
  CalendarMonthView: (props: any) => monthViewMock(props),
}));

jest.mock("@/components/calendar/CalendarWeek", () => ({
  CalendarWeek: (props: any) => weekViewMock(props),
}));

jest.mock("@/components/calendar/CalendarDayView", () => ({
  CalendarDayView: (props: any) => dayViewMock(props),
}));

jest.mock("@/components/ProjectSheetView", () => ({
  ProjectSheetView: ({ project, open }: any) =>
    open ? <div data-testid="project-sheet">{project?.id}</div> : null,
}));

const sessionSheetMock = jest.fn(({ sessionId, isOpen, onOpenChange }: any) =>
  isOpen ? (
    <div data-testid="session-sheet">
      Session Sheet: {sessionId}
      <button type="button" onClick={() => onOpenChange(false)}>
        Close
      </button>
    </div>
  ) : null,
);

jest.mock("@/components/SessionSheetView", () => ({
  __esModule: true,
  default: (props: any) => sessionSheetMock(props),
}));

jest.mock("@/components/calendar/CalendarErrorBoundary", () => ({
  CalendarErrorWrapper: ({ children }: any) => <>{children}</>,
}));

jest.mock("@/hooks/useOptimizedCalendarData");
jest.mock("@/hooks/useOptimizedCalendarViewport");
jest.mock("@/hooks/useOptimizedCalendarNavigation");
jest.mock("@/hooks/useOptimizedCalendarEvents");
jest.mock("@/hooks/useOptimizedTouchHandlers");
jest.mock("@/hooks/useCalendarPerformanceMonitor");
jest.mock("@/hooks/useOrganizationSettings");
jest.mock("@/hooks/useThrottledRefetchOnFocus");

const mockUseOptimizedCalendarData = useOptimizedCalendarData as jest.Mock;
const mockUseOptimizedCalendarViewport = useOptimizedCalendarViewport as jest.Mock;
const mockUseOptimizedCalendarNavigation = useOptimizedCalendarNavigation as jest.Mock;
const mockUseOptimizedCalendarEvents = useOptimizedCalendarEvents as jest.Mock;
const mockUseOptimizedTouchHandlers = useOptimizedTouchHandlers as jest.Mock;
const mockUseCalendarPerformanceMonitor = useCalendarPerformanceMonitor as jest.Mock;
const mockUseOrganizationSettings = useOrganizationSettings as jest.Mock;
const mockUseThrottledRefetchOnFocus = useThrottledRefetchOnFocus as jest.Mock;

const createBaseHookResponse = (overrides: Partial<ReturnType<typeof useOptimizedCalendarData>> = {}) => ({
  sessions: [],
  activities: [],
  projects: [],
  leads: [],
  projectsMap: {},
  leadsMap: {},
  isLoading: false,
  error: null,
  ...overrides,
});

describe("Calendar page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(window, "innerWidth", {
      value: 1024,
      writable: true,
    });

    mockUseOptimizedCalendarData.mockReturnValue(createBaseHookResponse());
    mockUseOptimizedCalendarViewport.mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      viewConfig: { enableSwipeNavigation: false },
      handleDayClick: jest.fn(),
    });
    mockUseOptimizedCalendarNavigation.mockReturnValue({
      navigatePrevious: jest.fn(),
      navigateNext: jest.fn(),
      goToToday: jest.fn(),
      viewTitle: "May 2024",
      handleKeyboardNavigation: jest.fn(),
    });
    mockUseOptimizedCalendarEvents.mockReturnValue({
      getEventsForDate: jest.fn(() => []),
      eventStats: { totalEvents: 0 },
    });
    mockUseOptimizedTouchHandlers.mockReturnValue({
      handleTouchStart: jest.fn(),
      handleTouchMove: jest.fn(),
      handleTouchEnd: jest.fn(),
    });
    mockUseCalendarPerformanceMonitor.mockReturnValue({
      startRenderTiming: jest.fn(),
      endRenderTiming: jest.fn(),
      startQueryTiming: jest.fn(),
      endQueryTiming: jest.fn(),
      startEventProcessing: jest.fn(),
      endEventProcessing: jest.fn(),
      getPerformanceSummary: jest.fn(() => ({ eventsProcessed: 0 })),
    });
    mockUseOrganizationSettings.mockReturnValue({ loading: false });
    mockUseThrottledRefetchOnFocus.mockImplementation(() => {});
  });

  it("renders the loading skeleton while data is loading", () => {
    mockUseOptimizedCalendarData.mockReturnValue(
      createBaseHookResponse({ isLoading: true })
    );

    render(<Calendar />);

    expect(screen.getByTestId("calendar-skeleton")).toBeInTheDocument();
    expect(screen.getAllByText("calendar.title")[0]).toBeInTheDocument();
  });

  it("renders different calendar views when the view mode changes", async () => {
    render(<Calendar />);

    expect(screen.getByTestId("calendar-month-view")).toBeInTheDocument();

    const [weekButton] = screen.getAllByTestId("segment-week");
    fireEvent.click(weekButton);

    await waitFor(() => {
      expect(screen.getByTestId("calendar-week-view")).toBeInTheDocument();
    });

    const [dayButton] = screen.getAllByTestId("segment-day");
    fireEvent.click(dayButton);

    await waitFor(() => {
      expect(screen.getByTestId("calendar-day-view")).toBeInTheDocument();
    });
  });

  it("opens the session sheet when a session is selected", async () => {
    localStorage.setItem("calendar:viewMode", "day");

    render(<Calendar />);

    fireEvent.click(screen.getByTestId("calendar-day-view"));

    await waitFor(() => {
      expect(screen.getByTestId("session-sheet")).toHaveTextContent("session-123");
    });
  });
});
