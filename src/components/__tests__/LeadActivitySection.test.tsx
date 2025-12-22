import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { LeadActivitySection } from "../LeadActivitySection";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { toast } from "@/hooks/use-toast";
import { useProjectSheetController } from "@/hooks/useProjectSheetController";

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(() => ({ toast: jest.fn() })),
  toast: jest.fn(),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
}));

jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: jest.fn(),
}));

jest.mock("@/hooks/useProjectSheetController", () => ({
  useProjectSheetController: jest.fn(),
}));

jest.mock("@/components/ProjectSheetView", () => ({
  ProjectSheetView: () => <div data-testid="project-sheet-view" />,
}));

const translationMap: Record<string, string> = {
  "activitiesHistory.historyMessages.projectCreated": 'Project "{{name}}" created',
  "activitiesHistory.historyMessages.sessionCreated": 'Session "{{name}}" created',
  "activityLogs.lead_created": "Lead created",
  "success.saved": "Saved successfully",
  "activity.note": "Note",
  "activity.added_to_lead": "added to the lead successfully",
  "reminders.markCompleteSuccessTitle": "Reminder marked as completed",
  "reminders.statusUpdateDescription": "Reminder status updated successfully.",
};

const interpolateTranslation = (
  template: string,
  options?: Record<string, unknown>
) => {
  if (!options) {
    return template;
  }

  return template.replace(/{{(\w+)}}/g, (_match, key) =>
    Object.prototype.hasOwnProperty.call(options, key)
      ? String(options[key])
      : ""
  );
};

type ActivityFormProps = {
  onSubmit: (content: string, isReminder: boolean) => void;
};

type ActivityRecord = {
  id: string;
  content: string;
  completed: boolean;
} & Record<string, unknown>;

type ActivityTimelineProps = {
  activities: ActivityRecord[];
  onToggleCompletion?: (id: string, completed: boolean) => void;
};

type SegmentedOption = {
  value: string;
  label: string;
};

type SegmentedControlProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SegmentedOption[];
};

jest.mock("@/components/shared/ActivityForm", () => ({
  ActivityForm: ({ onSubmit }: ActivityFormProps) => (
    <div>
      <button type="button" data-testid="submit-activity" onClick={() => onSubmit("Mock activity", false)}>
        submit-activity
      </button>
    </div>
  ),
}));

jest.mock("@/components/shared/ActivityTimeline", () => ({
  ActivityTimeline: ({ activities, onToggleCompletion }: ActivityTimelineProps) => (
    <div>
      {activities.map((activity) => (
        <div key={activity.id}>
          <span>{activity.content}</span>
          {onToggleCompletion && (
            <button
              type="button"
              data-testid={`toggle-activity-${activity.id}`}
              onClick={() => onToggleCompletion(activity.id, !activity.completed)}
            >
              toggle
            </button>
          )}
        </div>
      ))}
    </div>
  ),
}));

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

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  },
}));

