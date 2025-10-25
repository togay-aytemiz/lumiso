import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor } from "@/utils/testUtils";
import Profile from "../Profile";
import { settingsHelpContent } from "@/lib/settingsHelpContent";
import { useProfile } from "@/contexts/ProfileContext";
import { useWorkingHours } from "@/hooks/useWorkingHours";
import { useSettingsCategorySection } from "@/hooks/useSettingsCategorySection";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useOrganization } from "@/contexts/OrganizationContext";

const mockHeader = jest.fn(({ title, description, helpContent }: any) => (
  <header data-testid="settings-header">
    <h1>{title}</h1>
    <p>{description}</p>
    <span data-testid="help-content">{helpContent?.title ?? ""}</span>
  </header>
));

const mockCategorySection = jest.fn(({ title, children }: any) => (
  <section data-testid={`category-${title}`}>{children}</section>
));

const mockOnboardingTutorial = jest.fn(({ onComplete, onExit }: any) => (
  <div data-testid="onboarding-tutorial">
    <button type="button" onClick={onComplete}>
      complete tutorial
    </button>
    <button type="button" onClick={onExit}>
      exit tutorial
    </button>
  </div>
));

const mockToast = jest.fn();
const mockCompleteStep = jest.fn();
const mockGetUser = jest.fn().mockResolvedValue({ data: { user: { email: "owner@example.com" } } });

jest.mock("@/components/settings/SettingsPageWrapper", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="settings-page-wrapper">{children}</div>
  ),
}));

jest.mock("@/components/settings/SettingsHeader", () => ({
  __esModule: true,
  default: (props: any) => mockHeader(props),
}));

jest.mock("@/components/settings/CategorySettingsSection", () => ({
  CategorySettingsSection: (props: any) => mockCategorySection(props),
}));

jest.mock("@/components/shared/OnboardingTutorial", () => ({
  OnboardingTutorial: (props: any) => mockOnboardingTutorial(props),
}));

jest.mock("@/components/ui/loading-presets", () => ({
  SettingsLoadingSkeleton: ({ rows }: { rows: number }) => (
    <div data-testid="settings-loading-skeleton">loading {rows}</div>
  ),
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...rest }: any) => (
    <button type="button" {...rest}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange, ...rest }: any) => (
    <input value={value} onChange={onChange} {...rest} />
  ),
}));

jest.mock("@/components/ui/label", () => ({
  Label: ({ children, ...rest }: any) => (
    <label {...rest}>{children}</label>
  ),
}));

jest.mock("@/components/ui/switch", () => ({
  Switch: ({ onCheckedChange }: { onCheckedChange: (value: boolean) => void }) => (
    <button
      type="button"
      data-testid="working-hours-switch"
      onClick={() => onCheckedChange(true)}
    >
      toggle
    </button>
  ),
}));

jest.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      data-testid={`working-hours-select-${value}`}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

jest.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AvatarImage: () => <img alt="avatar" />,
}));

jest.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  AlertDialogAction: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
}));

jest.mock("@/contexts/ProfileContext");
jest.mock("@/hooks/useWorkingHours");
jest.mock("@/hooks/useSettingsCategorySection");
jest.mock("@/hooks/use-toast");
jest.mock("@/contexts/OnboardingContext");
jest.mock("@/contexts/OrganizationContext");

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockUseProfile = useProfile as jest.MockedFunction<typeof useProfile>;
const mockUseWorkingHours = useWorkingHours as jest.MockedFunction<typeof useWorkingHours>;
const mockUseSettingsCategorySection = useSettingsCategorySection as jest.MockedFunction<typeof useSettingsCategorySection>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;
const mockUseOnboarding = useOnboarding as jest.MockedFunction<typeof useOnboarding>;
const mockUseOrganization = useOrganization as jest.MockedFunction<typeof useOrganization>;

const createSectionMock = (initialValues: Record<string, unknown>) => ({
  values: initialValues,
  setValues: jest.fn(),
  updateValue: jest.fn(),
  handleSave: jest.fn(),
  handleCancel: jest.fn(),
  isDirty: false,
});

