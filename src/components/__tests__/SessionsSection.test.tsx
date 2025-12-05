import { fireEvent, render, screen } from "@/utils/testUtils";
import { SessionsSection } from "../SessionsSection";
import { sortSessionsByLifecycle } from "@/lib/sessionSorting";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useNavigate, useLocation } from "react-router-dom";

type Session = Parameters<typeof SessionsSection>[0]["sessions"][number];

jest.mock("@/lib/sessionSorting", () => ({
  sortSessionsByLifecycle: jest.fn(),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
}));

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...(jest.requireActual("react-router-dom") as Record<string, unknown>),
  useNavigate: jest.fn(),
  useLocation: jest.fn(),
}));

const mockDeadSimpleSessionBanner = jest.fn(
  ({
    session,
    onClick,
    onViewDetails,
  }: { session: Session; onClick: () => void; onViewDetails?: (sessionId: string) => void }) => (
    <div>
      <button data-testid={`session-banner-${session.id}`} onClick={onClick}>
        banner-{session.id}
      </button>
      {onViewDetails ? (
        <button data-testid={`session-view-${session.id}`} onClick={() => onViewDetails(session.id)}>
          view-session
        </button>
      ) : null}
    </div>
  )
);

jest.mock("../DeadSimpleSessionBanner", () => ({
  __esModule: true,
  default: (props: { session: Session; onClick: () => void; onViewDetails?: (sessionId: string) => void }) =>
    mockDeadSimpleSessionBanner(props),
}));

const mockNewSessionDialogForProject = jest.fn(
  ({ onSessionScheduled }: { onSessionScheduled: () => void }) => (
    <button data-testid="new-session-dialog" onClick={onSessionScheduled}>
      schedule-session
    </button>
  )
);

jest.mock("../NewSessionDialogForProject", () => ({
  NewSessionDialogForProject: (props: { onSessionScheduled: () => void }) =>
    mockNewSessionDialogForProject(props),
}));

const mockEditSessionDialog = jest.fn(() => null);

jest.mock("../EditSessionDialog", () => ({
  __esModule: true,
  default: () => mockEditSessionDialog(),
}));

const mockSessionSheetView = jest.fn(
  ({
    isOpen,
    onOpenChange,
    onViewFullDetails,
    onSessionUpdated,
  }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onViewFullDetails: () => void;
    onSessionUpdated: () => void;
  }) => (
    <div data-testid="session-sheet-view" data-open={isOpen}>
      <button onClick={() => onOpenChange(false)}>close-sheet</button>
      <button onClick={onViewFullDetails}>view-details</button>
      <button onClick={onSessionUpdated}>sheet-updated</button>
    </div>
  )
);

jest.mock("../SessionSheetView", () => ({
  __esModule: true,
  default: (props: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onViewFullDetails: () => void;
    onSessionUpdated: () => void;
  }) => mockSessionSheetView(props),
}));

const mockSortSessionsByLifecycle = sortSessionsByLifecycle as jest.Mock;
const mockUseFormsTranslation = useFormsTranslation as jest.Mock;
const mockUseNavigate = useNavigate as jest.Mock;
const mockUseLocation = useLocation as jest.Mock;

const baseSession: Session = {
  id: "session-1",
  lead_id: "lead-1",
  project_id: "project-1",
  status: "scheduled",
  session_time: "10:00",
  session_date: "2025-01-01",
  notes: "",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

describe("SessionsSection", () => {
  const onSessionUpdated = jest.fn();
  const onDeleteSession = jest.fn();

  beforeEach(() => {
    mockSortSessionsByLifecycle.mockReset();
    mockUseFormsTranslation.mockReturnValue({
      t: (key: string, options?: Record<string, unknown>) =>
        options?.count ? `${key}:${options.count}` : key,
    });
    mockUseNavigate.mockReturnValue(mockNavigate);
    mockUseLocation.mockReturnValue({
      pathname: "/projects/abc",
      search: "",
      hash: "",
    });
    mockDeadSimpleSessionBanner.mockClear();
    mockNewSessionDialogForProject.mockClear();
    mockSessionSheetView.mockClear();
    mockNavigate.mockClear();
    onSessionUpdated.mockClear();
    onDeleteSession.mockClear();
  });

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

  it("renders loading skeleton when loading is true", () => {
    const { container } = render(
      <SessionsSection
        sessions={[]}
        loading
        leadId="lead-1"
        projectId="project-1"
        leadName="Lead"
        projectName="Project"
        onSessionUpdated={onSessionUpdated}
        onDeleteSession={onDeleteSession}
      />
    );

    expect(screen.getByText("sessions_form.title")).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse")).not.toHaveLength(0);
    expect(mockNewSessionDialogForProject).not.toHaveBeenCalled();
  });

  it("renders empty state when no sessions exist", () => {
    mockSortSessionsByLifecycle.mockReturnValue([]);

    render(
      <SessionsSection
        sessions={[]}
        loading={false}
        leadId="lead-1"
        projectId="project-1"
        leadName="Lead"
        projectName="Project"
        onSessionUpdated={onSessionUpdated}
        onDeleteSession={onDeleteSession}
      />
    );

    expect(mockNewSessionDialogForProject).toHaveBeenCalledWith(
      expect.objectContaining({ onSessionScheduled: expect.any(Function) })
    );
    expect(screen.getByText("sessions_form.no_sessions")).toBeInTheDocument();
    expect(screen.getByText("sessions_form.add_sessions_hint")).toBeInTheDocument();
  });

  it("renders sessions and wires interactions", () => {
    const sessions: Session[] = [
      { ...baseSession, id: "session-1", session_name: "Kickoff" },
      { ...baseSession, id: "session-2", session_name: "Wrap" },
    ];
    mockSortSessionsByLifecycle.mockReturnValue([
      sessions[1],
      sessions[0],
    ]);

    render(
      <SessionsSection
        sessions={sessions}
        loading={false}
        leadId="lead-1"
        projectId="project-1"
        leadName="Lead"
        projectName="Project"
        onSessionUpdated={onSessionUpdated}
        onDeleteSession={onDeleteSession}
      />
    );

    expect(mockSortSessionsByLifecycle).toHaveBeenCalledWith(sessions);
    const bannerButtons = [
      screen.getByTestId("session-banner-session-2"),
      screen.getByTestId("session-banner-session-1"),
    ];
    expect(bannerButtons[0]).toBeInTheDocument();

    expect(mockDeadSimpleSessionBanner).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        session: expect.objectContaining({ id: "session-2" }),
        onClick: expect.any(Function),
        onViewDetails: expect.any(Function),
      })
    );

    fireEvent.click(bannerButtons[0]);
    const sheet = screen.getByTestId("session-sheet-view");
    expect(sheet).toHaveAttribute("data-open", "true");

    fireEvent.click(screen.getByText("view-details"));
    expect(mockNavigate).toHaveBeenCalledWith("/sessions/session-2", {
      state: { from: "/projects/abc" },
    });

    fireEvent.click(screen.getByTestId("session-view-session-2"));
    expect(mockNavigate).toHaveBeenCalledWith("/sessions/session-2", {
      state: { from: "/projects/abc" },
    });

    fireEvent.click(screen.getByText("sheet-updated"));
    expect(onSessionUpdated).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("close-sheet"));
    expect(onSessionUpdated).toHaveBeenCalledTimes(2);
  });
});
