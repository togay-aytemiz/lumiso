import { renderHook, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthContext";
import { supabase } from "@/integrations/supabase/client";

jest.mock("@/integrations/supabase/client", () => {
  const unsubscribe = jest.fn();
  return {
    supabase: {
      auth: {
        getSession: jest.fn(),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe } },
        })),
        signOut: jest.fn(),
      },
      rpc: jest.fn(),
    },
  };
});

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock;
const mockSignOut = supabase.auth.signOut as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

let consoleLogSpy: jest.SpyInstance;
let consoleErrorSpy: jest.SpyInstance;

beforeAll(() => {
  consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("AuthContext", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1" },
        },
      },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: ["admin"], error: null });
    mockSignOut.mockResolvedValue({});
    window.localStorage.setItem("test", "value");
  });

  afterEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it("initializes auth state and fetches user roles", async () => {
    const listeners: Array<(event: string, session: any) => void> = [];
    mockOnAuthStateChange.mockImplementation((callback: any) => {
      listeners.push(callback);
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(listeners).toHaveLength(1);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.id).toBe("user-1");

    await act(async () => {
      listeners[0]?.("SIGNED_IN", { user: { id: "user-1" } });
      await Promise.resolve();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    expect(mockRpc).toHaveBeenCalledWith("get_user_roles", {
      user_uuid: "user-1",
    });

    expect(result.current.userRoles).toEqual([]);
  });

  it("signOut clears state and redirects to auth", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalledWith({ scope: "global" });
    expect(window.localStorage.getItem("test")).toBeNull();
  });

  it("throws when useAuth is used outside provider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within an AuthProvider"
    );
  });
});
