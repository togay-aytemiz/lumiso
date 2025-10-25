import { fireEvent, render, screen } from "@/utils/testUtils";
import ReminderCard from "../ReminderCard";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
}));

describe("ReminderCard", () => {
  const mockToggle = jest.fn();
  const mockClick = jest.fn();

  const baseActivity = {
    id: "reminder-1",
    content: "Follow up with client",
    reminder_date: "2000-05-19",
    reminder_time: "09:30",
    type: "reminder",
    lead_id: "lead-1",
    created_at: "2024-05-10T00:00:00Z",
    completed: false,
  };

  beforeEach(() => {
    (useFormsTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key,
    });
    mockToggle.mockReset();
    mockClick.mockReset();
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

  it("shows overdue badge for past reminders and toggles completion", () => {
    render(
      <ReminderCard
        activity={baseActivity}
        leadName="Jane Doe"
        onToggleCompletion={mockToggle}
        onClick={mockClick}
      />
    );

    expect(screen.getAllByText("reminders.overdue")[0]).toBeInTheDocument();
    expect(screen.getAllByText(/reminders\.lead: Jane Doe/)[0]).toBeInTheDocument();

    const toggleButtons = screen.getAllByTestId("toggle-completion");
    fireEvent.click(toggleButtons[0]);

    expect(mockToggle).toHaveBeenCalledWith("reminder-1", true);
    expect(mockClick).not.toHaveBeenCalled();
  });

  it("renders completed state with badge and handles card click", () => {
    const completedActivity = {
      ...baseActivity,
      completed: true,
      reminder_date: "2100-05-20",
    };

    render(
      <ReminderCard
        activity={completedActivity}
        leadName="Jane Doe"
        onToggleCompletion={mockToggle}
        onClick={mockClick}
        projectName="Engagement"
      />
    );

    expect(screen.getAllByText("reminders.completed")[0]).toBeInTheDocument();
    expect(screen.queryByText("reminders.overdue")).not.toBeInTheDocument();

    const heading = screen.getAllByText("Follow up with client")[0];
    expect(heading).toHaveClass("line-through");

    fireEvent.click(heading);
    expect(mockClick).toHaveBeenCalled();

    const toggleButtons = screen.getAllByTestId("toggle-completion");
    fireEvent.click(toggleButtons[0]);
    expect(mockToggle).toHaveBeenCalledWith("reminder-1", false);
  });
});
