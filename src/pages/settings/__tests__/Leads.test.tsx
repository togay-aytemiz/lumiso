import type { ReactNode } from "react";
import { render, screen } from "@/utils/testUtils";
import Leads from "../Leads";
import { settingsHelpContent } from "@/lib/settingsHelpContent";

const mockHeader = jest.fn(({ title, description, helpContent }: any) => (
  <header data-testid="settings-header">
    <h1>{title}</h1>
    <p>{description}</p>
    <span data-testid="help-content">{helpContent?.title ?? ""}</span>
  </header>
));

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

jest.mock("@/components/LeadStatusesSection", () => ({
  __esModule: true,
  default: () => <section data-testid="lead-statuses-section">lead statuses</section>,
}));

jest.mock("@/components/LeadFieldsSection", () => ({
  __esModule: true,
  LeadFieldsSection: () => <section data-testid="lead-fields-section">lead fields</section>,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("Leads settings page", () => {
  beforeEach(() => {
    mockHeader.mockClear();
  });

  it("renders both lead settings sections", () => {
    render(<Leads />);

    expect(screen.getByTestId("lead-statuses-section")).toBeInTheDocument();
    expect(screen.getByTestId("lead-fields-section")).toBeInTheDocument();
  });

  it("passes the correct header props", () => {
    render(<Leads />);

    expect(mockHeader).toHaveBeenCalledTimes(1);
    expect(mockHeader.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        title: "settings.leads.title",
        description: "settings.leads.description",
        helpContent: settingsHelpContent.leads,
      })
    );
  });
});
