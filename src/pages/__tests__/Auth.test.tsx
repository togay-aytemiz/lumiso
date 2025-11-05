import { act, fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import Auth from "../Auth";
import { useAuth } from "@/contexts/AuthContext";
import { useFormsTranslation, useMessagesTranslation } from "@/hooks/useTypedTranslation";
import { useI18nToast } from "@/lib/toastHelpers";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type TranslationFallback = string | { defaultValue?: string };

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
    t: (_key: string, fallbackOrOptions?: TranslationFallback) => {
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
type SignOutResponse = Awaited<ReturnType<SupabaseAuthMock["signOut"]>>;
type SignInWithPasswordResponse = Awaited<ReturnType<SupabaseAuthMock["signInWithPassword"]>>;
type SignUpResponse = Awaited<ReturnType<SupabaseAuthMock["signUp"]>>;
type ResetPasswordResponse = Awaited<ReturnType<SupabaseAuthMock["resetPasswordForEmail"]>>;
type UpdateUserResponse = Awaited<ReturnType<SupabaseAuthMock["updateUser"]>>;

const navigateMock = jest.fn();
const toastMock = { success: jest.fn(), error: jest.fn() };
const formsTranslator = {
  t: (_key: string, fallbackOrOptions?: TranslationFallback) => {
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
  t: (_key: string, fallbackOrOptions?: TranslationFallback) => {
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
  const signOutResponse: SignOutResponse = { error: null };
  authMock.signOut.mockResolvedValue(signOutResponse);
});

afterEach(() => {
  jest.useRealTimers();
  window.location.hash = "";
  window.history.replaceState(null, "", "/");
});

describe("Auth page", () => {
  it("signs in successfully and navigates home", async () => {
    useSafeFakeTimers();
    const authMock = getAuthMock();
    authMock.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: "user-123" }, session: null },
      error: null,
    } satisfies SignInWithPasswordResponse);

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
      data: { user: null, session: null },
      error: new Error("Invalid credentials"),
    } satisfies SignInWithPasswordResponse);

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
      data: { user: { id: "user-456", email_confirmed_at: null }, session: null },
      error: null,
    } satisfies SignUpResponse);

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

    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/auth/signup");
  });

  it("completes sign up when email already confirmed", async () => {
    useSafeFakeTimers();
    const authMock = getAuthMock();
    authMock.signUp.mockResolvedValueOnce({
      data: { user: { id: "user-789", email_confirmed_at: "2024-01-01" }, session: null },
      error: null,
    } satisfies SignUpResponse);

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
    authMock.resetPasswordForEmail.mockResolvedValueOnce(
      { data: {}, error: null } satisfies ResetPasswordResponse
    );

    render(<Auth />);

    fireEvent.click(screen.getByRole("button", { name: "auth.sign_in.forgot_password" }));

    fireEvent.change(screen.getByLabelText("labels.email"), {
      target: { value: "reset@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(authMock.resetPasswordForEmail).toHaveBeenCalledWith("reset@example.com", {
      redirectTo: "http://localhost/auth/signin?type=recovery",
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
    authMock.updateUser.mockResolvedValueOnce(
      { data: { user: { id: "user-123" } }, error: null } satisfies UpdateUserResponse
    );
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

  it("shows the password reset flow when returning from the recovery email", async () => {
    window.history.replaceState(null, "", "/auth?type=recovery");

    render(<Auth />);

    expect(await screen.findByLabelText("labels.password")).toBeInTheDocument();
    expect(screen.getByLabelText("labels.confirm_password")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "auth.sign_in.button" })).not.toBeInTheDocument();

    expect(getAuthMock().signInWithPassword).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