describe("LeadActivitySection", () => {
  const mockUseFormsTranslation = useFormsTranslation as jest.Mock;
  const mockProjectDialogController = useProjectSheetController as jest.Mock;
  const mockGetUserOrganizationId = getUserOrganizationId as jest.Mock;
  const supabaseFromMock = supabase.from as jest.Mock;
  const supabaseAuthGetUserMock = supabase.auth.getUser as jest.Mock;
  const toastMock = toast as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    toastMock.mockReset();

    mockUseFormsTranslation.mockReturnValue({
      t: (key: string, options?: Record<string, unknown>) => {
        const template = translationMap[key];
        if (!template) {
          return key;
        }
        return interpolateTranslation(template, options);
      },
    });
    mockGetUserOrganizationId.mockResolvedValue("org-123");
    supabaseAuthGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    mockProjectDialogController.mockReturnValue({
      viewingProject: null,
      projectSheetOpen: false,
      onProjectSheetOpenChange: jest.fn(),
      projectSheetLeadName: "Lead Name",
      openProjectSheet: jest.fn(),
    });
  });

  const setupSupabase = () => {
    const leadActivities = [
      {
        id: "lead-activity-1",
        type: "note",
        content: "Lead note",
        reminder_date: null,
        reminder_time: null,
        created_at: "2025-02-01T10:00:00.000Z",
        completed: false,
        lead_id: "lead-1",
        user_id: "user-1",
      },
    ];

    const projectActivities = [
      {
        id: "project-activity-1",
        type: "reminder",
        content: "Project reminder",
        reminder_date: "2025-02-05",
        reminder_time: "09:00",
        created_at: "2025-02-01T10:00:00.000Z",
        completed: true,
        lead_id: "lead-1",
        user_id: "user-1",
        project_id: "project-1",
      },
    ];

    const projects = [{ id: "project-1", name: "Project A" }];
    const projectIds = [{ id: "project-1" }];
    const sessions = [{ id: "session-1" }];

    const leadAuditLogs = [
      {
        id: "audit-1",
        user_id: "user-1",
        entity_type: "lead",
        entity_id: "lead-1",
        action: "created",
        created_at: "2025-02-01T10:00:00.000Z",
      },
    ];

    const projectAuditLogs = [
      {
        id: "audit-2",
        user_id: "user-1",
        entity_type: "project",
        entity_id: "project-1",
        action: "created",
        new_values: { name: "Project A" },
        created_at: "2025-02-02T10:00:00.000Z",
      },
    ];

    const sessionAuditLogs = [
      {
        id: "audit-3",
        user_id: "user-1",
        entity_type: "session",
        entity_id: "session-1",
        action: "created",
        new_values: { session_name: "Kickoff" },
        created_at: "2025-02-03T10:00:00.000Z",
      },
    ];

    let activitiesSelectCall = 0;
    const activitiesSelectMock = jest.fn(() => {
      const callIndex = activitiesSelectCall++;
      const leadResponse = { data: leadActivities, error: null };
      const projectResponse = { data: projectActivities, error: null };

      const createOrderMock = (response: typeof leadResponse) =>
        jest.fn(async () => response);

      return {
        eq: jest.fn(() => ({
          is: jest.fn(() => ({
            order: createOrderMock(callIndex === 1 ? projectResponse : leadResponse),
          })),
          not: jest.fn(() => ({
            order: createOrderMock(projectResponse),
          })),
          order: createOrderMock(callIndex === 1 ? projectResponse : leadResponse),
        })),
      };
    });

    const projectsSelectMock = jest.fn((fields: string) => {
      if (fields.includes("name")) {
        return {
          eq: jest.fn(() => Promise.resolve({ data: projects, error: null })),
        };
      }
      return {
        eq: jest.fn(() => Promise.resolve({ data: projectIds, error: null })),
      };
    });

    const sessionsSelectMock = jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ data: sessions, error: null })),
    }));

    let auditSelectCall = 0;
    const auditSelectMock = jest.fn(() => {
      const callIndex = auditSelectCall % 3;
      auditSelectCall += 1;

      if (callIndex === 0) {
        return {
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: leadAuditLogs, error: null })),
          })),
        };
      }

      if (callIndex === 1) {
        return {
          in: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: projectAuditLogs, error: null })),
          })),
        };
      }

      return {
        in: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: sessionAuditLogs, error: null })),
        })),
      };
    });

    const insertSingleMock = jest.fn(() => Promise.resolve({ data: { id: "new-activity" }, error: null }));
    const insertSelectMock = jest.fn(() => ({ single: insertSingleMock }));
    const insertMock = jest.fn(() => ({ select: insertSelectMock }));
    const updateEqMock = jest.fn(() => Promise.resolve({ error: null }));
    const updateMock = jest.fn(() => ({ eq: updateEqMock }));

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "activities") {
        return {
          select: activitiesSelectMock,
          insert: insertMock,
          update: updateMock,
        };
      }
      if (table === "projects") {
        return {
          select: projectsSelectMock,
        };
      }
      if (table === "sessions") {
        return {
          select: sessionsSelectMock,
        };
      }
      if (table === "audit_log") {
        return {
          select: auditSelectMock,
        };
      }
      return {};
    });

    return {
      insertMock,
      insertSelectMock,
      insertSingleMock,
      updateMock,
      updateEqMock,
      activitiesSelectMock,
    };
  };

  it("renders lead and project activities and toggles to history", async () => {
    setupSupabase();

    render(<LeadActivitySection leadId="lead-1" leadName="Jane Doe" />);

    await waitFor(() => {
      expect(screen.getByText("Lead note")).toBeInTheDocument();
      expect(screen.getByText("Project reminder")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("segment-history"));

    await waitFor(() => {
      expect(screen.getByText("Lead created")).toBeInTheDocument();
      expect(screen.getByText('Project "Project A" created')).toBeInTheDocument();
      expect(screen.getByText('Session "Kickoff" created')).toBeInTheDocument();
    });
  });

  it("submits a new activity and toggles completion", async () => {
    const { insertMock, updateMock, updateEqMock, activitiesSelectMock } = setupSupabase();
    const onActivityUpdated = jest.fn();

    render(<LeadActivitySection leadId="lead-1" leadName="Jane Doe" onActivityUpdated={onActivityUpdated} />);

    await waitFor(() => {
      expect(screen.getByText("Lead note")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("submit-activity"));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
        user_id: "user-1",
        lead_id: "lead-1",
        type: "note",
        content: "Mock activity",
        organization_id: "org-123",
      }));
    });

    expect(toastMock).toHaveBeenNthCalledWith(1, {
      title: "Saved successfully",
      description: "Note added to the lead successfully.",
    });

    expect(onActivityUpdated).toHaveBeenCalledTimes(1);
    expect(activitiesSelectMock).toHaveBeenCalledTimes(4);

    fireEvent.click(screen.getByTestId("toggle-activity-lead-activity-1"));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({ completed: true });
      expect(updateEqMock).toHaveBeenCalledWith("id", "lead-activity-1");
    });

    expect(toastMock).toHaveBeenNthCalledWith(2, {
      title: "Reminder marked as completed",
      description: "Reminder status updated successfully.",
    });

    expect(onActivityUpdated).toHaveBeenCalledTimes(2);
  });
});
