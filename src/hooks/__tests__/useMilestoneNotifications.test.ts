import { useMilestoneNotifications } from "../useMilestoneNotifications";

const triggerProjectMilestoneMock = jest.fn();

jest.mock("@/hooks/useNotificationTriggers", () => ({
  useNotificationTriggers: () => ({
    triggerProjectMilestone: (...args: unknown[]) => triggerProjectMilestoneMock(...args),
  }),
}));

describe("useMilestoneNotifications", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("logs a warning when invoking the deprecated sender", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { sendPendingMilestoneNotifications } = useMilestoneNotifications();
    await sendPendingMilestoneNotifications();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Legacy milestone notification method called - please use triggerProjectMilestone directly"
    );
    consoleSpy.mockRestore();
  });

  it("re-exports triggerProjectMilestone from the notification triggers hook", async () => {
    const { triggerProjectMilestone } = useMilestoneNotifications();

    await triggerProjectMilestone("proj-1", "status-from", "status-to", "org-1");

    expect(triggerProjectMilestoneMock).toHaveBeenCalledWith(
      "proj-1",
      "status-from",
      "status-to",
      "org-1"
    );
  });
});
