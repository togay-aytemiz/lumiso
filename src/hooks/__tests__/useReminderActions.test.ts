jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}));

import { useReminderActions } from "../useReminderActions";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const supabaseFromMock = supabase.from as jest.Mock;
const toastMock = jest.fn();

const createDeleteChain = (result: { error: unknown }) => ({
  delete: jest.fn(() => ({
    eq: jest.fn(() => Promise.resolve(result)),
  })),
});

const createUpdateChain = (result: { error: unknown }) => ({
  update: jest.fn(() => ({
    eq: jest.fn(() => Promise.resolve(result)),
  })),
});

beforeEach(() => {
  supabaseFromMock.mockReset();
  toastMock.mockReset();
  (useToast as jest.Mock).mockReturnValue({ toast: toastMock });
});

describe("useReminderActions", () => {
  describe("deleteReminder", () => {
    it("deletes reminder and shows success toast", async () => {
      supabaseFromMock.mockImplementation((table: string) => {
        expect(table).toBe("activities");
        return createDeleteChain({ error: null });
      });

      const { deleteReminder } = useReminderActions();
      const result = await deleteReminder("reminder-1");

      expect(result).toBe(true);
      expect(toastMock).toHaveBeenCalledWith({
        title: "Reminder deleted",
        description: "Reminder has been removed from your calendar.",
      });
    });

    it("returns false and shows destructive toast on error", async () => {
      supabaseFromMock.mockReturnValue(
        createDeleteChain({ error: new Error("delete failed") })
      );

      const { deleteReminder } = useReminderActions();
      const result = await deleteReminder("reminder-1");

      expect(result).toBe(false);
      expect(toastMock).toHaveBeenCalledWith({
        title: "Error deleting reminder",
        description: "delete failed",
        variant: "destructive",
      });
    });
  });

  describe("updateReminder", () => {
    it("updates reminder with provided fields and shows success toast", async () => {
      const eqMock = jest.fn(() => Promise.resolve({ error: null }));
      const updateMock = jest.fn(() => ({ eq: eqMock }));
      supabaseFromMock.mockImplementation((table: string) => {
        expect(table).toBe("activities");
        return { update: updateMock };
      });

      const { updateReminder } = useReminderActions();
      const result = await updateReminder(
        "reminder-1",
        "Call client",
        "2025-01-10",
        "09:30"
      );

      expect(result).toBe(true);
      expect(updateMock).toHaveBeenCalledWith({
        content: "Call client",
        reminder_date: "2025-01-10",
        reminder_time: "09:30",
      });
      expect(toastMock).toHaveBeenCalledWith({
        title: "Reminder updated",
        description: "Reminder has been updated in your calendar.",
      });
    });

    it("sends nulls when optional fields omitted", async () => {
      const eqMock = jest.fn(() => Promise.resolve({ error: null }));
      const updateMock = jest.fn(() => ({ eq: eqMock }));
      supabaseFromMock.mockReturnValue({ update: updateMock });

      const { updateReminder } = useReminderActions();
      await updateReminder("reminder-1", "Follow-up");

      expect(updateMock).toHaveBeenCalledWith({
        content: "Follow-up",
        reminder_date: null,
        reminder_time: null,
      });
    });

    it("returns false and shows destructive toast on error", async () => {
      supabaseFromMock.mockReturnValue(
        createUpdateChain({ error: new Error("update failed") })
      );

      const { updateReminder } = useReminderActions();
      const result = await updateReminder("reminder-1", "Call client");

      expect(result).toBe(false);
      expect(toastMock).toHaveBeenCalledWith({
        title: "Error updating reminder",
        description: "update failed",
        variant: "destructive",
      });
    });
  });
});
