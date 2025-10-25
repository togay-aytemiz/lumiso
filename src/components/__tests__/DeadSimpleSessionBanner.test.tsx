import { fireEvent, render, screen } from "@/utils/testUtils";
import DeadSimpleSessionBanner from "../DeadSimpleSessionBanner";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { getRelativeDate, isOverdueSession } from "@/lib/dateUtils";
import { getDisplaySessionName } from "@/lib/sessionUtils";
import { useFormsTranslation, useMessagesTranslation } from "@/hooks/useTypedTranslation";

type Mocked<T> = T extends (...args: infer P) => infer R ? jest.Mock<R, P> : never;

jest.mock("@/hooks/useOrganizationSettings", () => ({
  useOrganizationSettings: jest.fn(),
}));

jest.mock("@/lib/dateUtils", () => ({
  getRelativeDate: jest.fn(),
  isOverdueSession: jest.fn(),
}));

jest.mock("@/lib/sessionUtils", () => ({
  getDisplaySessionName: jest.fn(),
}));

jest.mock("@/components/SessionStatusBadge", () => ({
  __esModule: true,
  SessionStatusBadge: ({ currentStatus }: { currentStatus: string }) => (
    <div data-testid="session-status-badge">{currentStatus}</div>
  ),
  default: ({ currentStatus }: { currentStatus: string }) => (
    <div data-testid="session-status-badge">{currentStatus}</div>
  ),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
  useMessagesTranslation: jest.fn(),
}));

describe("DeadSimpleSessionBanner", () => {
  const organizationSettingsMock = useOrganizationSettings as unknown as jest.Mock;
  const getRelativeDateMock: Mocked<typeof getRelativeDate> = getRelativeDate as any;
  const isOverdueSessionMock: Mocked<typeof isOverdueSession> = isOverdueSession as any;
  const getDisplaySessionNameMock: Mocked<typeof getDisplaySessionName> = getDisplaySessionName as any;
  const useFormsTranslationMock: jest.MockedFunction<typeof useFormsTranslation> = useFormsTranslation as any;
  const useMessagesTranslationMock: jest.MockedFunction<typeof useMessagesTranslation> = useMessagesTranslation as any;

  const translations = {
    "relativeDates.today": "Today",
    "relativeDates.tomorrow": "Tomorrow",
    "relativeDates.yesterday": "Yesterday",
    "relativeDates.past_due": "Past due",
    "sessionLabels.project": "Project",
  } as const;

  const baseSession = {
    id: "session-1",
    session_name: "Strategy Session",
    session_date: "2024-10-20",
    session_time: "09:30",
    status: "planned" as const,
    lead_id: "lead-1",
  };

  beforeEach(() => {
    organizationSettingsMock.mockReturnValue({ settings: { time_format: "12h" } });
    getDisplaySessionNameMock.mockReturnValue("Strategy Session");
    const translator = {
      t: (key: string) => translations[key as keyof typeof translations] ?? key,
    };

    useFormsTranslationMock.mockReturnValue(translator);
    useMessagesTranslationMock.mockReturnValue(translator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows today's indicator and triggers click handler", () => {
    getRelativeDateMock.mockReturnValue("Today");
    isOverdueSessionMock.mockReturnValue(false);

    const onClick = jest.fn();

    render(
      <DeadSimpleSessionBanner
        session={{ ...baseSession, notes: "Discuss roadmap" }}
        onClick={onClick}
      />
    );

    const todayLabels = screen.getAllByText("Today");
    expect(todayLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Strategy Session")).toBeInTheDocument();
    expect(screen.getByText("Discuss roadmap")).toBeInTheDocument();
    expect(screen.getByText("09:30 AM")).toBeInTheDocument();
    expect(screen.getByTestId("session-status-badge").textContent).toBe("planned");

    fireEvent.click(screen.getByText("Strategy Session"));

    expect(onClick).toHaveBeenCalledWith("session-1");
  });

  it("renders overdue state with project name and badge", () => {
    getRelativeDateMock.mockReturnValue("Next Week");
    isOverdueSessionMock.mockReturnValue(true);
    getDisplaySessionNameMock.mockReturnValue("Planning Call");

    const onClick = jest.fn();

    render(
      <DeadSimpleSessionBanner
        session={{
          ...baseSession,
          id: "session-2",
          session_name: "Planning Call",
          session_date: "2024-10-01",
          session_time: undefined,
          status: "no_show",
          projects: { name: "Q4 Launch" },
        }}
        onClick={onClick}
      />
    );

    expect(screen.getByText("Past due")).toBeInTheDocument();
    expect(screen.getByText("Project: Q4 Launch")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Planning Call"));

    expect(onClick).toHaveBeenCalledWith("session-2");
  });
});
