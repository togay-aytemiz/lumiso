import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { OnboardingModal } from "../OnboardingModal";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useI18nToast } from "@/lib/toastHelpers";
import { toast } from "@/hooks/use-toast";

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

jest.mock("@/lib/toastHelpers", () => ({
  useI18nToast: jest.fn(),
}));

jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, any>) => {
      if (options?.channel) {
        return `${key}:${options.channel}`;
      }
      if (options?.count !== undefined) {
        return `${key}:${options.count}`;
      }
      return key;
    },
  }),
}));

const baseModalRender = jest.fn(
  ({ open, title, description, actions, onClose, children }: any) => {
    if (!open) return null;
    return (
      <div data-testid="base-onboarding-modal">
        <h1>{title}</h1>
        <p>{description}</p>
        <div>{children}</div>
        <div>
          {actions?.map((action: any, index: number) => (
            <button
              key={index}
              disabled={action.disabled}
              onClick={() => action.onClick?.()}
            >
              {action.label}
            </button>
          ))}
        </div>
        <button onClick={() => onClose?.()}>modal-close</button>
      </div>
    );
  }
);

jest.mock("../shared/BaseOnboardingModal", () => ({
  BaseOnboardingModal: (props: any) => baseModalRender(props),
}));

const sampleDataModalRender = jest.fn(
  ({ open, onClose, onCloseAll }: any) => {
    if (!open) return null;
    return (
      <div data-testid="sample-data-modal">
        <button onClick={() => onClose?.()}>close-sample</button>
        <button onClick={() => onCloseAll?.()}>close-all</button>
      </div>
    );
  }
);

jest.mock("../SampleDataModal", () => ({
  SampleDataModal: (props: any) => sampleDataModalRender(props),
}));

describe("OnboardingModal", () => {
  const navigateMock = jest.fn();
  const onCloseMock = jest.fn();
  const startGuidedSetupMock = jest.fn();
  const toastHelperMock = { error: jest.fn() };
  const toastFnMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigate as jest.Mock).mockReturnValue(navigateMock);
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-1" } });
    (useOnboarding as jest.Mock).mockReturnValue({
      startGuidedSetup: startGuidedSetupMock,
    });
    (useI18nToast as jest.Mock).mockReturnValue(toastHelperMock);
    (toast as jest.Mock).mockImplementation(toastFnMock);
  });

  it("renders onboarding steps and action buttons when open", () => {
    render(<OnboardingModal open onClose={onCloseMock} />);

    expect(screen.getByTestId("base-onboarding-modal")).toBeInTheDocument();
    expect(screen.getByText("onboarding.modal.welcome_title")).toBeInTheDocument();
    expect(screen.getByText("onboarding.modal.welcome_subtitle")).toBeInTheDocument();

    // Ensure the guided steps list is rendered
    expect(screen.getByText("onboarding.steps.step_1.title")).toBeInTheDocument();
    expect(screen.getByText("onboarding.steps.step_2.title")).toBeInTheDocument();

    // Action buttons should use translated labels
    expect(
      screen.getByRole("button", { name: "onboarding.modal.skip_sample_data" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "onboarding.modal.start_learning" })
    ).toBeInTheDocument();
  });

  it("starts guided setup and navigates to getting started", async () => {
    startGuidedSetupMock.mockResolvedValueOnce(undefined);

    render(<OnboardingModal open onClose={onCloseMock} />);

    fireEvent.click(
      screen.getByRole("button", { name: "onboarding.modal.start_learning" })
    );

    await waitFor(() => {
      expect(startGuidedSetupMock).toHaveBeenCalled();
    });

    expect(onCloseMock).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/getting-started");
    expect(toastFnMock).toHaveBeenCalledWith({
      title: "onboarding.modal.welcome_title",
      description: "onboarding.modal.toast.setup_started",
    });
  });

  it("shows sample data modal when skip action is selected", () => {
    render(<OnboardingModal open onClose={onCloseMock} />);

    fireEvent.click(
      screen.getByRole("button", { name: "onboarding.modal.skip_sample_data" })
    );

    expect(screen.getByTestId("sample-data-modal")).toBeInTheDocument();
  });
});
