import { fireEvent, render, screen } from "@/utils/testUtils";
import SessionBanner from "../SessionBanner";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useSessionActions } from "@/hooks/useSessionActions";

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
}));

jest.mock("@/hooks/useSessionActions", () => ({
  useSessionActions: jest.fn(),
}));

type MockStatusBadgeProps = {
  currentStatus: string;
  onStatusChange?: (status: string) => void;
};

jest.mock("@/components/SessionStatusBadge", () => ({
  __esModule: true,
  default: ({ currentStatus, onStatusChange }: MockStatusBadgeProps) => (
    <button
      data-testid="session-status-badge"
      onClick={() => onStatusChange?.("completed")}
    >
      Status: {currentStatus}
    </button>
  ),
}));

describe("SessionBanner", () => {
  const mockUpdateSessionStatus = jest.fn();

  beforeAll(() => {
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "en-US",
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (useFormsTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key,
    });
    (useSessionActions as jest.Mock).mockReturnValue({
      updateSessionStatus: mockUpdateSessionStatus,
    });
  });

  it("renders planned session details and triggers callbacks", () => {
    const onStatusUpdate = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    render(
      <SessionBanner
        session={{
          id: "session-1",
          session_date: "2024-05-15",
          session_time: "14:30",
          notes: "Bring props",
          status: "planned",
        }}
        leadName="Jamie Doe"
        projectName="Project Phoenix"
        onStatusUpdate={onStatusUpdate}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText("sessions.photoSession")).toBeInTheDocument();
    expect(
      screen.getByText(/sessions\.projectLabel: Project Phoenix/)
    ).toBeInTheDocument();
    expect(screen.getByText("Wed, May 15, 2024")).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.trim() === "02:30 PM")
    ).toBeInTheDocument();
    expect(screen.getByText(/"Bring props"/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("session-status-badge"));
    expect(onStatusUpdate).toHaveBeenCalledWith("completed");

    const editButton = screen
      .getAllByRole("button")
      .find((button) => button.querySelector('.lucide-square-pen'));
    expect(editButton).toBeDefined();
    fireEvent.click(editButton!);
    expect(onEdit).toHaveBeenCalled();

    const deleteButton = screen
      .getAllByRole("button")
      .find((button) => button.querySelector('.lucide-trash2'));
    expect(deleteButton).toBeDefined();
    fireEvent.click(deleteButton!);
    expect(onDelete).toHaveBeenCalled();
  });

  it("disables edit when session is not planned", () => {
    const onEdit = jest.fn();

    render(
      <SessionBanner
        session={{
          id: "session-2",
          session_date: "2024-06-01",
          session_time: "09:00",
          notes: "",
          status: "completed",
        }}
        leadName="Jamie Doe"
        onEdit={onEdit}
        showActions
      />
    );

    expect(
      screen.getByText("This session has been marked as completed")
    ).toBeInTheDocument();

    const editButton = screen
      .getAllByRole("button")
      .find((button) => button.querySelector('.lucide-square-pen'));
    expect(editButton).toBeDefined();
    expect(editButton).toBeDisabled();
    fireEvent.click(editButton!);
    expect(onEdit).not.toHaveBeenCalled();
  });
});
