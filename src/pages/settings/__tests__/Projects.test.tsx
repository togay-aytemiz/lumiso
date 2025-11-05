import React from "react";
import { render, screen } from "@/utils/testUtils";
import Projects from "../Projects";
const mockSettingsHeader = jest.fn();

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/components/settings/SettingsHeader", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockSettingsHeader(props);
    return null;
  },
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

    expect(mockSettingsHeader).not.toHaveBeenCalled();
  });
});
