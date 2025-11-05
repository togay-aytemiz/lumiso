import { render, screen, fireEvent, waitFor } from "@/utils/testUtils";
import { ProjectActivitySection } from "@/components/ProjectActivitySection";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { toast } from "@/hooks/use-toast";

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn()
    }
  }
}));

jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn()
}));

jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: jest.fn()
}));

const activityFormSubmitRef: { current?: (...args: any[]) => void } = {};

jest.mock("@/components/shared/ActivityForm", () => ({
  ActivityForm: ({ onSubmit, placeholder }: any) => {
    activityFormSubmitRef.current = onSubmit;
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

jest.mock("@/components/shared/ActivityTimeline", () => ({
  ActivityTimeline: ({ activities, onToggleCompletion }: any) => (
    <div>
      {activities.map((activity: any) => (
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

jest.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: ({ value, onValueChange, options }: any) => (
    <div>
      {options.map((option: any) => (
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
  "activityLogs.status_changed_from_to": "Stage changed from \"{{oldStatus}}\" to \"{{newStatus}}\""
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
  let activitiesResponse: any[] = [];
  let projectAuditLogs: any[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    insertSpy.mockReset();
    updateSpy.mockReset();
    toastSpy.mockReset();

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
            const layer: any = {
              eq: jest.fn((column: string, value: string) => {
                if (column === "entity_type") {
                  state.entityType = value;
                }
                if (column === "entity_id") {
                  state.entityId = value;
                }
                return layer;
              }),
              contains: jest.fn(() => ({
                order: jest.fn(() =>
                  Promise.resolve({ data: [], error: null })
                )
              })),
              order: jest.fn(() =>
                Promise.resolve({
                  data:
                    state.entityType === "project" &&
                    state.entityId === "project-1"
                      ? projectAuditLogs
                      : [],
                  error: null
                })
              )
            };
            return layer;
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

  test("saves reminder and toggles completion", async () => {
    const updatedSpy = jest.fn();
    renderSection(updatedSpy);

    await screen.findByText("Kickoff call");
    expect(activityFormSubmitRef.current).toBeDefined();

    activitiesResponse = [
      ...activitiesResponse,
      {
        id: "act-2",
        type: "reminder",
        content: "Reminder detail",
        created_at: "2025-01-02",
        lead_id: "lead-1",
        project_id: "project-1",
        user_id: "user-123",
        completed: false
      }
    ];

    activityFormSubmitRef.current?.("Reminder detail", true, "2025-01-01T10:00");

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalled();
    });

    expect(insertSpy).toHaveBeenCalledWith({
      user_id: "user-123",
      lead_id: "lead-1",
      project_id: "project-1",
      type: "reminder",
      content: "Reminder detail",
      reminder_date: "2025-01-01",
      reminder_time: "10:00",
      organization_id: "org-123"
    });

    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({
      title: "Saved",
      description: "Reminder added to project.",
      variant: undefined
    }));

    expect(updatedSpy).toHaveBeenCalled();
    expect(await screen.findByText("Reminder detail")).toBeInTheDocument();

    fireEvent.click(screen.getByText("toggle-act-2"));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({ completed: true });
      expect(toastSpy).toHaveBeenCalledWith({
        title: "Task completed",
        description: "Task status updated"
      });
    });
  });
});
