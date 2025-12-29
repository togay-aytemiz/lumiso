import type { ReactNode } from "react";
import { render, screen } from "@/utils/testUtils";
import Billing from "../Billing";

jest.mock("@/components/settings/SettingsPageWrapper", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="settings-page-wrapper">{children}</div>
  ),
}));

jest.mock("@/hooks/useOrganizationSettings", () => {
  const settings = {
    taxProfile: {
      legalEntityType: "company",
      vatExempt: false,
      taxOffice: "",
      taxNumber: "",
      address: "",
      city: "",
      country: "",
    },
  };
  const updateSettings = jest.fn();
  const uploadLogo = jest.fn();
  const deleteLogo = jest.fn();

  return {
    useOrganizationSettings: () => ({
      settings,
      loading: false,
      uploading: false,
      updateSettings,
      uploadLogo,
      deleteLogo,
    }),
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/contexts/SettingsContext", () => {
  const categoryChanges = {};
  const registerSectionHandler = jest.fn();
  const unregisterSectionHandler = jest.fn();
  const setSectionDirty = jest.fn();

  return {
    useSettingsContext: () => ({
      categoryChanges,
      registerSectionHandler,
      unregisterSectionHandler,
      setSectionDirty,
    }),
  };
});

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
