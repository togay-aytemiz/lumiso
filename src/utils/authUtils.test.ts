import * as authUtils from "./authUtils";

const signOutMock = jest.fn();
const signInWithPasswordMock = jest.fn();

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signOut: (...args: unknown[]) => signOutMock(...args),
      signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args),
    },
  },
}));

describe("authUtils", () => {
  let pushStateSpy: jest.SpyInstance;
  let dispatchEventSpy: jest.SpyInstance;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    signOutMock.mockReset();
    signInWithPasswordMock.mockReset();
    pushStateSpy = jest.spyOn(window.history, "pushState");
    dispatchEventSpy = jest.spyOn(window, "dispatchEvent");
  });

  afterEach(() => {
    pushStateSpy.mockRestore();
    dispatchEventSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe("cleanupAuthState", () => {
    it("removes Supabase auth keys from both storage buckets", () => {
      localStorage.setItem("supabase.auth.token", "token");
      localStorage.setItem("sb-123", "value");
      localStorage.setItem("keep", "value");

      sessionStorage.setItem("supabase.auth.session", "session");
      sessionStorage.setItem("sb-session", "value");
      sessionStorage.setItem("other", "still-here");

      authUtils.cleanupAuthState();

      expect(localStorage.getItem("supabase.auth.token")).toBeNull();
      expect(localStorage.getItem("sb-123")).toBeNull();
      expect(localStorage.getItem("keep")).toBe("value");

      expect(sessionStorage.getItem("supabase.auth.session")).toBeNull();
      expect(sessionStorage.getItem("sb-session")).toBeNull();
      expect(sessionStorage.getItem("other")).toBe("still-here");
    });
  });

  describe("signOutSafely", () => {
    it("cleans up auth state, signs out globally, and navigates to /auth", async () => {
      localStorage.setItem("supabase.auth.token", "token");
      localStorage.setItem("sb-123", "value");
      sessionStorage.setItem("supabase.auth.session", "session");
      signOutMock.mockResolvedValue(undefined);

      await authUtils.signOutSafely();

      expect(signOutMock).toHaveBeenCalledWith({ scope: "global" });
      expect(pushStateSpy).toHaveBeenCalledWith({}, "", "/auth");

      const lastCall = dispatchEventSpy.mock.calls[dispatchEventSpy.mock.calls.length - 1];
      const dispatchedEvent = lastCall?.[0];
      expect(dispatchedEvent).toBeInstanceOf(PopStateEvent);
      expect(dispatchedEvent.type).toBe("popstate");

      expect(localStorage.getItem("supabase.auth.token")).toBeNull();
      expect(localStorage.getItem("sb-123")).toBeNull();
      expect(sessionStorage.getItem("supabase.auth.session")).toBeNull();
    });

    it("navigates even when global sign out rejects", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      signOutMock.mockRejectedValue(new Error("boom"));

      await authUtils.signOutSafely();

      expect(pushStateSpy).toHaveBeenCalledWith({}, "", "/auth");
      expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(PopStateEvent));
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it("falls back to navigation when history manipulation fails", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      pushStateSpy.mockImplementationOnce(() => {
        throw new Error("push failed");
      });

      await authUtils.signOutSafely();

      expect(pushStateSpy).toHaveBeenCalledWith({}, "", "/auth");
      expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(PopStateEvent));
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe("signInSafely", () => {
    it("cleans up state, attempts global sign out, and navigates home on success", async () => {
      localStorage.setItem("supabase.auth.token", "token");
      sessionStorage.setItem("supabase.auth.session", "session");
      signOutMock.mockResolvedValue(undefined);
      const authResponse = { data: { user: { id: "user-1" } }, error: null };
      signInWithPasswordMock.mockResolvedValue(authResponse);

      const result = await authUtils.signInSafely("test@example.com", "password");

      expect(signOutMock).toHaveBeenCalledWith({ scope: "global" });
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password",
      });
      expect(pushStateSpy).toHaveBeenCalledWith({}, "", "/");
      expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(PopStateEvent));
      expect(result).toEqual({ data: authResponse.data, error: null });

      expect(localStorage.getItem("supabase.auth.token")).toBeNull();
      expect(sessionStorage.getItem("supabase.auth.session")).toBeNull();
    });

    it("returns error and skips navigation when sign in fails", async () => {
      const error = new Error("invalid credentials");
      signOutMock.mockResolvedValue(undefined);
      signInWithPasswordMock.mockResolvedValue({ data: { user: null }, error });

      const result = await authUtils.signInSafely("fail@example.com", "invalid");

      expect(pushStateSpy).not.toHaveBeenCalledWith({}, "", "/");
      expect(result).toEqual({ data: null, error });
    });

    it("continues sign-in flow when pre-cleanup sign out fails", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      signOutMock.mockRejectedValue(new Error("sign out failed"));
      const authResponse = { data: { user: { id: "user-2" } }, error: null };
      signInWithPasswordMock.mockResolvedValue(authResponse);

      const result = await authUtils.signInSafely("user@example.com", "secret");

      expect(signInWithPasswordMock).toHaveBeenCalled();
      expect(pushStateSpy).toHaveBeenCalledWith({}, "", "/");
      expect(result).toEqual({ data: authResponse.data, error: null });
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });
});
