import {
  buildPackageHydrationFromRecord,
  buildPackageUpdatePayload,
  preparePackagePersistence,
} from "../packageCreationSnapshot";
import type { Database } from "@/integrations/supabase/types";
import type { PackageCreationLineItem, PackageCreationState } from "../../types";
import { calculateLineItemPricing } from "../../utils/lineItemPricing";

type PackageRow = Database["public"]["Tables"]["packages"]["Row"];

const baseRecord = (): PackageRow => ({
  applicable_types: ["wedding"],
  created_at: "2024-11-08T10:30:00.000Z",
  client_total: 2300,
  default_add_ons: ["svc-2"],
  delivery_estimate_type: "range",
  delivery_lead_time_unit: "weeks",
  delivery_lead_time_value: 4,
  delivery_methods: [
    {
      methodId: "online-gallery",
      name: "Online gallery",
    },
  ],
  delivery_photo_count_max: 400,
  delivery_photo_count_min: 250,
  description: "Full day coverage with album",
  id: "pkg-1",
  include_addons_in_price: false,
  is_active: true,
  line_items: [
    {
      id: "line-1",
      type: "existing",
      serviceId: "svc-1",
      name: "Primary shoot",
      quantity: 1,
      unitCost: 500,
      unitPrice: 1800,
      vendorName: "Internal",
      source: "catalog",
      vatRate: 18,
      vatMode: "inclusive",
    },
    {
      id: "line-2",
      type: "custom",
      name: "Drone footage",
      quantity: 1,
      unitCost: 200,
      unitPrice: 500,
      vendorName: "Freelancer",
      vatRate: null,
      vatMode: "exclusive",
    },
  ],
  name: "Golden Wedding",
  organization_id: "org-1",
  pricing_metadata: {
    enableDeposit: true,
    depositMode: "percent_subtotal",
    depositValue: 25,
    depositTarget: "subtotal",
    depositAmount: 575,
    packageVatRate: 18,
    packageVatMode: "inclusive",
    packageVatOverrideEnabled: false,
    basePriceInput: 1800,
  },
  price: 1800,
  updated_at: "2024-11-08T10:30:00.000Z",
  user_id: "user-1",
});

