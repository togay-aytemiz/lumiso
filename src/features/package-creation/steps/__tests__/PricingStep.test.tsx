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

  it("shows inclusive pricing summary by default and hides add-on client total row", () => {
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
        depositMode: "percent_subtotal",
      },
    };

    renderWithState(overrides);

    expect(
      screen.getByLabelText("Package price (TRY)")
    ).toHaveValue(18000);

    const addOnRowWrapper = screen
      .getByText("Package + services total")
      .parentElement?.parentElement as HTMLElement;
    expect(addOnRowWrapper).toHaveClass("max-h-0");

    expect(
      screen.getByText("Client total equals the package price.")
    ).toBeInTheDocument();
  });

  it("switches to add-on mode and reveals client total row", () => {
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
        depositMode: "percent_subtotal",
      },
    };

    renderWithState(overrides);

    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[1]);

    const addOnRowWrapper = screen
      .getByText("Package + services total")
      .parentElement?.parentElement as HTMLElement;

    expect(addOnRowWrapper).toHaveClass("max-h-24");
    expect(
      screen.getByText("Client total is the package price plus selected services.")
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
        depositMode: "percent_subtotal",
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

  it("shows auto-target note in inclusive mode and segmented control when add-ons mode is active", () => {
    const overrides: DeepPartial<PackageCreationState> = {
      services: {
        items: [
          {
            id: "line-1",
            type: "existing",
            name: "Retouching",
            serviceId: "svc-1",
            quantity: 1,
            unitCost: 200,
            unitPrice: 600,
          },
        ],
      },
      pricing: {
        basePrice: "10000",
        includeAddOnsInPrice: true,
        depositMode: "percent_subtotal",
        enableDeposit: true,
        depositValue: "30",
      },
    };

    renderWithState(overrides);

    const noteWrapper = screen
      .getByText(
        "When add-ons live inside the package price, the deposit uses the package price."
      )
      .parentElement as HTMLElement;
    expect(noteWrapper).toHaveClass("max-h-20");
    const initialSegmentWrapper = screen
      .getByText("Package price only")
      .parentElement?.parentElement as HTMLElement;
    expect(initialSegmentWrapper).toHaveClass("max-h-0");

    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[1]);

    expect(noteWrapper).toHaveClass("max-h-0");
    const segmentWrapper = screen
      .getByText("Package price only")
      .parentElement?.parentElement as HTMLElement;
    expect(segmentWrapper).toHaveClass("max-h-24");
    expect(
      screen.getByRole("button", { name: "Package + services total" })
    ).toBeInTheDocument();
  });
});
