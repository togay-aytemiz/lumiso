import type { ReactNode } from "react";
import { render, screen } from "@/utils/testUtils";
import Leads from "../Leads";
const mockHeader = jest.fn();

jest.mock("@/components/settings/SettingsPageWrapper", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="settings-page-wrapper">{children}</div>
  ),
}));

jest.mock("@/components/settings/SettingsHeader", () => ({
  __esModule: true,
  default: (props: any) => {
    mockHeader(props);
    return null;
  },
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

  it("does not render the legacy header", () => {
    render(<Leads />);
    expect(mockHeader).not.toHaveBeenCalled();
  });
});