describe("buildPackageHydrationFromRecord", () => {
  it("hydrates basics, services, delivery, and pricing slices", () => {
    const hydration = buildPackageHydrationFromRecord(baseRecord());

    expect(hydration.basics).toMatchObject({
      name: "Golden Wedding",
      description: "Full day coverage with album",
      applicableTypeIds: ["wedding"],
      isActive: true,
    });

    expect(hydration.services.items).toHaveLength(2);
    expect(hydration.services.items[0]).toMatchObject({
      id: "line-1",
      type: "existing",
      serviceId: "svc-1",
      quantity: 1,
      unitPrice: 1800,
      vendorName: "Internal",
      source: "catalog",
      vatRate: 18,
      vatMode: "inclusive",
    });

    expect(hydration.delivery).toMatchObject({
      enablePhotoEstimate: true,
      enableLeadTime: true,
      enableMethods: true,
      estimateType: "range",
      countMin: 250,
      countMax: 400,
      leadTimeValue: 4,
      leadTimeUnit: "weeks",
      methods: ["online-gallery"],
    });

    expect(hydration.pricing).toMatchObject({
      basePrice: "1800",
      includeAddOnsInPrice: false,
      enableDeposit: true,
      depositMode: "percent_subtotal",
      depositValue: "25",
      packageVatRate: 18,
      packageVatMode: "inclusive",
      packageVatOverrideEnabled: false,
      packageVatInitialized: true,
    });
  });

  it("falls back to defaults when optional metadata is missing", () => {
    const record = baseRecord();
    record.pricing_metadata = {};
    record.delivery_methods = [];
    record.include_addons_in_price = null as unknown as boolean;

    const hydration = buildPackageHydrationFromRecord(record);

    expect(hydration.delivery.enableMethods).toBe(false);
    expect(hydration.delivery.methods).toEqual([]);
    expect(hydration.pricing.includeAddOnsInPrice).toBe(true);
    expect(hydration.pricing.enableDeposit).toBe(false);
    expect(hydration.pricing.depositMode).toBe("percent_subtotal");
    expect(hydration.pricing.depositValue).toBe("");
    expect(hydration.pricing.packageVatOverrideEnabled).toBe(false);
    expect(hydration.pricing.packageVatInitialized).toBe(false);
  });

  it("maps snapshot into update payload correctly", () => {
    const record = baseRecord();
    const hydration = buildPackageHydrationFromRecord(record);
    const basePriceNumeric = Number(hydration.pricing.basePrice);
    const baseVatRate = hydration.pricing.packageVatRate ?? 0;
    const baseVatMode = hydration.pricing.packageVatMode;
    const basePriceLine: PackageCreationLineItem = {
      id: "base",
      type: "custom",
      name: "Package price",
      quantity: 1,
      unitPrice: basePriceNumeric,
      vatRate: baseVatRate,
      vatMode: baseVatMode,
    };
    const basePricing = calculateLineItemPricing(basePriceLine);
    const basePriceGross = Math.round(basePricing.gross * 100) / 100;
    const basePriceNet = Math.round(basePricing.net * 100) / 100;
    const basePriceVatPortion = Math.round(basePricing.vat * 100) / 100;
    const contextSnapshot = {
      basics: hydration.basics,
      services: {
        items: hydration.services.items.map((item) => ({
          ...item,
          unitCost: item.unitCost ?? null,
          unitPrice: item.unitPrice ?? null,
          vatRate: item.vatRate ?? null,
          vatMode: item.vatMode ?? "exclusive",
        })),
        totals: { cost: 0, price: 0, vat: 0, total: 0 },
        defaultAddOnIds: [],
        itemCount: hydration.services.items.length,
        totalQuantity: hydration.services.items.reduce((acc, item) => acc + item.quantity, 0),
      },
      delivery: {
        photosEnabled: hydration.delivery.enablePhotoEstimate,
        leadTimeEnabled: hydration.delivery.enableLeadTime,
        methodsEnabled: hydration.delivery.enableMethods,
        estimateType: hydration.delivery.estimateType,
        photoCountMin: hydration.delivery.countMin,
        photoCountMax: hydration.delivery.countMax,
        leadTimeValue: hydration.delivery.leadTimeValue,
        leadTimeUnit: hydration.delivery.leadTimeUnit,
        methods: hydration.delivery.methods.map((methodId) => ({
          methodId,
          name: methodId,
        })),
      },
      pricing: {
        basePrice: basePriceGross,
        basePriceInput: basePriceNumeric,
        basePriceNet,
        basePriceVatPortion,
        servicesCostTotal: 0,
        servicesPriceTotal: 0,
        servicesVatTotal: 0,
        servicesGrossTotal: 0,
        servicesMargin: 0,
        subtotal: basePriceGross,
        clientTotal: record.client_total,
        includeAddOnsInPrice: hydration.pricing.includeAddOnsInPrice,
        depositMode: hydration.pricing.depositMode,
        depositValue: Number(hydration.pricing.depositValue),
        depositAmount: record.pricing_metadata?.depositAmount ?? 0,
        enableDeposit: hydration.pricing.enableDeposit,
        packageVatRate: baseVatRate,
        packageVatMode: baseVatMode,
        packageVatOverrideEnabled: hydration.pricing.packageVatOverrideEnabled,
      },
      meta: {
        selectedServiceCount: hydration.services.items.length,
        totalSelectedQuantity: hydration.services.items.reduce(
          (acc, item) => acc + item.quantity,
          0
        ),
      },
    } as const;

    const updatePayload = buildPackageUpdatePayload(
      contextSnapshot,
      record.id
    );

    expect(updatePayload).toMatchObject({
      id: "pkg-1",
      name: "Golden Wedding",
      price: Number(hydration.pricing.basePrice),
      client_total: record.client_total,
      include_addons_in_price: false,
    });
    expect(updatePayload.pricing_metadata).toEqual(
      expect.objectContaining({
        enableDeposit: true,
        depositMode: "percent_subtotal",
        depositValue: Number(hydration.pricing.depositValue),
        packageVatRate: baseVatRate,
        packageVatMode: baseVatMode,
        packageVatOverrideEnabled: hydration.pricing.packageVatOverrideEnabled,
        basePriceInput: basePriceNumeric,
      })
    );

    const lineItems = updatePayload.line_items as unknown[];
    expect(Array.isArray(lineItems)).toBe(true);
    expect(lineItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceId: "svc-1",
          quantity: 1,
          unitPrice: 1800,
          vatMode: "inclusive",
          vatRate: 18,
        }),
        expect.objectContaining({
          name: "Drone footage",
          unitPrice: 500,
          vatMode: "exclusive",
          vatRate: null,
        }),
      ])
    );
  });

  it("builds insert payloads with enriched line item metadata", () => {
    const record = baseRecord();
    const hydration = buildPackageHydrationFromRecord(record);

    const state: PackageCreationState = {
      basics: hydration.basics,
      services: hydration.services,
      delivery: hydration.delivery,
      pricing: hydration.pricing,
      meta: {
        currentStep: "summary",
        isDirty: false,
        mode: "create",
      },
    };

    const { insert, snapshot } = preparePackagePersistence(state, {
      userId: "user-1",
      organizationId: record.organization_id ?? "org-1",
    });

    expect(snapshot.services.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceId: "svc-1",
          quantity: 1,
          unitPrice: 1800,
          vatMode: "inclusive",
          vatRate: 18,
        }),
      ])
    );

    const persisted = insert.line_items as unknown[];
    expect(Array.isArray(persisted)).toBe(true);
    const baseLineItem = persisted.find(
      (item) => (item as any).serviceId === "svc-1"
    ) as Record<string, unknown>;
    expect(baseLineItem).toMatchObject({
      serviceId: "svc-1",
      quantity: 1,
      unitPrice: 1800,
      vatMode: "inclusive",
      vatRate: 18,
    });

    const customLineItem = persisted.find(
      (item) => (item as any).type === "custom"
    ) as Record<string, unknown>;
    expect(customLineItem).toMatchObject({
      name: "Drone footage",
      unitPrice: 500,
      vatMode: "exclusive",
    });
    expect(customLineItem).toHaveProperty("vatRate", null);
  });
});
