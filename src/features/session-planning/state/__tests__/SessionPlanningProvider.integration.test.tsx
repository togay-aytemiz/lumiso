import { act, renderHook } from "@testing-library/react";
import { SessionPlanningProvider } from "../../context/SessionPlanningProvider";
import { useSessionPlanningActions } from "../../hooks/useSessionPlanningActions";
import { useSessionPlanningContext } from "../../hooks/useSessionPlanningContext";
import { SessionPlanningState } from "../../types";

const createWrapper =
  (entryContext = {}) =>
  ({ children }: { children: React.ReactNode }) =>
    <SessionPlanningProvider entryContext={entryContext}>{children}</SessionPlanningProvider>;

describe("SessionPlanningProvider integration", () => {
  it("supports create flow updates across steps", () => {
    const wrapper = createWrapper({
      entrySource: "dashboard",
    });

    const { result } = renderHook(
      () => ({
        actions: useSessionPlanningActions(),
        context: useSessionPlanningContext(),
      }),
      { wrapper }
    );

    act(() => {
      result.current.actions.updateLead({
        id: "lead-123",
        name: "Jordan Client",
        mode: "existing",
      });
      result.current.actions.updateProject({
        id: "project-456",
        name: "Autumn Wedding",
        mode: "existing",
        isSkipped: false,
      });
      result.current.actions.updateSessionType({
        id: "type-1",
        label: "Signature",
      });
      result.current.actions.updateSchedule({
        date: "2024-05-21",
        time: "10:30",
      });
      result.current.actions.updateNotifications({
        sendReminder: false,
        sendSummaryEmail: true,
      });
      result.current.actions.setCurrentStep("schedule");
    });

    const { state } = result.current.context;
    expect(state.lead.id).toBe("lead-123");
    expect(state.project.id).toBe("project-456");
    expect(state.sessionTypeId).toBe("type-1");
    expect(state.schedule).toEqual({ date: "2024-05-21", time: "10:30" });
    expect(state.notifications.sendReminder).toBe(false);
    expect(state.meta.currentStep).toBe("schedule");
    expect(state.meta.isDirty).toBe(true);

    act(() => {
      result.current.actions.markSaving(true);
      result.current.actions.markSaved("2024-05-20T12:00:00Z");
    });

    expect(result.current.context.state.meta.isSavingDraft).toBe(false);
    expect(result.current.context.state.meta.isDirty).toBe(false);
    expect(result.current.context.state.meta.lastSavedAt).toBe("2024-05-20T12:00:00Z");
  });

  it("hydrates edit mode state and applies reschedule changes", () => {
    const wrapper = createWrapper({
      mode: "edit",
      sessionId: "session-789",
      entrySource: "calendar",
      leadId: "lead-original",
      leadName: "Pat Client",
      projectId: "project-original",
      projectName: "Morning Shoot",
      defaultDate: "2024-05-22",
      defaultTime: "09:00",
    });

    const { result } = renderHook(
      () => ({
        actions: useSessionPlanningActions(),
        context: useSessionPlanningContext(),
      }),
      { wrapper }
    );

    const hydratedState: SessionPlanningState = {
      ...result.current.context.state,
      lead: { id: "lead-original", name: "Pat Client", mode: "existing" },
      project: {
        id: "project-original",
        name: "Morning Shoot",
        mode: "existing",
        isSkipped: false,
      },
      sessionTypeId: "type-legacy",
      sessionTypeLabel: "Legacy",
      schedule: { date: "2024-05-22", time: "09:00" },
      notifications: {
        sendReminder: true,
        sendSummaryEmail: false,
      },
    };

    act(() => {
      result.current.actions.applyState(hydratedState);
    });

    expect(result.current.context.state.meta.mode).toBe("edit");
    expect(result.current.context.state.meta.sessionId).toBe("session-789");
    expect(result.current.context.state.meta.isDirty).toBe(false);

    act(() => {
      result.current.actions.updateSchedule({
        date: "2024-05-23",
        time: "13:15",
      });
      result.current.actions.updateNotifications({
        sendReminder: true,
        sendSummaryEmail: true,
      });
      result.current.actions.markDirty(true);
      result.current.actions.setCurrentStep("summary");
    });

    const updated = result.current.context.state;
    expect(updated.schedule).toEqual({ date: "2024-05-23", time: "13:15" });
    expect(updated.notifications).toEqual({
      sendReminder: true,
      sendSummaryEmail: true,
    });
    expect(updated.meta.currentStep).toBe("summary");
    expect(updated.meta.isDirty).toBe(true);

    act(() => {
      result.current.actions.reset({
        mode: "create",
        entrySource: "dashboard",
      });
    });

    expect(result.current.context.state.meta.mode).toBe("create");
    expect(result.current.context.state.meta.isDirty).toBe(false);
  });
});
