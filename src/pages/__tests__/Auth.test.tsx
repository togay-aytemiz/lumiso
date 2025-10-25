import { act, fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import Auth from "../Auth";
import { useAuth } from "@/contexts/AuthContext";
import { useFormsTranslation, useMessagesTranslation } from "@/hooks/useTypedTranslation";
import { useI18nToast } from "@/lib/toastHelpers";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
  useMessagesTranslation: jest.fn(),
}));

jest.mock("@/lib/toastHelpers", () => ({
  useI18nToast: jest.fn(),
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signOut: jest.fn(),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallbackOrOptions?: any) => {
      if (typeof fallbackOrOptions === "string") {
        return fallbackOrOptions;
      }
      if (fallbackOrOptions?.defaultValue) {
        return fallbackOrOptions.defaultValue;
      }
      return _key;
    },
  }),
}));

type SupabaseAuthMock = typeof supabase.auth;

const navigateMock = jest.fn();
const toastMock = { success: jest.fn(), error: jest.fn() };
const formsTranslator = {
  t: (_key: string, fallbackOrOptions?: any) => {
    if (typeof fallbackOrOptions === "string") {
      return fallbackOrOptions;
    }
    if (fallbackOrOptions?.defaultValue) {
      return fallbackOrOptions.defaultValue;
    }
    return _key;
  },
};
const messagesTranslator = {
  t: (_key: string, fallbackOrOptions?: any) => {
    if (typeof fallbackOrOptions === "string") {
      return fallbackOrOptions;
    }
    if (fallbackOrOptions?.defaultValue) {
      return fallbackOrOptions.defaultValue;
    }
    return _key;
  },
};

const getAuthMock = () => supabase.auth as jest.Mocked<SupabaseAuthMock>;

const useSafeFakeTimers = () =>
  jest.useFakeTimers({ now: Date.now(), doNotFake: ["performance"] });

beforeEach(() => {
  jest.clearAllMocks();
  (useNavigate as jest.Mock).mockReturnValue(navigateMock);
  (useAuth as jest.Mock).mockReturnValue({ user: null });
  (useFormsTranslation as jest.Mock).mockReturnValue(formsTranslator);
  (useMessagesTranslation as jest.Mock).mockReturnValue(messagesTranslator);
  (useI18nToast as jest.Mock).mockReturnValue(toastMock);
  const authMock = getAuthMock();
  authMock.signOut.mockResolvedValue({ error: null } as any);
});

afterEach(() => {
  jest.useRealTimers();
  window.location.hash = "";
});

describe("Auth page", () => {
  it("signs in successfully and navigates home", async () => {
    useSafeFakeTimers();
    const authMock = getAuthMock();
    authMock.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null,
    } as any);

    render(<Auth />);

    fireEvent.change(screen.getByLabelText("labels.email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("labels.password"), {
      target: { value: "Secure123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: "auth.sign_in.button" }));

    await waitFor(() => {
      expect(authMock.signInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "Secure123!",
      });
    });

    expect(authMock.signOut).toHaveBeenCalledWith({ scope: "global" });

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith("auth.signed_in");
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("surfaces toast errors when sign in fails", async () => {
    useSafeFakeTimers();
    const authMock = getAuthMock();
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    authMock.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: new Error("Invalid credentials"),
    } as any);

    render(<Auth />);

    fireEvent.change(screen.getByLabelText("labels.email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("labels.password"), {
      target: { value: "Wrong" },
    });

    fireEvent.click(screen.getByRole("button", { name: "auth.sign_in.button" }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith("Invalid credentials");
    });

    expect(authMock.signOut).toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("signs up and informs users about email confirmation", async () => {
    useSafeFakeTimers();
    const authMock = getAuthMock();
    authMock.signUp.mockResolvedValueOnce({
      data: { user: { id: "user-456", email_confirmed_at: null } },
      error: null,
    } as any);

    render(<Auth />);

    fireEvent.click(screen.getByRole("button", { name: "auth.sign_up.button" }));

    fireEvent.change(screen.getByLabelText("labels.email"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText("labels.password"), {
      target: { value: "NewSecure123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: "auth.sign_up.button" }));

    await waitFor(() => {
      expect(authMock.signUp).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "NewSecure123!",
        options: { emailRedirectTo: "http://localhost/" },
      });
    });

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith("auth.email_confirmation");
    });

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("completes sign up when email already confirmed", async () => {
    useSafeFakeTimers();
    const authMock = getAuthMock();
    authMock.signUp.mockResolvedValueOnce({
      data: { user: { id: "user-789", email_confirmed_at: "2024-01-01" } },
      error: null,
    } as any);

    render(<Auth />);

    fireEvent.click(screen.getByRole("button", { name: "auth.sign_up.button" }));

    fireEvent.change(screen.getByLabelText("labels.email"), {
      target: { value: "confirmed@example.com" },
    });
    fireEvent.change(screen.getByLabelText("labels.password"), {
      target: { value: "Confirmed123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: "auth.sign_up.button" }));

    await waitFor(() => {
      expect(authMock.signUp).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith("auth.account_created");
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("requests a password reset email", async () => {
    useSafeFakeTimers();
    const authMock = getAuthMock();
    authMock.resetPasswordForEmail.mockResolvedValueOnce({ error: null } as any);

    render(<Auth />);

    fireEvent.click(screen.getByRole("button", { name: "auth.sign_in.forgot_password" }));

    fireEvent.change(screen.getByLabelText("labels.email"), {
      target: { value: "reset@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(authMock.resetPasswordForEmail).toHaveBeenCalledWith("reset@example.com", {
      redirectTo: "http://localhost/auth?type=recovery",
    });

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith("auth.reset_email_sent");
    });
  });

  it("prevents password reset requests without email", async () => {
    render(<Auth />);

    fireEvent.click(screen.getByRole("button", { name: "auth.sign_in.forgot_password" }));

    const emailInput = screen.getByLabelText("labels.email") as HTMLInputElement;
    emailInput.removeAttribute("required");

    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(toastMock.error).toHaveBeenCalledWith("auth.reset_email_missing");

    expect(getAuthMock().resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("updates the password during recovery", async () => {
    useSafeFakeTimers();
    const authMock = getAuthMock();
    authMock.updateUser.mockResolvedValueOnce({ error: null } as any);
    window.location.hash = "#type=recovery";

    render(<Auth />);

    fireEvent.change(screen.getByLabelText("labels.password"), {
      target: { value: "ResetPass123!" },
    });
    fireEvent.change(screen.getByLabelText("labels.confirm_password"), {
      target: { value: "ResetPass123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: "auth.password_reset.button" }));

    await waitFor(() => {
      expect(authMock.updateUser).toHaveBeenCalledWith({ password: "ResetPass123!" });
    });

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith("auth.password_updated");
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("guards against mismatched recovery passwords", async () => {
    window.location.hash = "#type=recovery";

    render(<Auth />);

    fireEvent.change(screen.getByLabelText("labels.password"), {
      target: { value: "ResetPass123!" },
    });
    fireEvent.change(screen.getByLabelText("labels.confirm_password"), {
      target: { value: "OtherPass123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: "auth.password_reset.button" }));

    expect(toastMock.error).toHaveBeenCalledWith("auth.password_mismatch");

    expect(getAuthMock().updateUser).not.toHaveBeenCalled();
  });
});
