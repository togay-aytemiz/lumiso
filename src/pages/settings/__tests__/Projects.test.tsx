import React from "react";
import { render, screen } from "@/utils/testUtils";
import Projects from "../Projects";
import { settingsHelpContent } from "@/lib/settingsHelpContent";

const mockSettingsHeader = jest.fn(() => <div data-testid="settings-header" />);

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/components/settings/SettingsHeader", () => ({
  __esModule: true,
  default: (props: any) => mockSettingsHeader(props),
}));

jest.mock("@/components/settings/SettingsPageWrapper", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="settings-page-wrapper">{children}</div>
  ),
}));

jest.mock("@/components/ProjectStatusesSection", () => ({
  __esModule: true,
  default: () => <div data-testid="project-statuses-section" />,
}));

jest.mock("@/components/ProjectTypesSection", () => ({
  __esModule: true,
  default: () => <div data-testid="project-types-section" />,
}));

jest.mock("@/components/SessionStatusesSection", () => ({
  __esModule: true,
  default: () => <div data-testid="session-statuses-section" />,
}));

describe("Projects settings page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all project-related settings sections", () => {
    render(<Projects />);

    expect(screen.getByTestId("settings-page-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("project-statuses-section")).toBeInTheDocument();
    expect(screen.getByTestId("project-types-section")).toBeInTheDocument();
    expect(screen.getByTestId("session-statuses-section")).toBeInTheDocument();

    expect(mockSettingsHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "settings.projects.title",
        description: "settings.projects.description",
        helpContent: settingsHelpContent.projects,
      }),
      {}
    );
  });
});
