import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { mockSupabaseClient } from "@/utils/testUtils";
import SessionDetail from "../SessionDetail";
import { useToast } from "@/hooks/use-toast";
import {
  useMessagesTranslation,
  useCommonTranslation,
  useFormsTranslation,
} from "@/hooks/useTypedTranslation";
import { useSessionActions } from "@/hooks/useSessionActions";

jest.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient,
}));

const mockNavigate = jest.fn();
let mockLocationState: { from?: string } = {};

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "session-123" }),
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: mockLocationState }),
  };
});

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useMessagesTranslation: jest.fn(),
  useCommonTranslation: jest.fn(),
  useFormsTranslation: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => `pages.${key}`,
  }),
}));

jest.mock("@/hooks/useSessionActions", () => ({
  useSessionActions: jest.fn(),
}));

jest.mock("@/components/SessionStatusBadge", () => ({
  __esModule: true,
  default: ({ currentStatus, onStatusChange }: any) => (
    <button
      type="button"
      data-testid="session-status-badge"
      aria-label={`status-${currentStatus}`}
      onClick={() => onStatusChange?.("completed")}
    >
      status-{currentStatus}
    </button>
  ),
}));

jest.mock("@/components/EditSessionDialog", () => ({
  __esModule: true,
  default: () => <div data-testid="edit-session-dialog" />,
}));

jest.mock("@/components/ErrorBoundary", () => ({
  __esModule: true,
  ErrorBoundary: ({ children }: any) => <>{children}</>,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock("@/components/UnifiedClientDetails", () => ({
  UnifiedClientDetails: ({ lead }: any) => (
    <div data-testid="unified-client-details">lead-{lead?.name}</div>
  ),
}));

jest.mock("@/components/SessionGallery", () => ({
  __esModule: true,
  default: ({ sessionId }: any) => (
    <div data-testid="session-gallery">gallery-{sessionId}</div>
  ),
}));

jest.mock("@/components/EntityHeader", () => ({
  EntityHeader: ({ name, title, onBack, actions, banner, summaryItems }: any) => (
    <div data-testid="entity-header">
      <h1>{name}</h1>
      <button type="button" onClick={onBack}>
        back
      </button>
      <div data-testid="entity-title">{title}</div>
      <div data-testid="entity-actions">{actions}</div>
      {banner ? <div data-testid="entity-banner">{banner}</div> : null}
      <div data-testid="entity-summary">{summaryItems?.length}</div>
    </div>
  ),
}));

jest.mock("@/components/project-details/ProjectDetailsLayout", () => ({
  __esModule: true,
  default: ({ left, sections, rightFooter }: any) => (
    <div data-testid="project-details-layout">
      <div data-testid="layout-left">{left}</div>
      <div data-testid="layout-sections">
        {sections?.map((section: any) => (
          <div key={section.id} data-testid={`section-${section.id}`}>
            <span>{section.title}</span>
            <div>{section.content}</div>
          </div>
        ))}
      </div>
      <div data-testid="layout-footer">{rightFooter}</div>
    </div>
  ),
}));

jest.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  AlertDialogAction: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children }: any) => <button type="button">{children}</button>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
}));

const mockUseToast = useToast as jest.Mock;
const mockUseMessagesTranslation = useMessagesTranslation as jest.Mock;
const mockUseCommonTranslation = useCommonTranslation as jest.Mock;
const mockUseFormsTranslation = useFormsTranslation as jest.Mock;
const mockUseSessionActions = useSessionActions as jest.Mock;

const mockToast = jest.fn();
const mockDeleteSession = jest.fn();

const buildQueryMock = (singleResponse: any) => {
  const query: any = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.single = jest.fn().mockResolvedValue(singleResponse);
  return query;
};

