import type {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
} from "react";
import * as RouterDom from "react-router-dom";
import { render, screen, fireEvent, waitFor } from "@/utils/testUtils";
import Profile from "../Profile";
import { useProfile } from "@/hooks/useProfile";
import { useWorkingHours } from "@/hooks/useWorkingHours";
import { useSettingsCategorySection } from "@/hooks/useSettingsCategorySection";
import { useToast } from "@/hooks/use-toast";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useOrganization } from "@/contexts/OrganizationContext";

const mockHeader = jest.fn();

interface CategorySectionProps {
  title: string;
  children?: ReactNode;
}

const mockCategorySection = jest.fn(({ title, children }: CategorySectionProps) => (
  <section data-testid={`category-${title}`}>{children}</section>
));

interface OnboardingTutorialProps {
  onComplete: () => void;
  onExit: () => void;
}

const mockOnboardingTutorial = jest.fn(({ onComplete, onExit }: OnboardingTutorialProps) => (
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
  default: (props: Record<string, unknown>) => {
    mockHeader(props);
    return null;
  },
}));

jest.mock("@/components/settings/CategorySettingsSection", () => ({
  CategorySettingsSection: (props: CategorySectionProps) => mockCategorySection(props),
}));

jest.mock("@/components/shared/OnboardingTutorial", () => ({
  OnboardingTutorial: (props: OnboardingTutorialProps) => mockOnboardingTutorial(props),
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
  Button: ({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...rest}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange, ...rest }: InputHTMLAttributes<HTMLInputElement>) => (
    <input value={value} onChange={onChange} {...rest} />
  ),
}));

jest.mock("@/components/ui/label", () => ({
  Label: ({ children, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) => (
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
  Select: ({
    value,
    onValueChange,
    children,
    ...rest
  }: SelectHTMLAttributes<HTMLSelectElement> & { onValueChange?: (next: string) => void }) => (
    <select
      data-testid={`working-hours-select-${value}`}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
      {...rest}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children?: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
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
jest.mock("@/hooks/useProfile", () => ({
  useProfile: jest.fn(),
}));
jest.mock("@/hooks/useWorkingHours", () => ({
  useWorkingHours: jest.fn(),
}));
jest.mock("@/hooks/useSettingsCategorySection", () => ({
  useSettingsCategorySection: jest.fn(),
}));
jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}));
jest.mock("@/contexts/OnboardingContext", () => ({
  useOnboarding: jest.fn(),
}));
jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(),
}));

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

interface WorkingHour {
  day_of_week: number;
  start_time: string | null;
  end_time: string | null;
  enabled: boolean;
}

interface ProfileData {
  full_name?: string;
  phone_number?: string;
  profile_photo_url?: string | null;
}

interface ProfileHookValue {
  profile: ProfileData | null;
  loading: boolean;
  uploading: boolean;
  updateProfile: jest.Mock<Promise<{ success: boolean; error?: unknown }>, [Partial<ProfileData>]>;
  uploadProfilePhoto: jest.Mock<Promise<{ success: boolean; url?: string; error?: unknown }>, [File]>;
  deleteProfilePhoto: jest.Mock<Promise<{ success: boolean; error?: unknown }>, []>;
  refreshProfile: jest.Mock<Promise<void>, []>;
}

interface WorkingHoursHookValue {
  workingHours: WorkingHour[];
  loading: boolean;
  updateWorkingHour: jest.Mock<Promise<{ success: boolean; error?: unknown }>, [number, Partial<WorkingHour>]>;
  refetch: jest.Mock<Promise<void>, []>;
}

interface SettingsCategorySectionArgs {
  sectionId: string;
}

interface SectionController<T extends Record<string, unknown>> {
  values: T;
  setValues: jest.Mock<void, [T]>;
  updateValue: jest.Mock<void, [string, unknown]>;
  handleSave: jest.Mock<Promise<void>, []>;
  handleCancel: jest.Mock<void, []>;
  isDirty: boolean;
}

