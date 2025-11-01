import React from "react";
import { render, screen } from "@/utils/testUtils";
import { SummaryStep } from "../SummaryStep";
import type { PackageSnapshot } from "../../services/packageCreationSnapshot";
import en from "@/i18n/resources/en/packageCreation.json";

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

jest.mock("../../hooks/usePackageCreationSnapshot", () => ({
  usePackageCreationSnapshot: jest.fn(),
}));

jest.mock("@/hooks/useOrganizationData", () => ({
  useProjectTypes: jest.fn(),
}));

import { useTranslation } from "react-i18next";
import { usePackageCreationSnapshot } from "../../hooks/usePackageCreationSnapshot";
import { useProjectTypes } from "@/hooks/useOrganizationData";

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

const baseSnapshot = (): PackageSnapshot => ({
  basics: {
    name: "Sunset Deluxe",
    description: "Tam gün çekim ve albüm",
    applicableTypeIds: ["type-1"],
    isActive: true,
  },
  services: {
    items: [
      {
        id: "item-1",
        type: "existing",
        role: "addon",
        serviceId: "svc-1",
        name: "Drone çekimi",
        quantity: 1,
        unitCost: 250,
        unitPrice: 750,
        vendorName: "Freelancer",
        vatRate: 0,
        vatMode: "exclusive",
      },
    ],
    totals: {
      cost: 250,
      price: 750,
      vat: 0,
      total: 750,
    },
    defaultAddOnIds: ["svc-1"],
    itemCount: 1,
    totalQuantity: 1,
  },
  delivery: {
    photosEnabled: true,
    leadTimeEnabled: true,
    methodsEnabled: true,
    estimateType: "range",
    photoCountMin: 250,
    photoCountMax: 400,
    leadTimeValue: 6,
    leadTimeUnit: "weeks",
    methods: [
      {
        methodId: "online-gallery",
        name: "Online gallery",
      },
    ],
  },
  pricing: {
    basePrice: 18000,
    servicesCostTotal: 250,
    servicesPriceTotal: 750,
    servicesVatTotal: 0,
    servicesGrossTotal: 750,
    servicesMargin: 500,
    subtotal: 18750,
    clientTotal: 18000,
    includeAddOnsInPrice: true,
    depositMode: "percent_subtotal",
    depositValue: 25,
    depositTarget: "subtotal",
    depositAmount: 4500,
    enableDeposit: true,
  },
  meta: {
    selectedServiceCount: 1,
    totalSelectedQuantity: 1,
  },
});

describe("SummaryStep", () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({
      t: (
        key: string,
        options?: { defaultValue?: string } & Record<string, unknown>
      ) => applyInterpolation(getTranslation(key) ?? options?.defaultValue ?? key, options),
    });
    (useProjectTypes as jest.Mock).mockReturnValue({
      data: [{ id: "type-1", name: "Wedding" }],
    });
  });

  it("renders inclusive client total and deposit summary", () => {
    (usePackageCreationSnapshot as jest.Mock).mockReturnValue({
      snapshot: baseSnapshot(),
    });

    render(<SummaryStep />);

    expect(screen.getByText("Sunset Deluxe")).toBeInTheDocument();
    expect(screen.getByText("Wedding")).toBeInTheDocument();
    const clientTotalRow = screen
      .getByText("Client total")
      .parentElement?.parentElement as HTMLElement;
    expect(clientTotalRow.textContent).toContain("₺18.000");
    expect(clientTotalRow.textContent).toContain(
      "Client total = package price + selected services."
    );
    const depositRow = screen
      .getByText("Deposit")
      .parentElement?.parentElement as HTMLElement;
    expect(depositRow.textContent).toContain("₺4.500");
    expect(depositRow.textContent).toContain(
      "25% of package + services total"
    );
  });

  it("renders add-on mode summary with deposit disabled helper", () => {
    const snapshot = baseSnapshot();
    snapshot.pricing.includeAddOnsInPrice = false;
    snapshot.pricing.clientTotal = 18750;
    snapshot.pricing.enableDeposit = false;
    snapshot.pricing.depositAmount = 0;
    snapshot.pricing.depositValue = 0;

    (usePackageCreationSnapshot as jest.Mock).mockReturnValue({
      snapshot,
    });

    render(<SummaryStep />);

    const clientTotalRow = screen
      .getByText("Client total")
      .parentElement?.parentElement as HTMLElement;
    expect(clientTotalRow.textContent).toContain(
      "Package price already includes selected services."
    );
    expect(clientTotalRow.textContent).toMatch(/₺\s?18\.750/);
    const depositRow = screen
      .getByText("Deposit")
      .parentElement?.parentElement as HTMLElement;
    expect(depositRow.textContent).toContain("No deposit collected");
  });
});
