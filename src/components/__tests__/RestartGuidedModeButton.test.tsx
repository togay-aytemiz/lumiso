import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/utils/testUtils";
import { RestartGuidedModeButton } from "@/components/RestartGuidedModeButton";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useI18nToast } from "@/lib/toastHelpers";
import { useNavigate } from "react-router-dom";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/contexts/OnboardingContext", () => ({
  useOnboarding: jest.fn(),
}));

jest.mock("@/lib/toastHelpers", () => ({
  useI18nToast: jest.fn(),
}));

const navigateMock = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(() => navigateMock),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseOnboarding = useOnboarding as jest.Mock;
const mockUseI18nToast = useI18nToast as jest.Mock;
const mockUseNavigate = useNavigate as jest.Mock;

describe("RestartGuidedModeButton", () => {
  const resetOnboarding = jest.fn();
  const toastSuccess = jest.fn();
  const toastError = jest.fn();

  beforeEach(() => {
    resetOnboarding.mockClear();
    navigateMock.mockClear();
    mockUseNavigate.mockReturnValue(navigateMock);
    mockUseI18nToast.mockReturnValue({ success: toastSuccess, error: toastError });
    resetOnboarding.mockResolvedValue(undefined);
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("does not render when user is not the guided mode owner", () => {
    mockUseAuth.mockReturnValue({ user: { email: "someone@example.com" } });
    mockUseOnboarding.mockReturnValue({ resetOnboarding });

    render(<RestartGuidedModeButton />);
    expect(
      screen.queryByRole("button", { name: "onboarding.buttons.restart_guided_mode" })
    ).not.toBeInTheDocument();
  });

  it("restarts guided mode and shows success toast", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { email: "togayaytemiz@gmail.com" } });
    mockUseOnboarding.mockReturnValue({ resetOnboarding });

    render(<RestartGuidedModeButton />);

    const button = screen.getByRole("button", { name: "onboarding.buttons.restart_guided_mode" });
    await user.click(button);

    expect(resetOnboarding).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("onboarding.buttons.toast.restart_description"));
    expect(navigateMock).toHaveBeenCalledWith("/getting-started");
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("handles errors when restarting guided mode fails", async () => {
    const user = userEvent.setup();
    const error = new Error("boom");
    resetOnboarding.mockRejectedValueOnce(error);
    mockUseAuth.mockReturnValue({ user: { email: "togayaytemiz@gmail.com" } });
    mockUseOnboarding.mockReturnValue({ resetOnboarding });

    render(<RestartGuidedModeButton />);

    const button = screen.getByRole("button", { name: "onboarding.buttons.restart_guided_mode" });
    await user.click(button);

    expect(resetOnboarding).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("onboarding.buttons.toast.restart_error"));
    expect(toastSuccess).not.toHaveBeenCalled();
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
