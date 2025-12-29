import React from "react";
import { render, screen, fireEvent, waitFor } from "@/utils/testUtils";
import * as reactRouterDom from "react-router-dom";
import General from "../General";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { useSettingsCategorySection } from "@/hooks/useSettingsCategorySection";

jest.mock("@/components/settings/SettingsPageWrapper", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="settings-page-wrapper">{children}</div>
  ),
}));

jest.mock("@/components/settings/SettingsHeader", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/settings/CategorySettingsSection", () => ({
  CategorySettingsSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section data-testid={`settings-section-${title}`}>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

jest.mock("@/components/LanguageSwitcher", () => ({
  __esModule: true,
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

jest.mock("@/components/TimezoneSelector", () => ({
  TimezoneSelector: ({ value, onValueChange }: { value: string; onValueChange: (val: string) => void }) => (
    <select
      data-testid="timezone-selector"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="UTC">UTC</option>
      <option value="Europe/Istanbul">Europe/Istanbul</option>
    </select>
  ),
}));

const mockCompleteStep = jest.fn();

jest.mock("@/components/shared/OnboardingTutorial", () => ({
  OnboardingTutorial: ({ onComplete, onExit }: { onComplete: () => void; onExit: () => void }) => (
    <div data-testid="onboarding-tutorial">
      <button type="button" onClick={onComplete}>
        complete tutorial
      </button>
      <button type="button" onClick={onExit}>
        exit tutorial
      </button>
    </div>
  ),
}));

jest.mock("@/components/ui/loading-presets", () => ({
  SettingsLoadingSkeleton: ({ rows }: { rows: number }) => (
    <div data-testid="settings-loading-skeleton">loading {rows}</div>
  ),
}));

const mockSettingsContext = {
  dirtySections: new Set<string>(),
  addDirtySection: jest.fn(),
  removeDirtySection: jest.fn(),
  clearAllDirtySections: jest.fn(),
  hasDirtySections: false,
  categoryChanges: {},
  registerSectionHandler: jest.fn(),
  unregisterSectionHandler: jest.fn(),
  setSectionDirty: jest.fn(),
  getCategoryDirtySections: jest.fn(() => []),
  hasCategoryChanges: jest.fn(() => false),
  saveCategoryChanges: jest.fn(async () => undefined),
  cancelCategoryChanges: jest.fn(),
};

jest.mock("@/contexts/SettingsContext", () => ({
  useSettingsContext: () => mockSettingsContext,
}));

jest.mock("@/hooks/useOrganizationSettings");
jest.mock("@/hooks/useSettingsCategorySection");
jest.mock("@/contexts/useOnboarding", () => ({
  useOnboarding: jest.fn(() => ({
    completeCurrentStep: mockCompleteStep,
  })),
}));

jest.mock("@/lib/dateFormatUtils", () => ({
  detectBrowserTimezone: () => "UTC",
  detectBrowserHourFormat: () => "24-hour",
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockUseOrganizationSettings = useOrganizationSettings as jest.MockedFunction<typeof useOrganizationSettings>;
const mockUseSettingsCategorySection = useSettingsCategorySection as jest.MockedFunction<typeof useSettingsCategorySection>;

const createSectionMock = () => ({
  values: {
    companyName: "",
    businessEmail: "",
    businessPhone: "",
    brandColor: "#1EB29F",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12-hour",
    timezone: "UTC",
  },
  setValues: jest.fn(),
  updateValue: jest.fn(),
  handleSave: jest.fn(),
  handleCancel: jest.fn(),
  isDirty: false,
});

const renderGeneral = () => render(<General />);

describe("General settings page", () => {
  beforeEach(() => {
    jest.spyOn(reactRouterDom, "useSearchParams").mockReturnValue([new URLSearchParams(), jest.fn()]);
    jest.spyOn(reactRouterDom, "useNavigate").mockReturnValue(jest.fn());

    const brandingSectionMock = createSectionMock();
    const regionalSectionMock = createSectionMock();

    mockUseSettingsCategorySection.mockImplementation(({ sectionId }) =>
      sectionId === "branding" ? brandingSectionMock : regionalSectionMock
    );

    mockUseOrganizationSettings.mockReturnValue({
      settings: {
        photography_business_name: "Studio",
        email: "studio@example.com",
        phone: "+123456789",
        primary_brand_color: "#ff0000",
        date_format: "MM/DD/YYYY",
        time_format: "24-hour",
        timezone: "Europe/Istanbul",
        logo_url: null,
      },
      loading: false,
      uploading: false,
      updateSettings: jest.fn().mockResolvedValue({ success: true }),
      uploadLogo: jest.fn(),
      deleteLogo: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("renders a loading skeleton when data is loading", () => {
    mockUseOrganizationSettings.mockReturnValueOnce({
      settings: null,
      loading: true,
      uploading: false,
      updateSettings: jest.fn(),
      uploadLogo: jest.fn(),
      deleteLogo: jest.fn(),
    });

    renderGeneral();

    expect(screen.getByTestId("settings-loading-skeleton")).toBeInTheDocument();
  });

  it("starts the onboarding tutorial when the tutorial query parameter is present", async () => {
    jest.spyOn(reactRouterDom, "useSearchParams").mockReturnValue([new URLSearchParams("tutorial=true"), jest.fn()]);
    const mockNavigate = jest.fn();
    jest.spyOn(reactRouterDom, "useNavigate").mockReturnValue(mockNavigate);

    renderGeneral();

    fireEvent.click(screen.getByText("complete tutorial"));

    await waitFor(() => {
      expect(mockCompleteStep).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/getting-started");
    });
  });

  it("preloads settings into section state when data is available", () => {
    const brandingSectionMock = createSectionMock();
    const regionalSectionMock = createSectionMock();

    mockUseSettingsCategorySection.mockImplementation(({ sectionId }) =>
      sectionId === "branding" ? brandingSectionMock : regionalSectionMock
    );

    renderGeneral();

    expect(brandingSectionMock.setValues).toHaveBeenCalledWith({
      companyName: "Studio",
      businessEmail: "studio@example.com",
      businessPhone: "+123456789",
      brandColor: "#ff0000",
    });

    expect(regionalSectionMock.setValues).toHaveBeenCalledWith({
      dateFormat: "MM/DD/YYYY",
      timeFormat: "24-hour",
      timezone: "Europe/Istanbul",
    });
  });
});