describe("SessionDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocationState = {};
    mockNavigate.mockReset();
    (mockSupabaseClient.from as jest.Mock).mockReset();
    mockToast.mockReset();
    mockDeleteSession.mockReset();
    mockUseToast.mockReturnValue({ toast: mockToast });
    mockUseMessagesTranslation.mockReturnValue({
      t: (key: string) => `messages.${key}`,
    });
    mockUseCommonTranslation.mockReturnValue({
      t: (key: string) => `common.${key}`,
    });
    mockUseFormsTranslation.mockReturnValue({
      t: (key: string) => `forms.${key}`,
    });
    mockUseSessionActions.mockReturnValue({
      deleteSession: mockDeleteSession,
    });
  });

  const mockSessionData = {
    id: "session-123",
    session_name: "Strategy Session",
    session_date: "2024-05-01",
    session_time: "10:00",
    notes: "Discuss project details",
    location: "Studio",
    status: "planned",
    lead_id: "lead-1",
    project_id: "project-1",
    user_id: "user-1",
    leads: {
      id: "lead-1",
      name: "Taylor Swift",
      email: "taylor@example.com",
      phone: "+123456789",
      notes: "VIP",
    },
    projects: {
      id: "project-1",
      name: "Launch",
      project_types: {
        name: "Portrait",
      },
    },
  };

  it("shows loading skeleton before rendering fetched session details", async () => {
    const query = buildQueryMock({ data: mockSessionData, error: null });
    (mockSupabaseClient.from as jest.Mock).mockImplementation(() => query);

    const { container } = render(<SessionDetail />);

    expect(
      container.querySelectorAll('[class*=\"animate-pulse\"]').length
    ).toBeGreaterThan(0);

    const statusBadge = await screen.findByTestId("session-status-badge");

    expect(query.select).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith("id", "session-123");

    await waitFor(() => {
      expect(container.querySelectorAll('[class*=\"animate-pulse\"]').length).toBe(0);
    });

    expect(screen.getByTestId("entity-header")).toBeInTheDocument();
    expect(statusBadge).toHaveAttribute(
      "aria-label",
      "status-planned"
    );
    expect(screen.getByTestId("unified-client-details")).toHaveTextContent(
      "lead-Taylor Swift"
    );
    expect(screen.getByTestId("session-gallery")).toHaveTextContent(
      "gallery-session-123"
    );
    expect(screen.getByTestId("layout-footer")).toHaveTextContent(
      "pages.sessionDetail.dangerZone.button"
    );
  });

  it("surfaces a toast and empty state when the session fetch fails", async () => {
    const query = buildQueryMock({
      data: null,
      error: new Error("Failed to load"),
    });
    (mockSupabaseClient.from as jest.Mock).mockImplementation(() => query);

    render(<SessionDetail />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "common.toast.error",
          description: "pages.sessionDetail.toast.loadErrorDescription",
          variant: "destructive",
        })
      );
    });

    expect(
      screen.getByText("pages.sessionDetail.emptyState.title")
    ).toBeInTheDocument();
    expect(
      screen.getByText("pages.sessionDetail.emptyState.description")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "pages.sessionDetail.emptyState.cta",
      })
    ).toBeInTheDocument();
  });

  it("confirms deletion and navigates using the fallback route when the delete succeeds", async () => {
    mockLocationState = { from: "/calendar" };
    mockDeleteSession.mockResolvedValueOnce(true);
    const query = buildQueryMock({ data: mockSessionData, error: null });
    (mockSupabaseClient.from as jest.Mock).mockImplementation(() => query);

    render(<SessionDetail />);

    const openDeleteButton = await screen.findByRole("button", {
      name: "pages.sessionDetail.dangerZone.button",
    });
    fireEvent.click(openDeleteButton);

    const confirmButton = await screen.findAllByRole("button", {
      name: "pages.sessionDetail.dangerZone.button",
    });
    fireEvent.click(confirmButton[confirmButton.length - 1]);

    await waitFor(() => {
      expect(mockDeleteSession).toHaveBeenCalledWith("session-123");
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/calendar");
    });
  });
});
