import type {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
} from "react";
import { render, screen, fireEvent, waitFor } from "@/utils/testUtils";
import Account from "../Account_old";
import { useProfile } from "@/contexts/ProfileContext";
import { useWorkingHours } from "@/hooks/useWorkingHours";
import { useSettingsCategorySection } from "@/hooks/useSettingsCategorySection";
import { useToast } from "@/hooks/use-toast";
import { useMessagesTranslation } from "@/hooks/useTypedTranslation";

interface SettingsHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}

interface CategorySectionProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

interface EnhancedSectionProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

interface DropdownMenuItemProps {
  children?: ReactNode;
  onSelect?: () => void;
}

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

interface MessagesTranslationHookValue {
  t: jest.Mock<string, [string, Record<string, unknown>?]>;
}

const mockHeader = jest.fn(({ title, description }: SettingsHeaderProps) => (
  <header data-testid="settings-header">
    <h1>{title}</h1>
    <p>{description}</p>
  </header>
));

const mockCategorySection = jest.fn(({ title, children }: CategorySectionProps) => (
  <section data-testid={`category-${title}`}>{children}</section>
));

const mockEnhancedSection = jest.fn(({ title, children }: EnhancedSectionProps) => (
  <section data-testid={`enhanced-${title}`}>{children}</section>
));

const mockToast = jest.fn();
const mockGetUser = jest.fn().mockResolvedValue({ data: { user: { email: "owner@example.com", id: "user-1" } } });

jest.mock("@/components/settings/SettingsPageWrapper", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="settings-page-wrapper">{children}</div>
  ),
}));

jest.mock("@/components/settings/SettingsHeader", () => ({
  __esModule: true,
  default: (props: SettingsHeaderProps) => mockHeader(props),
}));

jest.mock("@/components/settings/CategorySettingsSection", () => ({
  CategorySettingsSection: (props: CategorySectionProps) => mockCategorySection(props),
}));

jest.mock("@/components/settings/EnhancedSettingsSection", () => ({
  __esModule: true,
  default: (props: EnhancedSectionProps) => mockEnhancedSection(props),
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

jest.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children: ReactNode }) => <th>{children}</th>,
  TableCell: ({ children }: { children: ReactNode }) => <td>{children}</td>,
  TableFooter: ({ children }: { children: ReactNode }) => <tfoot>{children}</tfoot>,
  TableCaption: ({ children }: { children: ReactNode }) => <caption>{children}</caption>,
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

jest.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: DropdownMenuItemProps) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
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
jest.mock("@/hooks/useTypedTranslation");

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
const mockUseMessagesTranslation = useMessagesTranslation as jest.MockedFunction<typeof useMessagesTranslation>;

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

describe("Legacy account settings page", () => {
  beforeEach(() => {
    mockHeader.mockClear();
    mockCategorySection.mockClear();
    mockEnhancedSection.mockClear();
    mockToast.mockClear();
    mockGetUser.mockClear();

    mockUseToast.mockReturnValue({
      toasts: [],
      toast: mockToast,
      dismiss: jest.fn(),
    });
    mockUseMessagesTranslation.mockReturnValue({
      t: jest.fn((key: string) => key),
    } as MessagesTranslationHookValue);
    mockGetUser.mockResolvedValue({ data: { user: { email: "owner@example.com", id: "user-1" } } });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows a loader while profile data is loading", async () => {
    const profileSectionMock = createSectionMock({ fullName: "", phoneNumber: "" });
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

    render(<Account />);

    expect(screen.getByText("Account & Users")).toBeInTheDocument();
    expect(screen.getByText("Manage your account settings and user permissions")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled();
    });
  });

  it("preloads profile and working hours data into their sections", async () => {
    const profileSectionMock = createSectionMock({ fullName: "", phoneNumber: "" });
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
      })
    );

    render(<Account />);

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

  it("updates working hours and triggers a success toast", async () => {
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

    render(<Account />);

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled();
    });

    const switches = screen.getAllByTestId("working-hours-switch");
    fireEvent.click(switches[0]);

    await waitFor(() => {
      expect(updateWorkingHour).toHaveBeenCalledWith(1, { enabled: true });
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: "Success",
      description: "Working hours updated successfully",
    });
    expect(workingHoursSectionMock.updateValue).toHaveBeenCalledWith(
      "workingHours",
      [
        { day_of_week: 1, start_time: "09:00:00", end_time: "17:00:00", enabled: false },
      ]
    );
  });
});