interface OnboardingHookValue {
  stage: string;
  currentStep: number;
  loading: boolean;
  shouldShowWelcomeModal: boolean;
  isInGuidedSetup: boolean;
  isOnboardingComplete: boolean;
  shouldLockNavigation: boolean;
  currentStepInfo: unknown;
  nextStepInfo: unknown;
  completedSteps: unknown[];
  isAllStepsComplete: boolean;
  totalSteps: number;
  startGuidedSetup: jest.Mock<Promise<void>, []>;
  completeCurrentStep: jest.Mock<Promise<void>, []>;
  completeMultipleSteps: jest.Mock<Promise<void>, [number]>;
  completeOnboarding: jest.Mock<Promise<void>, []>;
  skipOnboarding: jest.Mock<Promise<void>, []>;
  resetOnboarding: jest.Mock<Promise<void>, []>;
}

interface OrganizationHookValue {
  activeOrganizationId: string | null;
  activeOrganization: { name?: string } | null;
  loading: boolean;
  refreshOrganization: jest.Mock<Promise<void>, []>;
  setActiveOrganization: jest.Mock<Promise<void>, [string]>;
}

const mockUseProfile = useProfile as jest.MockedFunction<typeof useProfile>;
const mockUseWorkingHours = useWorkingHours as jest.MockedFunction<typeof useWorkingHours>;
const mockUseSettingsCategorySection = useSettingsCategorySection as jest.MockedFunction<typeof useSettingsCategorySection>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;
const mockUseOnboarding = useOnboarding as jest.MockedFunction<typeof useOnboarding>;
const mockUseOrganization = useOrganization as jest.MockedFunction<typeof useOrganization>;

const createSectionMock = <T extends Record<string, unknown>>(initialValues: T): SectionController<T> => ({
  values: initialValues,
  setValues: jest.fn(),
  updateValue: jest.fn(),
  handleSave: jest.fn(),
  handleCancel: jest.fn(),
  isDirty: false,
});

const createProfileHookValue = (overrides: Partial<ProfileHookValue> = {}): ProfileHookValue => ({
  profile: null,
  loading: false,
  uploading: false,
  updateProfile: jest.fn(async () => ({ success: true })),
  uploadProfilePhoto: jest.fn(async () => ({ success: true })),
  deleteProfilePhoto: jest.fn(async () => ({ success: true })),
  refreshProfile: jest.fn(async () => {}),
  ...overrides,
});

const createWorkingHoursHookValue = (
  overrides: Partial<WorkingHoursHookValue> = {}
): WorkingHoursHookValue => ({
  workingHours: [],
  loading: false,
  updateWorkingHour: jest.fn(async () => ({ success: true })),
  refetch: jest.fn(async () => {}),
  ...overrides,
});

