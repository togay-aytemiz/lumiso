import { render, screen, waitFor } from "@/utils/testUtils";
import userEvent from "@testing-library/user-event";
import { ProfileIntakeGate } from "../ProfileIntakeGate";
import { useProfile } from "@/hooks/useProfile";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { logAuthEvent } from "@/lib/authTelemetry";

jest.mock("@/hooks/useProfile", () => ({
  useProfile: jest.fn(),
}));

jest.mock("@/hooks/useOrganizationSettings", () => ({
  useOrganizationSettings: jest.fn(),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}));

jest.mock("@/lib/authTelemetry", () => ({
  logAuthEvent: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; count?: number }) =>
      options?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

const mockUseProfile = useProfile as jest.MockedFunction<typeof useProfile>;
const mockUseOrganizationSettings =
  useOrganizationSettings as jest.MockedFunction<typeof useOrganizationSettings>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseOrganization =
  useOrganization as jest.MockedFunction<typeof useOrganization>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;
const logAuthEventMock = logAuthEvent as jest.MockedFunction<typeof logAuthEvent>;

const createProfileReturn = (
  overrides: Partial<ReturnType<typeof useProfile>> = {}
) =>
  ({
    profile: { full_name: "" },
    loading: false,
    uploading: false,
    updateProfile: jest.fn().mockResolvedValue({ success: true }),
    uploadProfilePhoto: jest.fn(),
    deleteProfilePhoto: jest.fn(),
    refreshProfile: jest.fn(),
    ...overrides,
  }) as ReturnType<typeof useProfile>;

const createSettingsReturn = (
  overrides: Partial<ReturnType<typeof useOrganizationSettings>> = {}
) =>
  ({
    settings: {
      profile_intake_completed_at: null,
      photography_business_name: "",
      preferred_project_types: [],
      seed_sample_data_onboarding: false,
      organization_id: "org-123",
    },
    loading: false,
    uploading: false,
    updateSettings: jest.fn().mockResolvedValue({ success: true }),
    uploadLogo: jest.fn(),
    deleteLogo: jest.fn(),
    refreshSettings: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as ReturnType<typeof useOrganizationSettings>;

const createOrganizationReturn = (
  overrides: Partial<ReturnType<typeof useOrganization>> = {}
) =>
  ({
    activeOrganizationId: "org-123",
    activeOrganization: null,
    loading: false,
    refreshOrganization: jest.fn().mockResolvedValue(undefined),
    setActiveOrganization: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as ReturnType<typeof useOrganization>;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: { id: "user-1", user_metadata: {} } as unknown as { id: string },
    session: null,
    userRoles: [],
    loading: false,
    signOut: jest.fn(),
  } as ReturnType<typeof useAuth>);
  mockUseToast.mockReturnValue({ toast: jest.fn() });
  mockUseProfile.mockReturnValue(createProfileReturn());
  mockUseOrganizationSettings.mockReturnValue(createSettingsReturn());
  mockUseOrganization.mockReturnValue(createOrganizationReturn());
});

describe("ProfileIntakeGate", () => {
  it("renders intake dialog when required data is missing", () => {
    render(<ProfileIntakeGate />);
    expect(
      screen.getByTestId("profile-intake-gate")
    ).toBeInTheDocument();
    expect(logAuthEventMock).toHaveBeenCalledWith(
      "auth_first_profile_intake_start",
      expect.objectContaining({ supabaseUserId: "user-1" })
    );
  });

  it("hides dialog when intake already complete", () => {
    mockUseProfile.mockReturnValue(
      createProfileReturn({ profile: { full_name: "Tayte" } })
    );
    mockUseOrganizationSettings.mockReturnValue(
      createSettingsReturn({
        settings: {
          profile_intake_completed_at: new Date().toISOString(),
          preferred_project_types: ["wedding"],
          photography_business_name: "Lumiso",
          seed_sample_data_onboarding: false,
          organization_id: "org-123",
        },
      })
    );

    render(<ProfileIntakeGate />);
    expect(
      screen.queryByTestId("profile-intake-gate")
    ).not.toBeInTheDocument();
  });

  it("submits preferences and logs completion", async () => {
    const updateProfileMock = jest.fn().mockResolvedValue({ success: true });
    const updateSettingsMock = jest.fn().mockResolvedValue({ success: true });
    const refreshSettingsMock = jest.fn().mockResolvedValue(undefined);

    mockUseProfile.mockReturnValue(
      createProfileReturn({ updateProfile: updateProfileMock })
    );
    mockUseOrganizationSettings.mockReturnValue(
      createSettingsReturn({
        updateSettings: updateSettingsMock,
        refreshSettings: refreshSettingsMock,
      })
    );

    render(<ProfileIntakeGate />);
    const user = userEvent.setup();

    const displayNameInput = await screen.findByPlaceholderText(
      "pages:profileIntake.displayName.placeholder"
    );
    await user.clear(displayNameInput);
    await user.type(displayNameInput, "Tayte");
    expect(displayNameInput).toHaveValue("Tayte");
    await user.click(
      screen.getByRole("button", {
        name: "pages:profileIntake.actions.next",
      })
    );

    const businessInput = await screen.findByPlaceholderText(
      "pages:profileIntake.businessName.placeholder"
    );
    await user.clear(businessInput);
    await user.type(businessInput, "Lumiso");
    expect(businessInput).toHaveValue("Lumiso");

    await user.click(
      screen.getByRole("button", {
        name: "pages:profileIntake.actions.next",
      })
    );

    await user.click(screen.getByTestId("profile-intake-project-wedding"));

    const finishButton = await screen.findByRole("button", {
      name: "pages:profileIntake.actions.finish",
    });
    await user.click(finishButton);

    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenCalledWith({
        full_name: "Tayte",
      });
    });

    expect(updateSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        photography_business_name: "Lumiso",
        preferred_project_types: ["wedding"],
        profile_intake_completed_at: expect.any(String),
        preferred_locale: "en",
      })
    );
    expect(refreshSettingsMock).toHaveBeenCalled();

    expect(logAuthEventMock).toHaveBeenCalledWith(
      "auth_first_profile_intake_finish",
      expect.objectContaining({
        supabaseUserId: "user-1",
        businessNameLength: 6,
        projectTypesCount: 1,
      })
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId("profile-intake-gate")
      ).not.toBeInTheDocument();
    });
  });
});
