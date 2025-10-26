import { render, screen } from "@/utils/testUtils";
import userEvent from "@testing-library/user-event";
import { ActivityTimeline } from "../shared/ActivityTimeline";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import React from "react";

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
}));

const mockReminderCard = jest.fn(
  ({ activity, projectName, onToggleCompletion }: any) => (
    <div data-testid={`reminder-${activity.id}`}>
      <span>{activity.content}</span>
      {projectName && (
        <span data-testid={`reminder-project-${activity.id}`}>{projectName}</span>
      )}
      <button
        data-testid={`reminder-toggle-${activity.id}`}
        onClick={() => onToggleCompletion(activity.id, !activity.completed)}
      >
        toggle
      </button>
    </div>
  )
);

const mockActivityTimelineItem = jest.fn(
  ({ id, content, projectName, onToggleCompletion, completed }: any) => (
    <div data-testid={`timeline-item-${id}`}>
      <span>{content}</span>
      {projectName && (
        <span data-testid={`timeline-project-${id}`}>{projectName}</span>
      )}
      {onToggleCompletion && (
        <button
          data-testid={`timeline-toggle-${id}`}
          onClick={() => onToggleCompletion(id, !completed)}
        >
          toggle
        </button>
      )}
    </div>
  )
);

jest.mock("@/components/ReminderCard", () => ({
  __esModule: true,
  default: (props: any) => mockReminderCard(props),
}));

jest.mock("@/components/shared/ActivityTimelineItem", () => ({
  __esModule: true,
  ActivityTimelineItem: (props: any) => mockActivityTimelineItem(props),
}));

describe("ActivityTimeline", () => {
  const useFormsTranslationMock =
    useFormsTranslation as jest.MockedFunction<typeof useFormsTranslation>;

  beforeEach(() => {
    useFormsTranslationMock.mockReturnValue({
      t: (key: string) => key,
    });
    mockReminderCard.mockClear();
    mockActivityTimelineItem.mockClear();
  });

  it("shows an empty state when there are no activities", () => {
    render(
      <ActivityTimeline
        activities={[]}
        leadName="Lead Name"
        onToggleCompletion={jest.fn()}
      />
    );

    expect(screen.getByText("activities.no_activities")).toBeInTheDocument();
  });

  it("renders reminders and notes with project context and forwards completion toggles", async () => {
    const user = userEvent.setup();
    const toggleCompletion = jest.fn();
    const activities = [
      {
        id: "reminder-1",
        type: "reminder",
        content: "Follow up with client",
        reminder_date: "2025-01-10T12:00:00.000Z",
        reminder_time: "12:00",
        created_at: "2025-01-09T04:00:00.000Z",
        completed: false,
        lead_id: "lead-1",
        user_id: "user-1",
        project_id: "project-1",
      },
      {
        id: "note-1",
        type: "note",
        content: "Client prefers morning calls",
        created_at: "2025-01-08T12:00:00.000Z",
        completed: true,
        lead_id: "lead-1",
        user_id: "user-1",
        project_id: "project-2",
      },
    ];

    render(
      <ActivityTimeline
        activities={activities as any}
        projects={[
          { id: "project-1", name: "Project Phoenix" },
          { id: "project-2", name: "Project Atlas" },
        ]}
        leadName="Lead Name"
        onToggleCompletion={toggleCompletion}
      />
    );

    expect(mockReminderCard).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: expect.objectContaining({ id: "reminder-1" }),
        leadName: "Lead Name",
        projectName: "Project Phoenix",
        onToggleCompletion: expect.any(Function),
        hideStatusBadge: expect.any(Boolean),
      })
    );

    expect(
      screen.getByTestId("reminder-project-reminder-1")
    ).toHaveTextContent("Project Phoenix");

    expect(mockActivityTimelineItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "note-1",
        content: "Client prefers morning calls",
        projectName: "Project Atlas",
        onToggleCompletion: undefined,
      })
    );

    expect(
      screen.queryByTestId("timeline-toggle-note-1")
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId("reminder-toggle-reminder-1"));

    expect(toggleCompletion).toHaveBeenCalledWith("reminder-1", true);
  });
});