describe("Profile settings page", () => {
  beforeEach(() => {
    mockHeader.mockClear();
    mockCategorySection.mockClear();
    mockOnboardingTutorial.mockClear();
    mockToast.mockClear();
    mockCompleteStep.mockClear();
    mockGetUser.mockClear();

    (RouterDom.useSearchParams as jest.MockedFunction<typeof RouterDom.useSearchParams>).mockReturnValue([
      new URLSearchParams(),
      jest.fn(),
    ] as ReturnType<typeof RouterDom.useSearchParams>);
    (RouterDom.useNavigate as jest.MockedFunction<typeof RouterDom.useNavigate>).mockReturnValue(jest.fn());

    mockUseToast.mockReturnValue({
      toasts: [],
      toast: mockToast,
      dismiss: jest.fn(),
    });
    mockUseOnboarding.mockReturnValue({
      stage: "in_progress",
      currentStep: 1,
      loading: false,
      shouldShowWelcomeModal: false,
      isInGuidedSetup: false,
      isOnboardingComplete: false,
      shouldLockNavigation: false,
      currentStepInfo: null,
      nextStepInfo: null,
      completedSteps: [],
      isAllStepsComplete: false,
      totalSteps: 3,
      startGuidedSetup: jest.fn(async () => {}),
      completeCurrentStep: mockCompleteStep,
      completeMultipleSteps: jest.fn(async () => {}),
      completeOnboarding: jest.fn(async () => {}),
      skipOnboarding: jest.fn(async () => {}),
      resetOnboarding: jest.fn(async () => {}),
    });
    mockUseOrganization.mockReturnValue({
      activeOrganizationId: "org-123",
      activeOrganization: { name: "Studio" },
      loading: false,
      refreshOrganization: jest.fn(async () => {}),
      setActiveOrganization: jest.fn(async () => {}),
    });
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

    mockUseSettingsCategorySection.mockImplementation(({ sectionId }: SettingsCategorySectionArgs) =>
      sectionId === "profile" ? profileSectionMock : workingHoursSectionMock
    );

    mockUseProfile.mockReturnValue(
      createProfileHookValue({
        profile: null,
        loading: true,
        uploading: false,
      })
    );

    mockUseWorkingHours.mockReturnValue(
      createWorkingHoursHookValue({
        workingHours: [],
        loading: false,
      })
    );

    render(<Profile />);

    expect(screen.getByTestId("settings-loading-skeleton")).toBeInTheDocument();
    expect(mockHeader).not.toHaveBeenCalled();

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

    mockUseSettingsCategorySection.mockImplementation(({ sectionId }: SettingsCategorySectionArgs) =>
      sectionId === "profile" ? profileSectionMock : workingHoursSectionMock
    );

    mockUseProfile.mockReturnValue(
      createProfileHookValue({
        profile: {
          full_name: "Jane Doe",
          phone_number: "+1 555 0100",
          profile_photo_url: null,
        },
        loading: false,
        uploading: false,
      })
    );

    mockUseWorkingHours.mockReturnValue(
      createWorkingHoursHookValue({
        workingHours: [
          { day_of_week: 1, start_time: "09:00:00", end_time: "17:00:00", enabled: true },
        ],
        loading: false,
        updateWorkingHour: jest.fn(async () => ({ success: true })),
      })
    );

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

    mockUseSettingsCategorySection.mockImplementation(({ sectionId }: SettingsCategorySectionArgs) =>
      sectionId === "profile" ? profileSectionMock : workingHoursSectionMock
    );

    mockUseProfile.mockReturnValue(
      createProfileHookValue({
        profile: null,
        loading: false,
        uploading: false,
      })
    );

    mockUseWorkingHours.mockReturnValue(
      createWorkingHoursHookValue({
        workingHours: [],
        loading: false,
      })
    );

    const mockNavigate = jest.fn();
    const searchParamsMock = RouterDom.useSearchParams as jest.MockedFunction<
      typeof RouterDom.useSearchParams
    >;
    searchParamsMock.mockReturnValue([
      new URLSearchParams("tutorial=true&step=2"),
      jest.fn(),
    ] as ReturnType<typeof RouterDom.useSearchParams>);
    const navigateMock = RouterDom.useNavigate as jest.MockedFunction<typeof RouterDom.useNavigate>;
    navigateMock.mockReturnValue(mockNavigate as ReturnType<typeof RouterDom.useNavigate>);

    render(<Profile />);

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled();
    });

    expect(screen.getByTestId("onboarding-tutorial")).toBeInTheDocument();

    fireEvent.click(screen.getByText("complete tutorial"));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/settings/general?tutorial=true");
    });

    searchParamsMock.mockReturnValue([
      new URLSearchParams(),
      jest.fn(),
    ] as ReturnType<typeof RouterDom.useSearchParams>);
    navigateMock.mockReturnValue(jest.fn());
  });

  it("updates working hours and surfaces a success toast", async () => {
    const profileSectionMock = createSectionMock({ fullName: "Jane", phoneNumber: "" });
    const workingHoursSectionMock = createSectionMock({ workingHours: [] });

    mockUseSettingsCategorySection.mockImplementation(({ sectionId }: SettingsCategorySectionArgs) =>
      sectionId === "profile" ? profileSectionMock : workingHoursSectionMock
    );

    const updateWorkingHour: WorkingHoursHookValue["updateWorkingHour"] = jest.fn(
      async () => ({ success: true })
    );

    mockUseProfile.mockReturnValue(
      createProfileHookValue({
        profile: {
          full_name: "Jane",
          phone_number: "",
          profile_photo_url: null,
        },
        loading: false,
        uploading: false,
      })
    );

    mockUseWorkingHours.mockReturnValue(
      createWorkingHoursHookValue({
        workingHours: [
          { day_of_week: 1, start_time: "09:00:00", end_time: "17:00:00", enabled: false },
        ],
        loading: false,
        updateWorkingHour,
      })
    );

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
