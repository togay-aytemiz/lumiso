import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/utils/testUtils";
import { SampleDataModal } from "../SampleDataModal";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/contexts/OnboardingContext", () => ({
  useOnboarding: jest.fn(),
}));

jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const baseModalRender = jest.fn(
  ({ open, title, description, actions, children }: any) => {
    if (!open) return null;
    return (
      <div data-testid="sample-modal-root">
        <h1>{title}</h1>
        <p>{description}</p>
        <div>{children}</div>
        <div>
          {actions?.map((action: any, index: number) => (
            <button
              key={index}
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
);

jest.mock("../shared/BaseOnboardingModal", () => ({
  BaseOnboardingModal: (props: any) => baseModalRender(props),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseOnboarding = useOnboarding as jest.Mock;
const mockToast = toast as jest.Mock;
const mockUseNavigate = useNavigate as jest.Mock;

describe("SampleDataModal", () => {
  const skipOnboarding = jest.fn();
  const startGuidedSetup = jest.fn();
  const navigate = jest.fn();
  const onClose = jest.fn();
  const onCloseAll = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    skipOnboarding.mockResolvedValue(undefined);
    startGuidedSetup.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    mockUseOnboarding.mockReturnValue({ skipOnboarding, startGuidedSetup });
    mockToast.mockReturnValue(undefined);
    mockUseNavigate.mockReturnValue(navigate);
  });

  it("renders sample data information when open", () => {
    render(<SampleDataModal open onClose={onClose} />);

    expect(baseModalRender).toHaveBeenCalled();
    expect(
      screen.getByText("onboarding.sample_data.items.sample_leads.title")
    ).toBeInTheDocument();
    expect(
      screen.getByText("onboarding.sample_data.items.example_projects.title")
    ).toBeInTheDocument();
    expect(
      screen.getByText("onboarding.sample_data.items.scheduled_sessions.title")
    ).toBeInTheDocument();
  });

  it("skips onboarding with sample data and shows success feedback", async () => {
    const user = userEvent.setup();
    render(<SampleDataModal open onClose={onClose} />);

    const skipButton = screen.getByRole("button", {
      name: "onboarding.sample_data.start_with_sample_data",
    });

    await user.click(skipButton);

    await waitFor(() => expect(skipOnboarding).toHaveBeenCalledTimes(1));
    expect(skipOnboarding).toHaveBeenCalledWith();

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: "onboarding.sample_data.toast.success_title",
        description: "onboarding.sample_data.toast.success_description",
      })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/leads");
  });

  it("continues guided setup when requested", async () => {
    const user = userEvent.setup();
    render(<SampleDataModal open onClose={onClose} onCloseAll={onCloseAll} />);

    const continueButton = screen.getByRole("button", {
      name: "onboarding.sample_data.continue_guided_setup",
    });

    await user.click(continueButton);

    await waitFor(() => expect(startGuidedSetup).toHaveBeenCalledTimes(1));
    expect(onCloseAll).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/getting-started");
  });

  it("surfaces toast errors when skipping fails", async () => {
    const user = userEvent.setup();
    const error = new Error("boom");
    skipOnboarding.mockRejectedValueOnce(error);

    render(<SampleDataModal open onClose={onClose} />);

    const skipButton = screen.getByRole("button", {
      name: "onboarding.sample_data.start_with_sample_data",
    });

    await user.click(skipButton);

    await waitFor(() => expect(skipOnboarding).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: "onboarding.sample_data.toast.error_title",
        description: "onboarding.sample_data.toast.error_description",
        variant: "destructive",
      })
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
