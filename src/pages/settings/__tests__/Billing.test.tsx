import type { ReactNode } from "react";
import { render, screen } from "@/utils/testUtils";
import Billing from "../Billing";
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

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("Billing settings page", () => {
  beforeEach(() => {
    mockHeader.mockClear();
  });

  it("renders the billing header and coming soon copy", () => {
    render(<Billing />);

    expect(screen.getByTestId("settings-page-wrapper")).toBeInTheDocument();
    expect(screen.getByText("settings.billing.title")).toBeInTheDocument();
    expect(screen.getByText("settings.billing.description")).toBeInTheDocument();
    expect(screen.getByText("settings.billing.comingSoon")).toBeInTheDocument();
  });

  it("passes the correct help content to the settings header", () => {
    render(<Billing />);

    expect(mockHeader).toHaveBeenCalledTimes(1);
    expect(mockHeader.mock.calls[0][0].helpContent).toBe(settingsHelpContent.billing);
  });
});