describe("Profile settings page", () => {
  beforeEach(() => {
    mockHeader.mockClear();
    mockCategorySection.mockClear();
    mockOnboardingTutorial.mockClear();
    mockToast.mockClear();
    mockCompleteStep.mockClear();
    mockGetUser.mockClear();

    mockUseToast.mockReturnValue({ toast: mockToast });
    mockUseOnboarding.mockReturnValue({ completeCurrentStep: mockCompleteStep });
    mockUseOrganization.mockReturnValue({ activeOrganization: { name: "Studio" } });
    mockGetUser.mockResolvedValue({ data: { user: { email: "owner@example.com" } } });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows a loading skeleton while profile data is loading", async () => {
    const profileSectionMock = createSectionMock({
      fullName: "",
      phoneNumber: "",
    });
    const workingHoursSectionMock = createSectionMock({ workingHours: [] });

    mockUseSettingsCategorySection.mockImplementation(({ sectionId }) =>
      sectionId === "profile" ? profileSectionMock : workingHoursSectionMock
    );

    mockUseProfile.mockReturnValue({
      profile: null,
      loading: true,
      uploading: false,
      updateProfile: jest.fn(),
      uploadProfilePhoto: jest.fn(),
      deleteProfilePhoto: jest.fn(),
    } as any);

    mockUseWorkingHours.mockReturnValue({
      workingHours: [],
      loading: false,
      updateWorkingHour: jest.fn(),
    } as any);

    render(<Profile />);

    expect(screen.getByTestId("settings-loading-skeleton")).toBeInTheDocument();
    expect(mockHeader).toHaveBeenCalledTimes(1);
    expect(mockHeader.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        title: "settings.profile.title",
        description: "settings.profile.description",
        helpContent: settingsHelpContent.profile,
      })
    );

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled();
    });
  });

  it("preloads profile and working hours data into their sections", async () => {
    const profileSectionMock = createSectionMock({
      fullName: "",
      phoneNumber: "",
    });
    const workingHoursSectionMock = createSectionMock({ workingHours: [] });

    mockUseSettingsCategorySection.mockImplementation(({ sectionId }) =>
      sectionId === "profile" ? profileSectionMock : workingHoursSectionMock
    );

    mockUseProfile.mockReturnValue({
      profile: {
        full_name: "Jane Doe",
        phone_number: "+1 555 0100",
        profile_photo_url: null,
      },
      loading: false,
      uploading: false,
      updateProfile: jest.fn(),
      uploadProfilePhoto: jest.fn(),
      deleteProfilePhoto: jest.fn(),
    } as any);

    mockUseWorkingHours.mockReturnValue({
      workingHours: [
        { day_of_week: 1, start_time: "09:00:00", end_time: "17:00:00", enabled: true },
      ],
      loading: false,
      updateWorkingHour: jest.fn().mockResolvedValue({ success: true }),
    } as any);

    render(<Profile />);

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(profileSectionMock.setValues).toHaveBeenCalledWith({
        fullName: "Jane Doe",
        phoneNumber: "+1 555 0100",
      });
    });

    await waitFor(() => {
      expect(workingHoursSectionMock.setValues).toHaveBeenCalledWith({
        workingHours: [
          { day_of_week: 1, start_time: "09:00:00", end_time: "17:00:00", enabled: true },
        ],
      });
    });
  });

  it("renders the onboarding tutorial when the tutorial query parameter is present", async () => {
    const profileSectionMock = createSectionMock({ fullName: "", phoneNumber: "" });
    const workingHoursSectionMock = createSectionMock({ workingHours: [] });

    mockUseSettingsCategorySection.mockImplementation(({ sectionId }) =>
      sectionId === "profile" ? profileSectionMock : workingHoursSectionMock
    );

    mockUseProfile.mockReturnValue({
      profile: null,
      loading: false,
      uploading: false,
      updateProfile: jest.fn(),
      uploadProfilePhoto: jest.fn(),
      deleteProfilePhoto: jest.fn(),
    } as any);

    mockUseWorkingHours.mockReturnValue({
      workingHours: [],
      loading: false,
      updateWorkingHour: jest.fn(),
    } as any);

    const mockNavigate = jest.fn();
    const searchParamsSpy = jest
      .spyOn(require("react-router-dom"), "useSearchParams")
      .mockReturnValue([new URLSearchParams("tutorial=true&step=2"), jest.fn()]);
    const navigateSpy = jest.spyOn(require("react-router-dom"), "useNavigate").mockReturnValue(mockNavigate);

    render(<Profile />);

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled();
    });

    expect(screen.getByTestId("onboarding-tutorial")).toBeInTheDocument();

    fireEvent.click(screen.getByText("complete tutorial"));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/settings/general?tutorial=true");
    });

    searchParamsSpy.mockRestore();
    navigateSpy.mockRestore();
  });

  it("updates working hours and surfaces a success toast", async () => {
    const profileSectionMock = createSectionMock({ fullName: "Jane", phoneNumber: "" });
    const workingHoursSectionMock = createSectionMock({ workingHours: [] });

    mockUseSettingsCategorySection.mockImplementation(({ sectionId }) =>
      sectionId === "profile" ? profileSectionMock : workingHoursSectionMock
    );

    const updateWorkingHour = jest.fn().mockResolvedValue({ success: true });

    mockUseProfile.mockReturnValue({
      profile: {
        full_name: "Jane",
        phone_number: "",
        profile_photo_url: null,
      },
      loading: false,
      uploading: false,
      updateProfile: jest.fn(),
      uploadProfilePhoto: jest.fn(),
      deleteProfilePhoto: jest.fn(),
    } as any);

    mockUseWorkingHours.mockReturnValue({
      workingHours: [
        { day_of_week: 1, start_time: "09:00:00", end_time: "17:00:00", enabled: false },
      ],
      loading: false,
      updateWorkingHour,
    } as any);

    render(<Profile />);

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled();
    });

    const switches = screen.getAllByTestId("working-hours-switch");
    fireEvent.click(switches[0]);

    await waitFor(() => {
      expect(updateWorkingHour).toHaveBeenCalledWith(1, { enabled: true });
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: "settings.profile.toasts.success",
      description: "settings.profile.toasts.workingHoursUpdated",
    });
    expect(workingHoursSectionMock.updateValue).toHaveBeenCalledWith(
      "workingHours",
      [
        { day_of_week: 1, start_time: "09:00:00", end_time: "17:00:00", enabled: false },
      ]
    );
  });
});
