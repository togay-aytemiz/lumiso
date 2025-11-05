import { render, screen, fireEvent, waitFor } from "@/utils/testUtils";
import { ProjectActivitySection } from "@/components/ProjectActivitySection";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { toast } from "@/hooks/use-toast";

jest.mock("@/integrations/supabase/client", () => {
  const createChannelMock = () => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
  });

  return {
    supabase: {
      from: jest.fn(),
      auth: {
        getUser: jest.fn(),
      },
      channel: jest.fn(() => createChannelMock()),
      removeChannel: jest.fn(),
    },
  };
});

jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn()
}));

jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: jest.fn()
}));

type ActivityFormProps = {
  onSubmit: (content: string, isReminder: boolean, reminderDate?: string | null) => void;
  placeholder: string;
};

jest.mock("@/components/shared/ActivityForm", () => ({
  ActivityForm: ({ onSubmit, placeholder }: ActivityFormProps) => {
    return (
      <div>
        <p>{placeholder}</p>
        <button onClick={() => onSubmit("", false)}>submit-empty</button>
        <button onClick={() => onSubmit("New note", false)}>submit-note</button>
        <button onClick={() => onSubmit("Reminder detail", true, "2025-01-01T10:00")}>
          submit-reminder
        </button>
      </div>
    );
  }
}));

type ActivityTimelineProps = {
  activities: Array<{ id: string; content: string; completed: boolean }>;
  onToggleCompletion: (id: string, completed: boolean) => void;
};

jest.mock("@/components/shared/ActivityTimeline", () => ({
  ActivityTimeline: ({ activities, onToggleCompletion }: ActivityTimelineProps) => (
    <div>
      {activities.map((activity) => (
        <div key={activity.id}>
          <span>{activity.content}</span>
          <button onClick={() => onToggleCompletion(activity.id, !activity.completed)}>
            toggle-{activity.id}
          </button>
        </div>
      ))}
    </div>
  )
}));

type SegmentedControlOption = {
  value: string;
  label: string;
};

type SegmentedControlProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SegmentedControlOption[];
};

jest.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: ({ value, onValueChange, options }: SegmentedControlProps) => (
    <div>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-testid={`segment-${option.value}`}
          onClick={() => onValueChange(option.value)}
        >
          {option.label}
        </button>
      ))}
      <span data-testid="current-segment">{value}</span>
    </div>
  ),
}));

