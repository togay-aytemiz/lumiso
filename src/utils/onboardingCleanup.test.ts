import { cleanupOldOnboardingColumns } from "./onboardingCleanup";

const rpcMock = jest.fn();

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

describe("cleanupOldOnboardingColumns", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("returns boolean result when cleanup succeeds", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });

    const result = await cleanupOldOnboardingColumns();

    expect(rpcMock).toHaveBeenCalledWith("cleanup_old_onboarding_columns_v3");
    expect(result).toBe(true);
  });

  it("returns success message when no data is provided", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await cleanupOldOnboardingColumns();

    expect(result).toBe("Cleanup completed successfully");
  });

  it("logs and returns false when RPC responds with error", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    rpcMock.mockResolvedValue({ data: null, error: new Error("rpc failed") });

    const result = await cleanupOldOnboardingColumns();

    expect(result).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith("Database cleanup failed:", expect.any(Error));

    errorSpy.mockRestore();
  });

  it("logs and returns false when RPC throws", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    rpcMock.mockRejectedValue(new Error("network issue"));

    const result = await cleanupOldOnboardingColumns();

    expect(result).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith("Cleanup error:", expect.any(Error));

    errorSpy.mockRestore();
  });
});
