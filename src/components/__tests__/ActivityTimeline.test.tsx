import { render, screen } from "@/utils/testUtils";
import userEvent from "@testing-library/user-event";
import { ActivityTimeline } from "../shared/ActivityTimeline";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import React from "react";

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
}));

type ActivityItem = {
  id: string;
  type: "reminder" | "note";
  content: string;
  reminder_date?: string;
  reminder_time?: string;
  created_at: string;
  completed?: boolean;
  lead_id: string;
  user_id: string;
  project_id?: string;
};

type ReminderTimelineCardProps = {
  activity: ActivityItem;
  projectName?: string;
  leadName: string;
  onToggleCompletion: (id: string, completed: boolean) => void;
  onOpenLead?: () => void;
  onOpenProject?: () => void;
  showStatusIndicator?: boolean;
};

type ActivityTimelineItemProps = {
  id: string;
  content: string;
  projectName?: string;
  onToggleCompletion?: (id: string, completed: boolean) => void;
  completed?: boolean;
};

const mockReminderTimelineCard = jest.fn(
  ({
    activity,
    projectName,
    onToggleCompletion,
    onOpenLead,
    onOpenProject,
    showStatusIndicator,
  }: ReminderTimelineCardProps) => (
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
      {onOpenLead && (
        <button
          data-testid={`reminder-open-lead-${activity.id}`}
          onClick={() => onOpenLead()}
        >
          open lead
        </button>
      )}
      {onOpenProject && (
        <button
          data-testid={`reminder-open-project-${activity.id}`}
          onClick={() => onOpenProject()}
        >
          open project
        </button>
      )}
      <span data-testid={`status-indicator-${activity.id}`}>{String(showStatusIndicator)}</span>
    </div>
  )
);

const mockActivityTimelineItem = jest.fn(
  ({ id, content, projectName, onToggleCompletion, completed }: ActivityTimelineItemProps) => (
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

jest.mock("@/components/reminders/ReminderTimelineCard", () => ({
  __esModule: true,
  ReminderTimelineCard: (props: ReminderTimelineCardProps) =>
    mockReminderTimelineCard(props),
}));

jest.mock("@/components/shared/ActivityTimelineItem", () => ({
  __esModule: true,
  ActivityTimelineItem: (props: ActivityTimelineItemProps) => mockActivityTimelineItem(props),
}));

describe("ActivityTimeline", () => {
  const useFormsTranslationMock =
    useFormsTranslation as jest.MockedFunction<typeof useFormsTranslation>;

  beforeEach(() => {
    useFormsTranslationMock.mockReturnValue({
      t: (key: string) => key,
    });
    mockReminderTimelineCard.mockClear();
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
    const todayIso = new Date().toISOString();
    const activities: ActivityItem[] = [
      {
        id: "reminder-1",
        type: "reminder",
        content: "Follow up with client",
        reminder_date: todayIso,
        reminder_time: "12:00",
        created_at: todayIso,
        completed: false,
        lead_id: "lead-1",
        user_id: "user-1",
        project_id: "project-1",
      },
      {
        id: "note-1",
        type: "note",
        content: "Client prefers morning calls",
        created_at: todayIso,
        completed: true,
        lead_id: "lead-1",
        user_id: "user-1",
        project_id: "project-2",
      },
    ];

    const openLead = jest.fn();
    const openProject = jest.fn();

    render(
      <ActivityTimeline
        activities={activities}
        projects={[
          { id: "project-1", name: "Project Phoenix" },
          { id: "project-2", name: "Project Atlas" },
        ]}
        leadName="Lead Name"
        onToggleCompletion={toggleCompletion}
        onReminderLeadNavigate={openLead}
        onReminderProjectNavigate={openProject}
      />
    );

    expect(mockReminderTimelineCard).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: expect.objectContaining({ id: "reminder-1" }),
        leadName: "Lead Name",
        projectName: "Project Phoenix",
        onToggleCompletion: expect.any(Function),
        onOpenLead: expect.any(Function),
        onOpenProject: expect.any(Function),
        showStatusIndicator: false,
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

    await user.click(
      screen.getByTestId("reminder-open-project-reminder-1")
    );
    expect(openProject).toHaveBeenCalledWith("project-1");

    await user.click(screen.getByTestId("reminder-open-lead-reminder-1"));
    expect(openLead).toHaveBeenCalledWith("lead-1");

    expect(
      screen.getByText("activitiesHistory.dayLabels.today")
    ).toBeInTheDocument();
  });
});
