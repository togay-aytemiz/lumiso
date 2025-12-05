import { fireEvent, render, screen } from "@/utils/testUtils";
import EnhancedSessionsSection from "../EnhancedSessionsSection";
import { sortSessionsByLifecycle } from "@/lib/sessionSorting";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

type Session = Parameters<typeof EnhancedSessionsSection>[0]["sessions"][number];

jest.mock("@/lib/sessionSorting", () => ({
  sortSessionsByLifecycle: jest.fn(),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
}));

const mockDeadSimpleSessionBanner = jest.fn(
  ({
    session,
    onClick,
    onViewDetails,
  }: {
    session: Session;
    onClick: (sessionId: string) => void;
    onViewDetails?: (sessionId: string) => void;
  }) => (
    <div>
      <button data-testid={`session-${session.id}`} onClick={() => onClick(session.id)}>
        banner-{session.id}
      </button>
      {onViewDetails ? (
        <button data-testid={`session-view-${session.id}`} onClick={() => onViewDetails(session.id)}>
          view
        </button>
      ) : null}
    </div>
  )
);

jest.mock("../DeadSimpleSessionBanner", () => ({
  __esModule: true,
  default: (props: {
    session: Session;
    onClick: (sessionId: string) => void;
    onViewDetails?: (sessionId: string) => void;
  }) => mockDeadSimpleSessionBanner(props),
}));

const mockSortSessionsByLifecycle = sortSessionsByLifecycle as jest.Mock;
const mockUseFormsTranslation = useFormsTranslation as jest.Mock;

describe("EnhancedSessionsSection", () => {
  const baseSession: Session = {
    id: "session-1",
    lead_id: "lead-1",
    project_id: "project-1",
    status: "planned",
    session_date: "2025-01-01",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  } as Session;

  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  beforeEach(() => {
    mockSortSessionsByLifecycle.mockReset();
    mockDeadSimpleSessionBanner.mockClear();
    mockUseFormsTranslation.mockReturnValue({
      t: (key: string) => key,
    });
  });

  it("renders loading skeleton when loading is true", () => {
    const { container } = render(
      <EnhancedSessionsSection
        sessions={[]}
        loading
        onSessionClick={jest.fn()}
      />
    );

    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(mockDeadSimpleSessionBanner).not.toHaveBeenCalled();
  });

  it("renders nothing when there are no sessions", () => {
    const { container } = render(
      <EnhancedSessionsSection
        sessions={[]}
        loading={false}
        onSessionClick={jest.fn()}
      />
    );

    expect(screen.queryByText("sessions_form.title")).not.toBeInTheDocument();
    expect(container.querySelector("[data-testid^='session-']")).toBeNull();
    expect(mockSortSessionsByLifecycle).not.toHaveBeenCalled();
    expect(mockDeadSimpleSessionBanner).not.toHaveBeenCalled();
  });

  it("renders sorted sessions with count badge and click wiring", () => {
    const onSessionClick = jest.fn();
    const sessions: Session[] = [
      { ...baseSession, id: "session-1", session_name: "First" },
      { ...baseSession, id: "session-2", session_name: "Second" },
    ];
    const sorted: Session[] = [sessions[1], sessions[0]];
    mockSortSessionsByLifecycle.mockReturnValue(sorted);

    render(
      <EnhancedSessionsSection
        sessions={sessions}
        loading={false}
        onSessionClick={onSessionClick}
      />
    );

    expect(mockSortSessionsByLifecycle).toHaveBeenCalledWith(sessions);
    expect(screen.getByText("sessions_form.title")).toBeInTheDocument();
    expect(screen.getByText(String(sessions.length))).toBeInTheDocument();
    expect(mockDeadSimpleSessionBanner).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ session: sorted[0], onClick: onSessionClick })
    );
    expect(mockDeadSimpleSessionBanner).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ session: sorted[1], onClick: onSessionClick })
    );

    fireEvent.click(screen.getByTestId("session-session-2"));
    expect(onSessionClick).toHaveBeenCalledWith("session-2");
  });
});
