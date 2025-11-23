import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/utils/testUtils";
import { SampleDataModal } from "../SampleDataModal";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(),
}));

jest.mock("@/hooks/useOrganizationSettings", () => ({
  useOrganizationSettings: jest.fn(),
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

interface ModalAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface ModalProps {
  open: boolean;
  title: string;
  description: string;
  actions?: ModalAction[];
  children?: ReactNode;
}

const baseModalRender = jest.fn(
  ({ open, title, description, actions, children }: ModalProps) => {
    if (!open) return null;
    return (
      <div data-testid="sample-modal-root">
        <h1>{title}</h1>
        <p>{description}</p>
        <div>{children}</div>
        <div>
          {actions?.map((action, index) => (
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
  BaseOnboardingModal: (props: ModalProps) => baseModalRender(props),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseOnboarding = useOnboarding as jest.Mock;
const mockUseOrganization = useOrganization as jest.Mock;
const mockUseOrganizationSettings = useOrganizationSettings as jest.Mock;
const mockToast = toast as jest.Mock;
const mockUseNavigate = useNavigate as jest.Mock;
const mockSupabaseRpc = supabase.rpc as jest.Mock;

describe("SampleDataModal", () => {
  const skipOnboarding = jest.fn();
  const startGuidedSetup = jest.fn();
  const navigate = jest.fn();
  const onClose = jest.fn();
  const onCloseAll = jest.fn();
  const updateSettings = jest.fn();
  const refreshSettings = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    skipOnboarding.mockResolvedValue(undefined);
    startGuidedSetup.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    mockUseOnboarding.mockReturnValue({ skipOnboarding, startGuidedSetup });
    mockUseOrganization.mockReturnValue({ activeOrganizationId: "org-1" });
    updateSettings.mockResolvedValue({ success: true });
    refreshSettings.mockResolvedValue(undefined);
    mockUseOrganizationSettings.mockReturnValue({
      settings: {
        organization_id: "org-1",
        preferred_locale: "tr",
        preferred_project_types: ["wedding"],
        seed_sample_data_onboarding: false,
      },
      updateSettings,
      refreshSettings,
      loading: false,
    });
    mockToast.mockReturnValue(undefined);
    mockUseNavigate.mockReturnValue(navigate);
    mockSupabaseRpc.mockResolvedValue({ data: null, error: null });
  });

  it("renders sample/clean options when open", () => {
    render(<SampleDataModal open onClose={onClose} />);

    expect(baseModalRender).toHaveBeenCalled();
    expect(
      screen.getByText("onboarding.sample_data.options.sample.title")
    ).toBeInTheDocument();
    expect(
      screen.getByText("onboarding.sample_data.options.clean.title")
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
    expect(updateSettings).toHaveBeenCalledWith({
      seed_sample_data_onboarding: true,
    });
    expect(mockSupabaseRpc).toHaveBeenCalledWith("seed_sample_data_for_org", {
      owner_uuid: "user-1",
      org_id: "org-1",
      final_locale: "tr",
      preferred_slugs: ["wedding"],
    });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: "onboarding.sample_data.toast.success_title",
        description: "onboarding.sample_data.toast.success_description",
      })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("skips without sample data and does not trigger seeding", async () => {
    const user = userEvent.setup();
    render(<SampleDataModal open onClose={onClose} />);

    const cleanOption = screen.getByText(
      "onboarding.sample_data.options.clean.title"
    );
    await user.click(cleanOption);

    const startButton = screen.getByRole("button", {
      name: "onboarding.sample_data.start_clean",
    });

    await user.click(startButton);

    await waitFor(() => expect(skipOnboarding).toHaveBeenCalledTimes(1));
    expect(updateSettings).not.toHaveBeenCalled();
    expect(mockSupabaseRpc).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/", { replace: true });
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
