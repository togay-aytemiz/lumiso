import { render, screen } from "@/utils/testUtils";
import userEvent from "@testing-library/user-event";
import { ActivityTimelineItem } from "../shared/ActivityTimelineItem";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
}));

describe("ActivityTimelineItem", () => {
  const useFormsTranslationMock =
    useFormsTranslation as jest.MockedFunction<typeof useFormsTranslation>;

  beforeEach(() => {
    useFormsTranslationMock.mockReturnValue({
      t: (key: string) =>
        ({
          "activities.types.note": "Note",
          "activities.types.reminder": "Reminder",
        }[key] ?? key),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders note type with project badge", () => {
    render(
      <ActivityTimelineItem
        id="activity-1"
        type="note"
        content="Captured discovery notes"
        projectName="Project Atlas"
      />
    );

    expect(screen.getByText("Note")).toBeInTheDocument();
    expect(screen.getByText("Project Atlas")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("toggles reminder completion when the control is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = jest.fn();

    render(
      <ActivityTimelineItem
        id="reminder-1"
        type="reminder"
        content="Follow up email"
        completed={false}
        onToggleCompletion={onToggle}
      />
    );

    await user.click(screen.getByRole("button"));

    expect(onToggle).toHaveBeenCalledWith("reminder-1", true);
  });

  it("applies completed styling to timeline content", () => {
    const { rerender } = render(
      <ActivityTimelineItem
        id="reminder-1"
        type="reminder"
        content="Follow up email"
        completed={false}
        onToggleCompletion={jest.fn()}
      />
    );

    expect(screen.getByText("Follow up email")).not.toHaveClass("line-through");

    rerender(
      <ActivityTimelineItem
        id="reminder-1"
        type="reminder"
        content="Follow up email"
        completed
        onToggleCompletion={jest.fn()}
      />
    );

    expect(screen.getByText("Follow up email")).toHaveClass("line-through");
  });
});
