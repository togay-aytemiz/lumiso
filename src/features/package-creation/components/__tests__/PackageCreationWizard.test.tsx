import React, { ReactNode, useReducer } from "react";
import { fireEvent, render, screen } from "@/utils/testUtils";
import { PackageCreationWizard } from "../../components/PackageCreationWizard";
import { PackageCreationContext } from "../../context/PackageCreationProvider";
import {
  createInitialPackageCreationState,
  packageCreationReducer,
} from "../../state/packageCreationReducer";
import type { PackageCreationState } from "../../types";
import en from "@/i18n/resources/en/packageCreation.json";
import { useTranslation } from "react-i18next";

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ activeOrganizationId: "org-1" }),
}));

jest.mock("@/hooks/useOrganizationData", () => ({
  useProjectTypes: () => ({ data: [{ id: "wedding", name: "Wedding" }] }),
  usePackageDeliveryMethods: () => ({ data: [] }),
}));

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const applyInterpolation = (
  template: string,
  options?: Record<string, unknown>
) => {
  if (!options) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    const value = options[key];
    return value !== undefined ? String(value) : match;
  });
};

const getTranslation = (key: string): string | undefined => {
  const segments = key.split(".");
  let current: any = en;
  for (const part of segments) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
};

const mergeState = <T extends object>(base: T, overrides?: DeepPartial<T>): T => {
  if (!overrides) return base;
  const result: any = Array.isArray(base) ? [...(base as any[])] : { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    const original = (result as any)[key];
    if (
      original &&
      typeof original === "object" &&
      !Array.isArray(original) &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      (result as any)[key] = mergeState(original, value);
    } else {
      (result as any)[key] = value;
    }
  }
  return result;
};

const TestProvider = ({ initial, children }: { initial: PackageCreationState; children: ReactNode }) => {
  const [state, dispatch] = useReducer(packageCreationReducer, initial);
  return (
    <PackageCreationContext.Provider value={{ state, dispatch }}>
      {children}
    </PackageCreationContext.Provider>
  );
};

const renderWizard = (overrides?: DeepPartial<PackageCreationState>, onComplete = jest.fn()) => {
  const base = createInitialPackageCreationState();
  const initialState = mergeState(base, overrides);
  return {
    ...render(
      <TestProvider initial={initialState}>
        <PackageCreationWizard onComplete={onComplete} />
      </TestProvider>
    ),
    onComplete,
  };
};

beforeEach(() => {
  (useTranslation as jest.Mock).mockReturnValue({
    t: (key: string, options?: Record<string, unknown>) =>
      applyInterpolation(getTranslation(key) ?? key, options),
  });
});

describe("PackageCreationWizard integration", () => {
  it("triggers onComplete when finishing from summary step", () => {
    const overrides: DeepPartial<PackageCreationState> = {
      basics: {
        name: "Studio Paket",
        description: "Açıklama",
        applicableTypeIds: ["wedding"],
      },
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
        basePrice: "15000",
        includeAddOnsInPrice: true,
      },
      meta: {
        currentStep: "summary",
        isDirty: false,
      },
    };

    const { onComplete } = renderWizard(overrides);

    fireEvent.click(screen.getByRole("button", { name: /Finish/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
