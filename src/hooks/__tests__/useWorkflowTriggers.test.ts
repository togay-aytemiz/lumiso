jest.mock("@/integrations/supabase/client", () => {
  const invoke = jest.fn();
  return {
    supabase: {
      functions: {
        invoke,
      },
    },
    __esModule: true,
    _invokeMock: invoke,
  };
});

const toastMock = jest.fn();

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { useWorkflowTriggers } from "../useWorkflowTriggers";
import { supabase } from "@/integrations/supabase/client";

const VALID_SESSION_ID = "123e4567-e89b-12d3-a456-426614174000";
const VALID_ORG_ID = "123e4567-e89b-12d3-a456-426614174001";
const invokeMock = supabase.functions.invoke as jest.Mock;

const getDateOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const FUTURE_SESSION_DATE = getDateOffset(2);
const PAST_SESSION_DATE = getDateOffset(-2);

beforeEach(() => {
  invokeMock.mockReset();
  toastMock.mockReset();
});

describe("useWorkflowTriggers", () => {
  describe("triggerWorkflow", () => {
    it("rejects when required parameters are missing", async () => {
      const { triggerWorkflow } = useWorkflowTriggers();

      await expect(
        triggerWorkflow("session_scheduled", "session", "", VALID_ORG_ID)
      ).rejects.toThrow("Missing required parameters");
      expect(invokeMock).not.toHaveBeenCalled();
    });

    it("rejects when ids fail UUID validation", async () => {
      const { triggerWorkflow } = useWorkflowTriggers();

      await expect(
        triggerWorkflow("session_scheduled", "session", "not-a-uuid", VALID_ORG_ID)
      ).rejects.toThrow("Invalid entity ID format");

      await expect(
        triggerWorkflow("session_scheduled", "session", VALID_SESSION_ID, "invalid-org")
      ).rejects.toThrow("Invalid organization ID format");

      expect(invokeMock).not.toHaveBeenCalled();
    });

    it("surfaces Supabase errors and shows a destructive toast", async () => {
      const { triggerWorkflow } = useWorkflowTriggers();

      const supabaseError = new Error("RPC exploded");
      invokeMock.mockResolvedValueOnce({ data: null, error: supabaseError });

      await expect(
        triggerWorkflow("session_completed", "session", VALID_SESSION_ID, VALID_ORG_ID)
      ).rejects.toThrow("RPC exploded");

      expect(toastMock).toHaveBeenCalledWith({
        title: "Workflow Error",
        description: "RPC exploded",
        variant: "destructive",
      });
    });

    it("does not toast when Supabase reports no workflows", async () => {
      const { triggerWorkflow } = useWorkflowTriggers();

      const noWorkflowError = new Error("No workflows found for this trigger");
      invokeMock.mockResolvedValueOnce({ data: null, error: noWorkflowError });

      await expect(
        triggerWorkflow("session_completed", "session", VALID_SESSION_ID, VALID_ORG_ID)
      ).rejects.toThrow("No workflows found for this trigger");

      expect(toastMock).not.toHaveBeenCalled();
    });

    it("resolves with result payload when invocation succeeds", async () => {
      const { triggerWorkflow } = useWorkflowTriggers();

      invokeMock.mockResolvedValueOnce({
        data: { result: { triggered_workflows: 0, detail: "ok" } },
        error: null,
      });

      await expect(
        triggerWorkflow("session_completed", "session", VALID_SESSION_ID, VALID_ORG_ID)
      ).resolves.toEqual({ triggered_workflows: 0, detail: "ok" });

      expect(toastMock).not.toHaveBeenCalled();
    });
  });

  describe("trigger wrappers", () => {
    beforeEach(() => {
      invokeMock.mockResolvedValue({
        data: { result: { triggered_workflows: 1 } },
        error: null,
      });
    });

    it("enriches session scheduled trigger payload with session metadata", async () => {
      const { triggerSessionScheduled } = useWorkflowTriggers();

      await triggerSessionScheduled(VALID_SESSION_ID, VALID_ORG_ID, {
        session_date: FUTURE_SESSION_DATE,
        session_time: "09:00",
        location: "Studio",
        custom: "value",
      });

      expect(invokeMock).toHaveBeenCalledWith("workflow-executor", {
        body: expect.objectContaining({
          trigger_type: "session_scheduled",
          trigger_entity_type: "session",
          trigger_entity_id: VALID_SESSION_ID,
          organization_id: VALID_ORG_ID,
          trigger_data: expect.objectContaining({
            session_date: FUTURE_SESSION_DATE,
            session_time: "09:00",
            location: "Studio",
            custom: "value",
          }),
        }),
      });
    });

    it("skips session scheduled trigger when the session is in the past", async () => {
      const { triggerSessionScheduled } = useWorkflowTriggers();

      const result = await triggerSessionScheduled(VALID_SESSION_ID, VALID_ORG_ID, {
        session_date: PAST_SESSION_DATE,
        session_time: "07:00",
      });

      expect(result).toEqual({ skipped: "session_in_past" });
      expect(invokeMock).not.toHaveBeenCalled();
    });

    it("passes through project status change payload", async () => {
      const { triggerProjectStatusChange } = useWorkflowTriggers();

      await triggerProjectStatusChange(
        VALID_SESSION_ID,
        VALID_ORG_ID,
        "proposal",
        "booked",
        { project_name: "Wedding" }
      );

      expect(invokeMock).toHaveBeenCalledWith("workflow-executor", {
        body: expect.objectContaining({
          trigger_type: "project_status_change",
          trigger_entity_type: "project",
          trigger_data: expect.objectContaining({
            old_status: "proposal",
            new_status: "booked",
            project_name: "Wedding",
          }),
        }),
      });
    });
  });
});