const translations: Record<string, string> = {
  "projectDetails.activities.title": "Project activity",
  "projectDetails.activities.placeholder": "Log a note",
  "activitiesHistory.title": "Activities & History",
  "activitiesHistory.activity": "Activity",
  "activitiesHistory.history": "History",
  "activitiesHistory.noActivitiesYet": "No activities yet",
  "activitiesHistory.noHistoryAvailable": "No history available",
  "validation.required_field": "Required",
  "validation.content_required": "Content required",
  "validation.datetime_required_for_reminders": "Reminder needs a date",
  "success.saved": "Saved",
  "activity.note": "Note",
  "activity.reminder": "Reminder",
  "activity.added_to_project": "added to project",
  "activity.task_completed": "Task completed",
  "activity.task_incomplete": "Task incomplete",
  "activity.task_status_updated": "Task status updated",
  "activity.error_updating_task": "Error updating task",
  "error.generic": "Something went wrong",
  "activitiesHistory.historyMessages.notSet": "Not set",
  "activitiesHistory.historyMessages.changeTemplate": "{{label}} {{oldValue}} → {{newValue}}",
  "activitiesHistory.historyMessages.projectUnnamed": "Project",
  "activitiesHistory.historyMessages.projectCreated": "Project \"{{name}}\" created",
  "activitiesHistory.historyMessages.projectCreatedUnnamed": "Project created",
  "activitiesHistory.historyMessages.projectArchived": "Project \"{{name}}\" archived",
  "activitiesHistory.historyMessages.projectArchivedUnnamed": "Project archived",
  "activitiesHistory.historyMessages.projectRestored": "Project \"{{name}}\" restored",
  "activitiesHistory.historyMessages.projectRestoredUnnamed": "Project restored",
  "activitiesHistory.historyMessages.projectStageChanged": "Stage changed from \"{{oldStatus}}\" to \"{{newStatus}}\"",
  "activitiesHistory.historyMessages.projectRenamed": "Renamed from \"{{oldName}}\" to \"{{newName}}\"",
  "activitiesHistory.historyMessages.projectBasePriceChanged": "Base price changed from {{oldPrice}} to {{newPrice}}",
  "activitiesHistory.historyMessages.projectDescriptionUpdated": "Description updated",
  "activitiesHistory.historyMessages.projectTypeChanged": "Project type changed",
  "activitiesHistory.historyMessages.projectUpdatedWithChanges": "Project updated: {{changes}}",
  "activitiesHistory.historyMessages.projectUpdated": "Project updated",
  "activitiesHistory.historyMessages.sessionUntitled": "Session",
  "activitiesHistory.historyMessages.sessionCreated": "Session \"{{name}}\" created",
  "activitiesHistory.historyMessages.sessionUpdated": "Session \"{{name}}\" updated: {{changes}}",
  "activitiesHistory.historyMessages.sessionUpdatedSimple": "Session \"{{name}}\" updated",
  "activitiesHistory.historyMessages.sessionDeleted": "Session \"{{name}}\" deleted",
  "activitiesHistory.historyMessages.sessionFieldLabels.session_date": "Date",
  "activitiesHistory.historyMessages.sessionFieldLabels.session_time": "Time",
  "activitiesHistory.historyMessages.sessionFieldLabels.session_name": "Name",
  "activitiesHistory.historyMessages.sessionFieldLabels.location": "Location",
  "activitiesHistory.historyMessages.sessionFieldLabels.status": "Status",
  "activitiesHistory.historyMessages.sessionFieldLabels.notes": "Notes",
  "activitiesHistory.historyMessages.sessionNotesUpdated": "Notes updated",
  "activitiesHistory.historyMessages.paymentRecorded": "Payment {{amount}} recorded{{detailsSuffix}}",
  "activitiesHistory.historyMessages.paymentUpdated": "Payment {{amount}} updated{{statusSuffix}}{{detailsSuffix}}",
  "activitiesHistory.historyMessages.paymentRemoved": "Payment {{amount}} removed{{detailsSuffix}}",
  "activitiesHistory.historyMessages.paymentStatusSuffix": " (Status: {{status}})",
  "activitiesHistory.historyMessages.paymentDetailsSuffix": " – {{details}}",
  "activitiesHistory.historyMessages.paymentUnknownAmount": "an unspecified amount",
  "activitiesHistory.historyMessages.todoUnnamed": "To-do item",
  "activitiesHistory.historyMessages.todoAdded": "To-do \"{{content}}\" added",
  "activitiesHistory.historyMessages.todoRemoved": "To-do \"{{content}}\" removed",
  "activitiesHistory.historyMessages.todoToggled": "To-do \"{{content}}\" marked as {{state}}",
  "activitiesHistory.historyMessages.todoStateCompleted": "completed",
  "activitiesHistory.historyMessages.todoStateIncomplete": "incomplete",
  "activitiesHistory.historyMessages.todoContentUpdated": "To-do content updated",
  "activitiesHistory.historyMessages.todoUpdated": "To-do \"{{content}}\" updated",
  "activitiesHistory.historyMessages.activityContentSuffix": ": {{content}}",
  "activitiesHistory.historyMessages.activityLabels.activity": "Activity",
  "activitiesHistory.historyMessages.activityLabels.note": "Note",
  "activitiesHistory.historyMessages.activityLabels.reminder": "Reminder",
  "activitiesHistory.historyMessages.activityAdded": "{{label}} added{{content}}",
  "activitiesHistory.historyMessages.activityUpdated": "{{label}} updated{{content}}",
  "activitiesHistory.historyMessages.activityRemoved": "{{label}} removed{{content}}",
  "activitiesHistory.historyMessages.serviceFallbackLabel": "Service",
  "activitiesHistory.historyMessages.serviceAdded": "{{label}} added to project",
  "activitiesHistory.historyMessages.serviceUpdated": "{{label}} updated",
  "activitiesHistory.historyMessages.serviceRemoved": "{{label}} removed from project",
  "activitiesHistory.historyMessages.genericChange": "{{entity}} {{action}}"
};

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const template = translations[key] ?? key;
      if (!params) return template;
      return template.replace(/{{\s*(\w+)\s*}}/g, (_, match: string) =>
        params[match]?.toString() ?? ""
      );
    }
  })
}));

