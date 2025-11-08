import type { ReactNode } from "react";
import { render, screen } from "@/utils/testUtils";
import Billing from "../Billing";

jest.mock("@/components/settings/SettingsPageWrapper", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="settings-page-wrapper">{children}</div>
  ),
}));

jest.mock("@/hooks/useOrganizationSettings", () => ({
  useOrganizationSettings: () => ({
    settings: {
      taxProfile: {
        taxOffice: "",
        taxNumber: "",
        address: "",
        city: "",
        country: "",
      },
    },
    loading: false,
    uploading: false,
    updateSettings: jest.fn(),
    uploadLogo: jest.fn(),
    deleteLogo: jest.fn(),
  }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("Billing settings page", () => {
  it("renders billing copy", () => {
    render(<Billing />);

    expect(screen.getByTestId("settings-page-wrapper")).toBeInTheDocument();
    expect(
      screen.getByText("settings.billing.companySectionTitle")
    ).toBeInTheDocument();
    expect(
      screen.getByText("settings.billing.taxSectionTitle")
    ).toBeInTheDocument();
    expect(
      screen.getByText("settings.billing.paymentMethodsPlaceholder")
    ).toBeInTheDocument();
  });
});
