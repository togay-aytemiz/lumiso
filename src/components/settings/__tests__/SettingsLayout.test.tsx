import { render, screen } from "@testing-library/react";
import SettingsLayout from "../SettingsLayout";
import { MemoryRouter, Route, Routes } from "react-router-dom";

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
  "settings.completeGuidedSetup": "Complete guided setup to unlock settings",
};

jest.mock("@/contexts/SettingsContext", () => ({
  useSettingsContext: () => useSettingsContextMock(),
}));

jest.mock("@/contexts/OnboardingContext", () => ({
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

jest.mock("lucide-react", () => {
  const React = require("react");
  return new Proxy(
    {},
    {
      get: (_target, property: PropertyKey) => (props: any) =>
        React.createElement("svg", {
          "data-icon": String(property),
          ...props,
        }),
    }
  );
});

const renderLayout = (initialPath: string = "/settings/projects") => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/settings/*" element={<SettingsLayout />}>
          <Route path="*" element={<div data-testid="settings-content" />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

describe("SettingsLayout", () => {
  beforeEach(() => {
    useSettingsContextMock.mockReturnValue({
      hasCategoryChanges: (href: string) => href === "/settings/projects",
      cancelCategoryChanges: jest.fn(),
      saveCategoryChanges: jest.fn().mockResolvedValue(undefined),
    });
    useOnboardingMock.mockReturnValue({
      shouldLockNavigation: false,
    });
    toastMock.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders navigation links and highlights active routes", () => {
    renderLayout();

    const projectsNav = document.querySelector(
      '[data-walkthrough="projects-section"]'
    ) as HTMLElement;
    expect(projectsNav).toBeTruthy();
    expect(projectsNav.tagName).toBe("A");
    expect(projectsNav.querySelector(".animate-pulse")).toBeTruthy();

    const content = screen.getByTestId("settings-content");
    expect(content).toBeInTheDocument();
  });

  it("locks navigation when guided onboarding requires completion", () => {
    useOnboardingMock.mockReturnValue({
      shouldLockNavigation: true,
    });

    renderLayout();

    const projectsNav = document.querySelector(
      '[data-walkthrough="projects-section"]'
    ) as HTMLElement;
    expect(projectsNav.tagName).toBe("DIV");
    expect(
      screen.getAllByText("Complete guided setup to unlock settings").length
    ).toBeGreaterThan(0);
  });

  it("retains navigation as links for unlocked items", () => {
    renderLayout("/settings/general");

    const generalNav = document.querySelector(
      '[data-walkthrough="general-section"]'
    ) as HTMLElement;
    expect(generalNav.tagName).toBe("A");
    expect(generalNav).toHaveAttribute("href", "/settings/general");
  });
});
