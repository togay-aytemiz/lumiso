import {
  packageCreationReducer,
  createInitialPackageCreationState,
} from "../packageCreationReducer";
import type {
  PackageCreationBasics,
  PackageCreationDeliveryState,
  PackageCreationPricingState,
  PackageCreationServicesState,
  PackageCreationHydrationPayload,
} from "../../types";

const createHydrationPayload = (): PackageCreationHydrationPayload => {
  const basics: PackageCreationBasics = {
    name: "Sunset Deluxe",
    description: "Tam gün çekim + albüm",
    applicableTypeIds: ["wedding", "engagement"],
    isActive: false,
  };

  const services: PackageCreationServicesState = {
    items: [
      {
        id: "line-1",
        type: "existing",
        serviceId: "svc-1",
        name: "Drone çekimi",
        quantity: 1,
        unitCost: 250,
        unitPrice: 750,
        vendorName: "Freelancer",
      },
    ],
    showQuickAdd: false,
  };

  const delivery: PackageCreationDeliveryState = {
    enablePhotoEstimate: true,
    enableLeadTime: true,
    enableMethods: true,
    estimateType: "range",
    countMin: 250,
    countMax: 450,
    leadTimeValue: 6,
    leadTimeUnit: "weeks",
    methods: ["online-gallery", "usb"],
    customMethodDraft: "",
  };

  const pricing: PackageCreationPricingState = {
    basePrice: "18000",
    depositMode: "percent_subtotal",
    depositValue: "25",
    enableDeposit: true,
    includeAddOnsInPrice: false,
  };

  return { basics, services, delivery, pricing };
};

describe("packageCreationReducer HYDRATE_STATE", () => {
  it("replaces slices and resets dirty state", () => {
    const initial = createInitialPackageCreationState();
    initial.meta.isDirty = true;
    initial.meta.entrySource = "settings_packages";

    const payload = createHydrationPayload();
    payload.meta = { currentStep: "summary" };

    const next = packageCreationReducer(initial, {
      type: "HYDRATE_STATE",
      payload,
    });

    expect(next.basics.name).toBe("Sunset Deluxe");
    expect(next.services.items).toHaveLength(1);
    expect(next.delivery.methods).toContain("online-gallery");
    expect(next.pricing.includeAddOnsInPrice).toBe(false);
    expect(next.meta.isDirty).toBe(false);
    expect(next.meta.currentStep).toBe("summary");
    // entry source preserved unless overridden
    expect(next.meta.entrySource).toBe("settings_packages");
  });

  it("overrides optional meta fields when provided", () => {
    const initial = createInitialPackageCreationState({
      entrySource: "packages",
      startStepOverride: "services",
    });

    const payload = createHydrationPayload();
    payload.meta = {
      currentStep: "summary",
      entrySource: "wizard_edit",
      startStepOverride: "summary",
    };

    const next = packageCreationReducer(initial, {
      type: "HYDRATE_STATE",
      payload,
    });

    expect(next.meta.entrySource).toBe("wizard_edit");
    expect(next.meta.startStepOverride).toBe("summary");
    expect(next.meta.currentStep).toBe("summary");
  });
});
