import { render, screen } from "@testing-library/react";
import SettingsLayout from "../SettingsLayout";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createElement, type SVGProps } from "react";

const useSettingsContextMock = jest.fn();
const useOnboardingMock = jest.fn();
const toastMock = jest.fn();

const translations: Record<string, string> = {
  "settings.title": "Settings",
  "settings.personalSettings": "Personal",
  "settings.organizationSettings": "Organization",
  "settings.profile": "Profile",
  "settings.notifications": "Notifications",
  "settings.general": "General",
  "settings.projects": "Projects",
  "settings.leads": "Leads",
  "settings.services": "Services",
  "settings.contracts": "Contracts",
  "settings.billing": "Billing",
  "settings.dangerZone": "Danger Zone",
  "settings.currentlyViewing": "Currently viewing",
  "settings.completeGuidedSetup": "Complete guided setup to unlock settings",
  "buttons.needHelp": "Need Help",
  "buttons.close": "Close",
  "toast.settingsSavedTitle": "Saved",
  "toast.settingsSavedDescription": "Changes saved",
  "toast.settingsDiscardedTitle": "Discarded",
  "toast.settingsDiscardedDescription": "Changes discarded",
  "settings.projects.title": "Projects & Sessions",
  "settings.projects.description": "Manage project preferences",
  "settings.general.title": "General",
  "settings.general.description": "Manage general preferences",
};

jest.mock("@/contexts/SettingsContext", () => ({
  useSettingsContext: () => useSettingsContextMock(),
}));

jest.mock("@/contexts/useOnboarding", () => ({
  useOnboarding: () => useOnboardingMock(),
}));

jest.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

jest.mock("@/hooks/useSettingsNavigation", () => ({
  useSettingsNavigation: () => ({
    showGuard: false,
    message: "",
    handleNavigationAttempt: () => true,
    handleModalClose: () => true,
    handleDiscardChanges: jest.fn(),
    handleStayOnPage: jest.fn(),
    handleSaveAndExit: undefined,
  }),
}));

jest.mock("lucide-react", () =>
  new Proxy(
    {},
    {
      get:
        (_target, property: PropertyKey) =>
        (props: SVGProps<SVGSVGElement>) =>
          createElement("svg", {
            "data-icon": String(property),
            ...props,
          }),
    }
  )
);

const renderLayout = (
  initialPath: string = "/settings/projects",
  enableOverlay: boolean = true
) => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/settings/*"
          element={<SettingsLayout enableOverlay={enableOverlay} />}
        >
          <Route path="*" element={<div data-testid="settings-content" />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

describe("SettingsLayout", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: jest.fn(),
      writable: true,
    });
    useSettingsContextMock.mockReturnValue({
      hasCategoryChanges: (href: string) => href === "/settings/projects",
      cancelCategoryChanges: jest.fn(),
      saveCategoryChanges: jest.fn().mockResolvedValue(undefined),
      categoryChanges: {},
    });
    useOnboardingMock.mockReturnValue({
      shouldLockNavigation: false,
    });
    toastMock.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.skip("renders navigation links and highlights active routes", () => {
    renderLayout();

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Close/i })).toBeInTheDocument();
    expect(screen.getByText("Need Help")).toBeInTheDocument();
    expect(screen.getAllByText("Projects & Sessions").length).toBeGreaterThan(0);

    const projectLinks = screen.getAllByRole("link", { name: /Projects/i });
    expect(projectLinks.length).toBeGreaterThanOrEqual(1);
    expect(projectLinks[0].getAttribute("href")).toBe("/settings/projects");

    expect(screen.getByTestId("settings-content")).toBeInTheDocument();
  });

  it("locks navigation when guided onboarding requires completion", () => {
    useOnboardingMock.mockReturnValue({
      shouldLockNavigation: true,
    });

    renderLayout();

    const projectsNav = document.querySelector('[data-walkthrough="projects-section"]') as HTMLElement;
    expect(projectsNav.tagName).toBe("DIV");
    expect(
      screen.getAllByText("Complete guided setup to unlock settings").length
    ).toBeGreaterThan(0);
  });

  it("retains navigation as links for unlocked items", () => {
    renderLayout("/settings/general");

    const generalLinks = screen.getAllByRole("link", { name: /General/i });
    expect(generalLinks[0]).toHaveAttribute("href", "/settings/general");
  });
});
