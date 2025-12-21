import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/utils/testUtils";
import { ExitGuidanceModeButton } from "@/components/ExitGuidanceModeButton";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/useOnboarding";
import { useI18nToast } from "@/lib/toastHelpers";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/contexts/useOnboarding", () => ({
  useOnboarding: jest.fn(),
}));

jest.mock("@/lib/toastHelpers", () => ({
  useI18nToast: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseOnboarding = useOnboarding as jest.Mock;
const mockUseI18nToast = useI18nToast as jest.Mock;

describe("ExitGuidanceModeButton", () => {
  const completeOnboarding = jest.fn();
  const toastSuccess = jest.fn();
  const toastError = jest.fn();

  beforeEach(() => {
    completeOnboarding.mockClear();
    mockUseI18nToast.mockReturnValue({ success: toastSuccess, error: toastError });
    completeOnboarding.mockResolvedValue(undefined);
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("does not render when user or navigation lock conditions fail", () => {
    mockUseAuth.mockReturnValue({ user: { email: "someone@example.com" } });
    mockUseOnboarding.mockReturnValue({ shouldLockNavigation: false, completeOnboarding });

    render(<ExitGuidanceModeButton />);
    expect(
      screen.queryByRole("button", { name: "onboarding.buttons.exit_guidance" })
    ).not.toBeInTheDocument();
  });

  it("completes onboarding and shows success toast", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { email: "togayaytemiz@gmail.com" } });
    mockUseOnboarding.mockReturnValue({ shouldLockNavigation: true, completeOnboarding });

    render(<ExitGuidanceModeButton />);

    const button = screen.getByRole("button", { name: "onboarding.buttons.exit_guidance" });
    await user.click(button);

    expect(completeOnboarding).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("onboarding.buttons.toast.exit_description"));
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("surfaces toast errors when completing onboarding fails", async () => {
    const user = userEvent.setup();
    const error = new Error("nope");
    completeOnboarding.mockRejectedValueOnce(error);
    mockUseAuth.mockReturnValue({ user: { email: "togayaytemiz@gmail.com" } });
    mockUseOnboarding.mockReturnValue({ shouldLockNavigation: true, completeOnboarding });

    render(<ExitGuidanceModeButton />);

    const button = screen.getByRole("button", { name: "onboarding.buttons.exit_guidance" });
    await user.click(button);

    expect(completeOnboarding).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("onboarding.buttons.toast.exit_error"));
    expect(toastSuccess).not.toHaveBeenCalled();
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