describe("ProjectActivitySection", () => {
  const toastSpy = toast as jest.Mock;
  const insertSpy = jest.fn();
  const updateSpy = jest.fn();
  let activitiesResponse: Array<Record<string, unknown>> = [];
  let projectAuditLogs: Array<Record<string, unknown>> = [];

  beforeEach(() => {
    jest.clearAllMocks();
    insertSpy.mockReset();
    updateSpy.mockReset();
    toastSpy.mockReset();

    (supabase.channel as jest.Mock).mockImplementation(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    }));
    (supabase.removeChannel as jest.Mock).mockReset();

    projectAuditLogs = [
      {
        id: "audit-1",
        user_id: "user-1",
        entity_type: "project",
        entity_id: "project-1",
        action: "created",
        created_at: "2025-01-03T10:00:00.000Z",
        old_values: null,
        new_values: { name: "Wedding" }
      }
    ];

    activitiesResponse = [
      {
        id: "act-1",
        type: "note",
        content: "Kickoff call",
        created_at: "2025-01-01",
        lead_id: "lead-1",
        project_id: "project-1",
        user_id: "user-1",
        completed: false
      }
    ];

    insertSpy.mockImplementation(() => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: { id: "new-activity" }, error: null })
        }))
    }));

    updateSpy.mockImplementation(() => ({
      eq: jest.fn().mockResolvedValue({ error: null })
    }));

    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: "user-123" } }
    });

    (getUserOrganizationId as jest.Mock).mockResolvedValue("org-123");

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === "activities") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockImplementation(() =>
                  Promise.resolve({ data: activitiesResponse, error: null })
                )
              }))
            }))
          })),
          insert: insertSpy,
          update: updateSpy
        };
      }
      if (table === "audit_log") {
        return {
          select: jest.fn(() => {
            const state: { entityType?: string; entityId?: string } = {};
            const chain = {
              eq: jest.fn((column: string, value: string) => {
                if (column === "entity_type") {
                  state.entityType = value;
                }
                if (column === "entity_id") {
                  state.entityId = value;
                }
                return chain;
              }),
              order: jest.fn(() => chain),
              limit: jest.fn(() =>
                Promise.resolve({
                  data:
                    state.entityType === "project" &&
                    state.entityId === "project-1"
                      ? projectAuditLogs
                      : [],
                  error: null,
                })
              ),
            };
            return chain;
          })
        };
      }
      if (table === "project_statuses" || table === "services") {
        return {
          select: jest.fn(() => ({
            in: jest.fn(() =>
              Promise.resolve({ data: [], error: null })
            )
          }))
        };
      }
      return {};
    });
  });

  function renderSection(onActivityUpdated = jest.fn()) {
    return render(
      <ProjectActivitySection
        projectId="project-1"
        leadId="lead-1"
        leadName="Jane Doe"
        projectName="Wedding"
        onActivityUpdated={onActivityUpdated}
      />
    );
  }

  test("renders fetched activities", async () => {
    renderSection();

    expect(await screen.findByText("Kickoff call")).toBeInTheDocument();
    expect(screen.getByText("Log a note")).toBeInTheDocument();
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  test("shows project history when toggled", async () => {
    renderSection();

    await screen.findByText("Kickoff call");

    fireEvent.click(screen.getByTestId("segment-history"));

    await waitFor(() => {
      expect(screen.getByText('Project "Wedding" created')).toBeInTheDocument();
    });
  });

  test("validates empty submission", async () => {
    renderSection();
    await screen.findByText("Kickoff call");

    fireEvent.click(screen.getByText("submit-empty"));

    expect(toastSpy).toHaveBeenCalledWith({
      title: "Required",
      description: "Content required",
      variant: "destructive"
    });
  });

  test("toggles completion status", async () => {
    const updatedSpy = jest.fn();
    renderSection(updatedSpy);

    await screen.findByText("Kickoff call");
    fireEvent.click(screen.getByText("toggle-act-1"));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({ completed: true });
      expect(toastSpy).toHaveBeenCalledWith({
        title: "Task completed",
        description: "Task status updated"
      });
    });

    expect(updatedSpy).toHaveBeenCalled();
  });
});
