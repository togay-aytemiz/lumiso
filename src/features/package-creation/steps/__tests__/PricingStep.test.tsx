import React, { ReactNode, useReducer } from "react";
import { fireEvent, render, screen } from "@/utils/testUtils";
import { PricingStep } from "../PricingStep";
import {
  createInitialPackageCreationState,
  packageCreationReducer,
} from "../../state/packageCreationReducer";
import { PackageCreationContext } from "../../context/PackageCreationProvider";
import type { PackageCreationState } from "../../types";
import en from "@/i18n/resources/en/packageCreation.json";
import { useTranslation } from "react-i18next";

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

jest.mock("@/hooks/useOrganizationData", () => {
  const actual = jest.requireActual("@/hooks/useOrganizationData");
  return {
    ...actual,
    useOrganizationTaxProfile: jest.fn(() => ({
      data: {
        defaultVatRate: 18,
        defaultVatMode: "inclusive",
      },
      isLoading: false,
      error: null,
    })),
  };
});

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

const getTranslation = (key: string): string | undefined => {
  const parts = key.split(".");
  let current: any = en;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
};

const applyInterpolation = (
  template: string,
  options?: Record<string, unknown>
): string => {
  if (!options) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    const replacement = options[key];
    return replacement !== undefined ? String(replacement) : match;
  });
};

const mergeState = <T extends object>(target: T, source?: DeepPartial<T>): T => {
  if (!source) return target;
  const output = Array.isArray(target)
    ? ([...target] as unknown as T)
    : ({ ...target } as T);

  Object.entries(source).forEach(([key, value]) => {
    if (value === undefined) return;
    const typedKey = key as keyof T;
    const originalValue = (output as any)[typedKey];
    if (
      originalValue &&
      typeof originalValue === "object" &&
      !Array.isArray(originalValue) &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      (output as any)[typedKey] = mergeState(originalValue, value);
    } else {
      (output as any)[typedKey] = value;
    }
  });

  return output;
};

interface ProviderProps {
  initial: PackageCreationState;
  children: ReactNode;
}

const TestProvider = ({ initial, children }: ProviderProps) => {
  const [state, dispatch] = useReducer(packageCreationReducer, initial);
  return (
    <PackageCreationContext.Provider value={{ state, dispatch }}>
      {children}
    </PackageCreationContext.Provider>
  );
};

const renderWithState = (overrides?: DeepPartial<PackageCreationState>) => {
  const base = createInitialPackageCreationState();
  const withServices = mergeState(base, overrides);
  return render(<PricingStep />, {
    wrapper: ({ children }) => (
      <TestProvider initial={withServices}>{children}</TestProvider>
    ),
  });
};

describe("PricingStep", () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({
      t: (
        key: string,
        options?: { defaultValue?: string } & Record<string, unknown>
      ) =>
        applyInterpolation(
          getTranslation(key) ?? options?.defaultValue ?? key,
          options
        ),
    });
  });

  it("renders default package VAT summary and stats", () => {
    const overrides: DeepPartial<PackageCreationState> = {
      services: {
        items: [
          {
            id: "line-1",
            type: "existing",
            name: "Drone",
            serviceId: "svc-1",
            quantity: 1,
            unitCost: 250,
            unitPrice: 750,
          },
        ],
      },
      pricing: {
        basePrice: "18000",
        includeAddOnsInPrice: true,
      },
    };

    renderWithState(overrides);

    expect(screen.getByLabelText("Package price (TRY)")).toHaveValue(18000);
    expect(
      screen.getByText(
        "This amount applies VAT %18 with Included in price handling."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Package (incl. VAT)")).toBeInTheDocument();
  });

  it("switches to add-on mode and updates helper text", () => {
    const overrides: DeepPartial<PackageCreationState> = {
      services: {
        items: [
          {
            id: "line-1",
            type: "existing",
            name: "Second Shooter",
            serviceId: "svc-1",
            quantity: 1,
            unitCost: 400,
            unitPrice: 1200,
          },
        ],
      },
      pricing: {
        basePrice: "15000",
        includeAddOnsInPrice: true,
      },
    };

    renderWithState(overrides);

    fireEvent.click(screen.getByText("Bill add-ons on top of the package"));

    expect(
      screen.getByText(/This combines the package price with selected services\./)
    ).toBeInTheDocument();
  });

  it("enables deposit configuration when toggled on", () => {
    const overrides: DeepPartial<PackageCreationState> = {
      services: {
        items: [
          {
            id: "line-1",
            type: "existing",
            name: "Album",
            serviceId: "svc-1",
            quantity: 1,
            unitCost: 300,
            unitPrice: 900,
          },
        ],
      },
      pricing: {
        basePrice: "12000",
        includeAddOnsInPrice: false,
        enableDeposit: false,
      },
    };

    renderWithState(overrides);

    const switchControl = screen.getByRole("switch", { name: "Deposit" });
    fireEvent.click(switchControl);

    expect(
      screen.getByRole("button", { name: "Percentage" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fixed amount" })
    ).toBeInTheDocument();
  });

  it("allows overriding package VAT values", () => {
    renderWithState({
      pricing: {
        basePrice: "15000",
        includeAddOnsInPrice: true,
      },
    });

    const toggle = screen.getByRole("button", { name: "I want to modify VAT" });
    fireEvent.click(toggle);

    const rateInput = screen.getByLabelText("VAT rate (%)");
    fireEvent.change(rateInput, { target: { value: "10" } });

    expect(rateInput).toHaveValue(10);
    expect(
      screen.getByText(
        "This amount applies VAT %10 with Included in price handling."
      )
    ).toBeInTheDocument();
  });
});
