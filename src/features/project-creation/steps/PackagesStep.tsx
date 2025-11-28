import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ServiceInventoryType } from "@/components/ServiceInventorySelector";
import {
  ServicesTableCard,
  SummaryTotalRow,
  SummaryTotalsCard,
  SummaryTotalsDivider,
  SummaryTotalsSection,
  type ServicesTableRow,
} from "@/components/services";
import { ProjectServicesCard, type ProjectServicesCardItem } from "@/components/ProjectServicesCard";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ProjectServicesQuickEditDialog,
  type ProjectServiceQuickEditResult,
  type ProjectServiceQuickEditSelection,
  type QuickServiceRecord,
} from "@/components/ProjectServicesQuickEditDialog";
import {
  usePackages,
  useProjectTypes,
  useServices,
  useOrganizationTaxProfile,
} from "@/hooks/useOrganizationData";
import { useProjectCreationContext } from "../hooks/useProjectCreationContext";
import { useProjectCreationActions } from "../hooks/useProjectCreationActions";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles } from "lucide-react";
import type { ProjectCreationDetails, ProjectServiceLineItem } from "../types";
import { calculateLineItemPricing } from "@/features/package-creation/utils/lineItemPricing";
import { getProjectTypeMatchKey } from "@/lib/projectTypes";
import { DEFAULT_SERVICE_UNIT, normalizeServiceUnit } from "@/lib/services/units";
import type { VatMode } from "@/lib/accounting/vat";
import { buildProjectPackageSnapshot } from "@/lib/projects/projectPackageSnapshot";
import { deriveDeliveryStateFromSnapshot, createDefaultProjectDeliveryState } from "../state/projectDeliveryState";
import type { Database } from "@/integrations/supabase/types";

type PackageRecord = Database["public"]["Tables"]["packages"]["Row"];

interface ServiceRecord {
  id: string;
  name: string;
  category?: string | null;
  cost_price?: number | null;
  selling_price?: number | null;
  price?: number | null;
  vendor_name?: string | null;
  is_active?: boolean | null;
  service_type?: ServiceInventoryType | null;
  default_unit?: string | null;
  vat_rate?: number | null;
  price_includes_vat?: boolean | null;
}

interface ServiceWithMetadata extends ServiceRecord {
  unitCost: number;
  unitPrice: number;
  serviceType: ServiceInventoryType;
  vatRate: number | null;
  vatMode: VatMode;
  priceIncludesVat: boolean;
  unit: string;
  isActive: boolean;
}

type VatModeOption = "inclusive" | "exclusive";

export const PackagesStep = () => {
  const { t } = useTranslation("projectCreation");
  const { t: tPackages } = useTranslation("packageCreation");
  const { t: tForms } = useTranslation("forms");
  const { state } = useProjectCreationContext();
  const { updateServices, updateDetails, updateDelivery } = useProjectCreationActions();

  const packagesQuery = usePackages();
  const servicesQuery = useServices();
  const projectTypesQuery = useProjectTypes();
  const taxProfileQuery = useOrganizationTaxProfile();
  const vatExempt = Boolean(taxProfileQuery.data?.vatExempt);
  const vatUiEnabled = !vatExempt;

  const packages = useMemo<PackageRecord[]>(
    () => (Array.isArray(packagesQuery.data) ? (packagesQuery.data as PackageRecord[]) : []),
    [packagesQuery.data]
  );
  const services = useMemo<ServiceRecord[]>(
    () => (Array.isArray(servicesQuery.data) ? (servicesQuery.data as ServiceRecord[]) : []),
    [servicesQuery.data]
  );
  const projectTypes = useMemo(
    () => projectTypesQuery.data ?? [],
    [projectTypesQuery.data]
  );
  const actionsRef = useRef<HTMLDivElement | null>(null);

  const selectedProjectType = useMemo(
    () => projectTypes.find((type) => type.id === state.details.projectTypeId),
    [projectTypes, state.details.projectTypeId]
  );

  const filteredPackages = useMemo(() => {
    if (!selectedProjectType) {
      return packages.filter((pkg) => pkg.is_active !== false);
    }
    return packages.filter((pkg) => {
      if (pkg.is_active === false) return false;
      if (!pkg.applicable_types || pkg.applicable_types.length === 0) return true;
      const selectedId = selectedProjectType.id;
      const selectedName = selectedProjectType.name;
      const selectedMatchKey = getProjectTypeMatchKey(
        selectedProjectType.template_slug ?? selectedName ?? selectedId
      );

      return (
        (selectedId && pkg.applicable_types.includes(selectedId)) ||
        (selectedName && pkg.applicable_types.includes(selectedName)) ||
        (selectedMatchKey &&
          pkg.applicable_types.some(
            (type) => getProjectTypeMatchKey(type) === selectedMatchKey
          ))
      );
    });
  }, [packages, selectedProjectType]);

  const selectedPackage = state.services.packageId
    ? filteredPackages.find((pkg) => pkg.id === state.services.packageId) ??
      packages.find((pkg) => pkg.id === state.services.packageId)
    : undefined;

  const showCustomSetup =
    Boolean(state.services.packageId) ||
    state.services.showCustomSetup ||
    state.services.includedItems.length > 0 ||
    state.services.extraItems.length > 0;

  const serviceMap = useMemo<Map<string, ServiceWithMetadata>>(
    () =>
      new Map(
        services.map((service) => {
          const vatRate =
            vatUiEnabled &&
            typeof service.vat_rate === "number" &&
            Number.isFinite(service.vat_rate)
              ? Number(service.vat_rate)
              : null;
          const vatMode: VatMode =
            vatUiEnabled && service.price_includes_vat ? "inclusive" : "exclusive";
          const unit = normalizeServiceUnit(service.default_unit);
          return [
            service.id,
            {
              ...service,
              unitCost: service.cost_price ?? 0,
              unitPrice: service.selling_price ?? service.price ?? 0,
              serviceType: (service.service_type ?? "unknown") as ServiceInventoryType,
              vatRate,
              vatMode,
              priceIncludesVat: vatUiEnabled && service.price_includes_vat ? true : false,
              unit,
              isActive: service.is_active !== false,
            },
          ] as const;
        })
      ) as Map<string, ServiceWithMetadata>,
    [services, vatUiEnabled]
  );

  const normalizeItemVat = useCallback(
    (item: ProjectServiceLineItem): ProjectServiceLineItem =>
      vatUiEnabled
        ? item
        : {
            ...item,
            vatRate: null,
            vatMode: "exclusive",
          },
    [vatUiEnabled]
  );

  const buildLineItemFromService = useCallback(
    (
      service: ServiceWithMetadata,
      overrides?: Partial<
        Pick<
          ProjectServiceLineItem,
          | "id"
          | "name"
          | "quantity"
          | "unitCost"
          | "unitPrice"
          | "vatMode"
          | "vatRate"
          | "unit"
          | "vendorName"
        >
      >
    ): ProjectServiceLineItem =>
      normalizeItemVat({
        id: overrides?.id ?? service.id,
        type: "existing",
        serviceId: service.id,
        name: overrides?.name ?? service.name,
        quantity: Math.max(1, overrides?.quantity ?? 1),
        unitCost:
          overrides && "unitCost" in overrides
            ? overrides.unitCost ?? null
            : service.unitCost,
        unitPrice:
          overrides && "unitPrice" in overrides
            ? overrides.unitPrice ?? null
            : service.unitPrice,
        vendorName:
          overrides && "vendorName" in overrides
            ? overrides.vendorName ?? null
            : service.vendor_name ?? null,
        vatRate:
          overrides && "vatRate" in overrides
            ? overrides.vatRate ?? null
            : service.vatRate ?? null,
        vatMode: overrides?.vatMode ?? service.vatMode,
        unit: overrides?.unit ?? service.unit,
        source: "catalog",
      }),
    [normalizeItemVat]
  );

  const includedItems = state.services.includedItems;
  const extraItems = state.services.extraItems;
  const existingItems = useMemo(
    () => [...includedItems, ...extraItems],
    [includedItems, extraItems]
  );
  const hasServices = existingItems.length > 0;
  const [serviceDialogState, setServiceDialogState] = useState<{
    open: boolean;
    mode: "included" | "extra";
  }>({
    open: false,
    mode: "included",
  });

  const aggregateLineItems = useCallback(
    (items: ProjectServiceLineItem[]) =>
      items.reduce(
        (acc, item) => {
          const quantity = Math.max(1, item.quantity ?? 1);
          const unitCost =
            typeof item.unitCost === "number" && Number.isFinite(item.unitCost)
              ? item.unitCost
              : 0;
          const pricing = calculateLineItemPricing(normalizeItemVat(item));
          acc.cost += unitCost * quantity;
          acc.net += pricing.net;
          acc.vat += pricing.vat;
          acc.total += pricing.gross;
          return acc;
        },
        { cost: 0, net: 0, vat: 0, total: 0 }
      ),
    [normalizeItemVat]
  );

  const includedTotals = useMemo(
    () => aggregateLineItems(includedItems),
    [aggregateLineItems, includedItems]
  );

  const extraTotals = useMemo(
    () => aggregateLineItems(extraItems),
    [aggregateLineItems, extraItems]
  );

  const combinedTotals = useMemo(
    () => ({
      cost: includedTotals.cost + extraTotals.cost,
      net: includedTotals.net + extraTotals.net,
      vat: includedTotals.vat + extraTotals.vat,
      total: includedTotals.total + extraTotals.total,
    }),
    [includedTotals, extraTotals]
  );

  const includedCount = includedItems.length;
  const addOnCount = extraItems.length;
  const servicesMargin = extraTotals.net - extraTotals.cost;
  const formatCurrency = useCallback(
    (value: number) =>
      new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 0,
      }).format(value),
    []
  );
  const formatPercent = useCallback(
    (value: number) =>
      new Intl.NumberFormat("tr-TR", {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
        maximumFractionDigits: 2,
      }).format(value),
    []
  );
  const buildVatBreakdown = useCallback(
    (items: ProjectServiceLineItem[]) => {
      if (!vatUiEnabled) {
        return [];
      }
      const buckets = new Map<number, number>();
      items.forEach((item) => {
        const pricing = calculateLineItemPricing(normalizeItemVat(item));
        if (!(pricing.vat > 0)) return;
        const rate =
          typeof item.vatRate === "number" && Number.isFinite(item.vatRate)
            ? item.vatRate
            : 0;
        const current = buckets.get(rate) ?? 0;
        buckets.set(rate, current + pricing.vat);
      });
      return Array.from(buckets.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([rate, amount]) => ({ rate, amount }));
    },
    [normalizeItemVat, vatUiEnabled]
  );

  const overallVatBreakdown = useMemo(
    () => buildVatBreakdown(existingItems),
    [buildVatBreakdown, existingItems]
  );

  const extraVatBreakdown = useMemo(
    () => buildVatBreakdown(extraItems),
    [buildVatBreakdown, extraItems]
  );

  const includedVatBreakdown = useMemo(
    () => buildVatBreakdown(includedItems),
    [buildVatBreakdown, includedItems]
  );

  const quickEditServices = useMemo<QuickServiceRecord[]>(
    () =>
      services.map((service) => {
        const serviceType =
          service.service_type === "coverage" || service.service_type === "deliverable"
            ? (service.service_type as "coverage" | "deliverable")
            : null;
        return {
          id: service.id,
          name: service.name,
          category: service.category,
          selling_price: service.selling_price ?? service.price ?? null,
          price: service.price ?? null,
          cost_price: service.cost_price ?? null,
          vat_rate:
            vatUiEnabled && typeof service.vat_rate === "number"
              ? Number(service.vat_rate)
              : null,
          price_includes_vat:
            vatUiEnabled && service.price_includes_vat ? true : false,
          service_type: serviceType,
          extra: false,
        };
      }),
    [services, vatUiEnabled]
  );

  const existingItemsByServiceId = useMemo(() => {
    const map = new Map<string, ProjectServiceLineItem>();
    existingItems.forEach((item) => {
      map.set(item.id, item);
      if (item.serviceId) {
        map.set(item.serviceId, item);
      }
    });
    return map;
  }, [existingItems]);

  const resolveOverride = useCallback(
    <K extends keyof ProjectServiceQuickEditResult["overrides"]>(
      overrides: ProjectServiceQuickEditResult["overrides"],
      key: K,
      fallback: () => ProjectServiceQuickEditResult["overrides"][K]
    ) => {
      if (Object.prototype.hasOwnProperty.call(overrides, key)) {
        return overrides[key];
      }
      return fallback();
    },
    []
  );

  const buildLineItemFromSelection = useCallback(
    (result: ProjectServiceQuickEditResult): ProjectServiceLineItem => {
      const lookupKey = result.serviceId ?? result.projectServiceId ?? null;
      const existing = lookupKey ? existingItemsByServiceId.get(lookupKey) ?? null : null;
      const resolvedServiceId = result.serviceId ?? existing?.serviceId ?? null;
      const serviceMeta = resolvedServiceId ? serviceMap.get(resolvedServiceId) : undefined;
      const quantity = Math.max(1, result.quantity ?? 1);

      const resolvedUnitCost = resolveOverride(
        result.overrides,
        "unitCost",
        () => existing?.unitCost ?? serviceMeta?.unitCost ?? null
      );
      const resolvedUnitPrice = resolveOverride(
        result.overrides,
        "unitPrice",
        () => existing?.unitPrice ?? serviceMeta?.unitPrice ?? null
      );
      const resolvedVatMode = resolveOverride(
        result.overrides,
        "vatMode",
        () => existing?.vatMode ?? serviceMeta?.vatMode ?? "inclusive"
      );
      const resolvedVatRate = resolveOverride(
        result.overrides,
        "vatRate",
        () => existing?.vatRate ?? serviceMeta?.vatRate ?? null
      );
      const normalizedVatMode = vatUiEnabled
        ? (resolvedVatMode ?? "inclusive")
        : "exclusive";
      const normalizedVatRate =
        vatUiEnabled && typeof resolvedVatRate === "number" ? resolvedVatRate : null;

      const fallbackId =
        existing?.id ??
        result.projectServiceId ??
        resolvedServiceId ??
        `svc-${Math.random().toString(36).slice(2, 10)}`;

      return normalizeItemVat({
        id: fallbackId,
        type: existing?.type ?? "existing",
        serviceId: resolvedServiceId ?? undefined,
        name: serviceMeta?.name ?? existing?.name ?? resolvedServiceId ?? fallbackId,
        quantity,
        unitCost: typeof resolvedUnitCost === "number" ? resolvedUnitCost : null,
        unitPrice: typeof resolvedUnitPrice === "number" ? resolvedUnitPrice : null,
        vendorName: serviceMeta?.vendor_name ?? existing?.vendorName ?? null,
        vatMode: normalizedVatMode,
        vatRate: normalizedVatRate,
        unit: existing?.unit ?? serviceMeta?.unit ?? DEFAULT_SERVICE_UNIT,
        source: existing?.source ?? "catalog",
      });
    },
    [existingItemsByServiceId, normalizeItemVat, resolveOverride, serviceMap, vatUiEnabled]
  );

  const toSelection = useCallback(
    (item: ProjectServiceLineItem): ProjectServiceQuickEditSelection | null => {
      if (!item.serviceId) return null;
      const serviceMeta = serviceMap.get(item.serviceId);
      const quantity = Math.max(1, item.quantity ?? 1);
      const vatMode = vatUiEnabled
        ? item.vatMode ?? serviceMeta?.vatMode ?? "inclusive"
        : "exclusive";
      const vatRate =
        vatUiEnabled &&
        typeof item.vatRate === "number" &&
        Number.isFinite(item.vatRate)
          ? item.vatRate
          : vatUiEnabled
          ? serviceMeta?.vatRate ?? null
          : null;
      const unitCost =
        typeof item.unitCost === "number" && Number.isFinite(item.unitCost)
          ? item.unitCost
          : serviceMeta?.unitCost ?? null;
      const unitPrice =
        typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice)
          ? item.unitPrice
          : serviceMeta?.unitPrice ?? null;

      return {
        serviceId: item.serviceId,
        projectServiceId: item.id,
        quantity,
        unitCost,
        unitPrice,
        vatMode: vatMode as VatModeOption,
        vatRate,
      };
    },
    [serviceMap, vatUiEnabled]
  );

  const includedSelections = useMemo<ProjectServiceQuickEditSelection[]>(() => {
    return includedItems
      .map(toSelection)
      .filter((selection): selection is ProjectServiceQuickEditSelection => Boolean(selection));
  }, [includedItems, toSelection]);

  const extraSelections = useMemo<ProjectServiceQuickEditSelection[]>(() => {
    return extraItems
      .map(toSelection)
      .filter((selection): selection is ProjectServiceQuickEditSelection => Boolean(selection));
  }, [extraItems, toSelection]);

  const handleServiceDialogOpen = useCallback((mode: "included" | "extra") => {
    setServiceDialogState({ open: true, mode });
  }, []);

  const handleServiceQuickEditSubmit = useCallback(
    (mode: "included" | "extra", results: ProjectServiceQuickEditResult[]) => {
      const builtItems = results.map(buildLineItemFromSelection);
      const builtKeys = new Set(
        builtItems
          .map((item) => item.serviceId ?? item.id)
          .filter((key): key is string => Boolean(key))
      );

      const filterByKeys = (items: ProjectServiceLineItem[]) =>
        items.filter((item) => !builtKeys.has(item.serviceId ?? item.id));

      const nextIncluded = mode === "included" ? builtItems : filterByKeys(includedItems);
      const nextExtra = mode === "extra" ? builtItems : filterByKeys(extraItems);

      updateServices({
        includedItems: nextIncluded,
        extraItems: nextExtra,
        showCustomSetup:
          state.services.showCustomSetup || nextIncluded.length + nextExtra.length > 0,
      });
    },
    [buildLineItemFromSelection, includedItems, extraItems, state.services.showCustomSetup, updateServices]
  );

  const includedCardItems = useMemo<ProjectServicesCardItem[]>(() => {
    return includedItems.map((item) => {
      const quantity = Math.max(1, item.quantity ?? 1);
      return {
        key: item.id,
        left: <div className="font-medium">{item.name}</div>,
        right: (
          <div className="font-medium text-muted-foreground">
            {tForms("services.quantity_short", {
              count: quantity,
              defaultValue: "x {{count}}",
            })}
          </div>
        ),
      };
    });
  }, [includedItems, tForms]);

  const extraCardItems = useMemo<ProjectServicesCardItem[]>(() => {
    return extraItems.map((item) => {
      const quantity = Math.max(1, item.quantity ?? 1);
      const pricing = calculateLineItemPricing(item);
      const unitPrice =
        typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice)
          ? item.unitPrice
          : serviceMap.get(item.serviceId ?? item.id)?.unitPrice ?? 0;

      return {
        key: item.id,
        left: <div className="font-medium">{item.name}</div>,
        right: (
          <div className="text-right">
            <div className="font-medium text-muted-foreground">
              {formatCurrency(pricing.gross)}
            </div>
            <div className="text-xs text-muted-foreground">
              {tForms("services.unit_price_line", {
                quantity,
                amount: formatCurrency(unitPrice),
                defaultValue: "{{quantity}} × {{amount}}",
              })}
            </div>
          </div>
        ),
      };
    });
  }, [extraItems, formatCurrency, serviceMap, tForms]);

  const buildPackageIncludedItems = useCallback(
    (pkg: PackageRecord): ProjectServiceLineItem[] => {
      if (!pkg.line_items || !Array.isArray(pkg.line_items)) {
        return [];
      }
      return (pkg.line_items as unknown[])
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return null;
          }
          const item = entry as Record<string, unknown>;
          if (item.type !== "existing") {
            return null;
          }
          const serviceId =
            typeof item.serviceId === "string" ? item.serviceId : null;
          if (!serviceId) {
            return null;
          }
          const service = serviceMap.get(serviceId);
          if (!service) {
            return null;
          }
          const rawQuantity =
            typeof item.quantity === "number"
              ? item.quantity
              : Number(item.quantity ?? 1);
          const normalizedQuantity =
            Number.isFinite(rawQuantity) && rawQuantity > 0
              ? rawQuantity
              : undefined;
          const normalizedUnitCost =
            typeof item.unitCost === "number"
              ? item.unitCost
              : Number.isFinite(Number(item.unitCost))
              ? Number(item.unitCost)
              : undefined;
          const normalizedUnitPrice =
            typeof item.unitPrice === "number"
              ? item.unitPrice
              : Number.isFinite(Number(item.unitPrice))
              ? Number(item.unitPrice)
              : undefined;
          const normalizedVatRate =
            typeof item.vatRate === "number"
              ? item.vatRate
              : Number.isFinite(Number(item.vatRate))
              ? Number(item.vatRate)
              : undefined;

          const overrides: Partial<ProjectServiceLineItem> = {
            id: typeof item.id === "string" ? item.id : undefined,
            name: typeof item.name === "string" ? item.name : undefined,
            quantity:
              normalizedQuantity !== undefined
                ? Math.max(1, normalizedQuantity)
                : undefined,
            unitCost: normalizedUnitCost,
            unitPrice: normalizedUnitPrice,
            vatMode:
              item.vatMode === "inclusive" || item.vatMode === "exclusive"
                ? (item.vatMode as "inclusive" | "exclusive")
                : undefined,
            vatRate: normalizedVatRate,
            unit:
              typeof item.unit === "string" && item.unit.trim().length > 0
                ? item.unit
                : undefined,
            vendorName:
              typeof item.vendorName === "string" ? item.vendorName : undefined,
          };
          return buildLineItemFromService(service, overrides);
        })
        .filter(
          (item): item is ProjectServiceLineItem =>
            Boolean(item?.serviceId ?? item?.name)
        );
    },
    [buildLineItemFromService, serviceMap]
  );

  const buildPackageAddOnItems = useCallback(
    (pkg: PackageRecord, excludedIds: Set<string>): ProjectServiceLineItem[] => {
      if (!Array.isArray(pkg.default_add_ons) || pkg.default_add_ons.length === 0) {
        return [];
      }
      return pkg.default_add_ons
        .map((serviceId) => {
          if (!serviceId || excludedIds.has(serviceId)) {
            return null;
          }
          const service = serviceMap.get(serviceId);
          if (!service) {
            return null;
          }
          return buildLineItemFromService(service);
        })
        .filter(
          (item): item is ProjectServiceLineItem =>
            Boolean(item?.serviceId ?? item?.name)
        );
    },
    [buildLineItemFromService, serviceMap]
  );

  const hasBillableServices = extraItems.length > 0;

  const getUnitLabel = useCallback(
    (unit?: string | null) =>
      t(`steps.packages.units.short.${normalizeServiceUnit(unit)}`, {
        defaultValue: t(`steps.packages.units.options.${normalizeServiceUnit(unit)}`),
      }),
    [t]
  );

  const serviceTableLabels = useMemo(
    () => ({
      columns: {
        name: t("steps.packages.summary.table.name", { defaultValue: "Service" }),
        quantity: t("steps.packages.summary.table.quantity", { defaultValue: "Qty" }),
        cost: t("steps.packages.summary.table.cost", { defaultValue: "Cost" }),
        unitPrice: t("steps.packages.summary.table.unitPrice", { defaultValue: "Unit price" }),
        lineTotal: t("steps.packages.summary.table.lineTotal", { defaultValue: "Line total" }),
      },
      totals: {
        cost: t("steps.packages.summary.totals.cost", { defaultValue: "Cost total" }),
        price: t("steps.packages.summary.totals.price", { defaultValue: "Price total" }),
        vat: t("steps.packages.summary.totals.vat", { defaultValue: "VAT total" }),
        total: t("steps.packages.summary.totals.total", { defaultValue: "Total" }),
        margin: t("steps.packages.summary.totals.margin", { defaultValue: "Margin" }),
      },
      customTag: t("steps.packages.summary.customTag", { defaultValue: "Custom item" }),
      customVendorFallback: t("steps.packages.summary.customVendorFallback", { defaultValue: "—" }),
    }),
    [t]
  );

  const includedItemIds = useMemo(() => new Set(includedItems.map((item) => item.id)), [includedItems]);

  const summaryTableRows = useMemo<ServicesTableRow[]>(() => {
    return existingItems.map((item) => {
      const service = serviceMap.get(item.serviceId);
      const pricing = calculateLineItemPricing(item);
      const quantity = Math.max(1, item.quantity ?? 1);
      const lineCost =
        typeof item.unitCost === "number" && Number.isFinite(item.unitCost)
          ? Math.round(item.unitCost * quantity * 100) / 100
          : service?.unitCost
          ? Math.round(service.unitCost * quantity * 100) / 100
          : null;
      const isIncluded = includedItemIds.has(item.id);
      const billingLabel = isIncluded
        ? t("steps.packages.badges.included", { defaultValue: "Included" })
        : t("steps.packages.badges.addOn", { defaultValue: "Add-on" });
      const vendorLabel = service?.vendor_name ?? item.vendorName ?? null;
      const metaLabel = vendorLabel
        ? `${vendorLabel} • ${billingLabel}`
        : billingLabel;
      const unitPriceValue = item.unitPrice ?? service?.unitPrice ?? null;
      const displayUnitPrice = isIncluded ? null : unitPriceValue;
      const displayLineTotal = isIncluded ? null : Math.round(pricing.gross * 100) / 100;

      return {
        id: item.id,
        name: item.name,
        vendor: metaLabel,
        quantity,
        unitLabel: getUnitLabel(item.unit ?? service?.unit ?? DEFAULT_SERVICE_UNIT),
        lineCost,
        unitPrice: displayUnitPrice,
        lineTotal: displayLineTotal,
        isCustom: false,
      };
    });
  }, [existingItems, getUnitLabel, includedItemIds, serviceMap, t]);

  useEffect(() => {
    if (!actionsRef.current) return;
    if (!state.services.packageId && !showCustomSetup) return;
    if (state.meta.mode === "edit") return;
    actionsRef.current.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  }, [state.services.packageId, showCustomSetup, state.meta.mode]);

  const basePriceValue = useMemo(() => {
    const parsed = parseFloat(state.details.basePrice ?? "");
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    if (selectedPackage && typeof selectedPackage.price === "number") {
      const packagePrice = Number(selectedPackage.price);
      return Number.isFinite(packagePrice) && packagePrice > 0 ? packagePrice : 0;
    }
    return 0;
  }, [state.details.basePrice, selectedPackage]);

  const packageDepositConfig = useMemo(() => {
    const metadata = selectedPackage?.pricing_metadata;
    if (!metadata || typeof metadata !== "object") {
      return null;
    }
    const record = metadata as Record<string, unknown>;
    const enableDeposit = Boolean(record.enableDeposit);
    const rawMode = record.depositMode;
    const depositMode =
      typeof rawMode === "string" ? (rawMode as string) : undefined;
    const rawValue = record.depositValue;
    const depositValue =
      typeof rawValue === "number"
        ? rawValue
        : Number.isFinite(Number(rawValue))
        ? Number(rawValue)
        : null;
    const rawTarget = record.depositTarget;
    const depositTarget =
      typeof rawTarget === "string" ? (rawTarget as string) : null;
    const rawAmount = record.depositAmount;
    const depositAmount =
      typeof rawAmount === "number"
        ? rawAmount
        : Number.isFinite(Number(rawAmount))
        ? Number(rawAmount)
        : null;
    return {
      enableDeposit,
      depositMode,
      depositValue,
      depositTarget,
      depositAmount,
    };
  }, [selectedPackage]);

  const roundCurrency = useCallback((value: number) => Math.round(value * 100) / 100, []);

  const computeSuggestedDeposit = useCallback(
    (extrasOverride: number) => {
      if (!packageDepositConfig || !packageDepositConfig.enableDeposit) {
        return 0;
      }
      const { depositMode, depositValue, depositTarget, depositAmount } = packageDepositConfig;
      if (depositMode === "fixed") {
        if (depositAmount != null && depositAmount > 0) {
          return roundCurrency(depositAmount);
        }
        if (depositValue != null && depositValue > 0) {
          return roundCurrency(depositValue);
        }
        return 0;
      }
      if (!(depositValue != null && depositValue > 0)) {
        return depositAmount != null && depositAmount > 0 ? roundCurrency(depositAmount) : 0;
      }
      const targetKey = depositTarget === "base" ? "base" : "subtotal";
      const contractTotal = Math.max(0, basePriceValue + extrasOverride);
      const targetAmount = targetKey === "base" ? basePriceValue : contractTotal;
      if (!(targetAmount > 0)) {
        return depositAmount != null && depositAmount > 0 ? roundCurrency(depositAmount) : 0;
      }
      const calculated = (targetAmount * depositValue) / 100;
      const rounded = roundCurrency(calculated);
      if (rounded > 0) {
        return rounded;
      }
      return depositAmount != null && depositAmount > 0 ? roundCurrency(depositAmount) : 0;
    },
    [basePriceValue, packageDepositConfig, roundCurrency]
  );

  const suggestedDepositAmount = useMemo(
    () => computeSuggestedDeposit(extraTotals.total),
    [computeSuggestedDeposit, extraTotals.total]
  );

  const basePackageDepositAmount = useMemo(
    () => computeSuggestedDeposit(0),
    [computeSuggestedDeposit]
  );

  const depositInputValue =
    state.details.depositAmount !== undefined
      ? state.details.depositAmount
      : suggestedDepositAmount > 0
      ? String(suggestedDepositAmount)
      : "";

  const hasManualDepositInput = Boolean(
    state.details.depositAmount && state.details.depositAmount.trim().length > 0
  );

  const depositNumeric = useMemo(() => {
    const raw = state.details.depositAmount;
    if (raw == null) {
      return suggestedDepositAmount > 0 ? suggestedDepositAmount : 0;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      return suggestedDepositAmount > 0 ? suggestedDepositAmount : 0;
    }
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) {
      return suggestedDepositAmount > 0 ? suggestedDepositAmount : 0;
    }
    return Math.max(0, Math.round(numeric * 100) / 100);
  }, [state.details.depositAmount, suggestedDepositAmount]);

  const packageDerived = useMemo(() => {
    const round = (value: number) => Math.round(value * 100) / 100;
    if (!vatUiEnabled) {
      if (basePriceValue > 0) {
        const gross = round(basePriceValue);
        return {
          packageNet: gross,
          packageVat: 0,
          packageGross: gross,
          packageVatRate: null,
        };
      }
      if (includedTotals.total > 0) {
        const gross = round(includedTotals.total);
        return {
          packageNet: gross,
          packageVat: 0,
          packageGross: gross,
          packageVatRate: null,
        };
      }
      return {
        packageNet: 0,
        packageVat: 0,
        packageGross: 0,
        packageVatRate: null,
      };
    }
    const baseVatRate =
      overallVatBreakdown.length === 1 &&
      Number.isFinite(overallVatBreakdown[0].rate)
        ? overallVatBreakdown[0].rate
        : null;
    const includedVatRate =
      includedVatBreakdown.length === 1 &&
      Number.isFinite(includedVatBreakdown[0].rate)
        ? includedVatBreakdown[0].rate
        : null;

    if (basePriceValue > 0) {
      if (baseVatRate != null) {
        const divisor = 1 + baseVatRate / 100;
        const net = round(basePriceValue / divisor);
        const vat = round(basePriceValue - net);
        return {
          packageNet: net,
          packageVat: vat,
          packageGross: round(basePriceValue),
          packageVatRate: baseVatRate,
        };
      }
      const vatPortion = Math.min(combinedTotals.vat, basePriceValue);
      const netPortion = round(Math.max(basePriceValue - vatPortion, 0));
      return {
        packageNet: netPortion,
        packageVat: round(vatPortion),
        packageGross: round(basePriceValue),
        packageVatRate: baseVatRate,
      };
    }

    if (includedTotals.total > 0) {
      return {
        packageNet: round(includedTotals.net),
        packageVat: round(includedTotals.vat),
        packageGross: round(includedTotals.total),
        packageVatRate: includedVatRate,
      };
    }

    return {
      packageNet: 0,
      packageVat: 0,
      packageGross: 0,
      packageVatRate: null,
    };
  }, [
    basePriceValue,
    combinedTotals.vat,
    includedTotals.net,
    includedTotals.total,
    includedTotals.vat,
    includedVatBreakdown,
    overallVatBreakdown,
    vatUiEnabled,
  ]);

  const clientTotals = useMemo(
    () => ({
      net: packageDerived.packageNet + extraTotals.net,
      vat: packageDerived.packageVat + extraTotals.vat,
      total: packageDerived.packageGross + extraTotals.total,
    }),
    [
      packageDerived.packageNet,
      packageDerived.packageVat,
      packageDerived.packageGross,
      extraTotals.net,
      extraTotals.vat,
      extraTotals.total,
    ]
  );

  const clientNet = clientTotals.net;
  const clientTax = clientTotals.vat;
  const clientTotal = clientTotals.total;
  const depositValue = depositNumeric;

  const includedHelperText = t("steps.packages.servicesCard.includedHelper", {
    total: formatCurrency(
      basePriceValue > 0 ? basePriceValue : packageDerived.packageGross - extraTotals.total
    ),
    defaultValue: "Included in the package price.",
  });

  const extraHelperText = t("steps.packages.servicesCard.addonsHelper", {
    total: formatCurrency(extraTotals.total),
    defaultValue: "Billed on top of the base package.",
  });

  const clientHelperText =
    extraTotals.total > 0
      ? t("steps.packages.summary.clientTotalHelperExtras", {
          defaultValue: "Add-ons are billed on top of the package.",
        })
      : basePriceValue > 0
      ? t("steps.packages.summary.clientTotalHelperInclusive")
      : undefined;

  const includedTooltipContent = (
    <>
      <p className="font-medium">
        {tForms("services.included_tooltip.title", {
          defaultValue: "Pakete dahil hizmetler",
        })}
      </p>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          {tForms("services.included_tooltip.point1", {
            defaultValue: "Müşteriye ek fatura oluşturmaz; paket fiyatına dahildir.",
          })}
        </li>
        {vatUiEnabled ? (
          <li>
            {tForms("services.included_tooltip.point2", {
              defaultValue: "KDV paket toplamında hesaplanır, satır bazında gösterilmez.",
            })}
          </li>
        ) : null}
        <li>
          {tForms("services.included_tooltip.point3", {
            defaultValue: "Bu liste paket kapsamını ve teslimatlarını netleştirir.",
          })}
        </li>
      </ul>
    </>
  );

  const extraTooltipContent = (
    <>
      <p className="font-medium">
        {tForms("services.addons_tooltip.title", {
          defaultValue: "Ek hizmetler",
        })}
      </p>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          {tForms("services.addons_tooltip.point1", {
            defaultValue: "Müşteriye paket fiyatına ek olarak faturalandırılır.",
          })}
        </li>
        {vatUiEnabled ? (
          <li>
            {tForms("services.addons_tooltip.point2", {
              defaultValue: "KDV ve fiyatlandırma her hizmetin moduna göre hesaplanır.",
            })}
          </li>
        ) : null}
        <li>
          {tForms("services.addons_tooltip.point3", {
            defaultValue: "Sözleşme ve ödeme toplamına otomatik yansır.",
          })}
        </li>
      </ul>
    </>
  );

  const includedCardTitle = t("steps.packages.servicesCard.includedTitle", {
    defaultValue: "Included services",
  });
  const extraCardTitle = t("steps.packages.servicesCard.addonsTitle", {
    defaultValue: "Add-on services",
  });
  const includedEmptyCta = tForms("services.add_included_cta", {
    defaultValue: "Pakete dahil hizmet ekle",
  });
  const extraEmptyCta = tForms("services.add_extra_cta", {
    defaultValue: "Ücrete ek hizmet ekle",
  });
  const manageButtonLabel = t("steps.packages.servicesCard.manage", {
    defaultValue: "Hizmetleri düzenle",
  });
  const addButtonLabel = t("steps.packages.servicesCard.add", {
    defaultValue: "Hizmet ekle",
  });
  const includedTooltipAria = tForms("services.included_info", {
    defaultValue: "Included services info",
  });
  const extraTooltipAria = tForms("services.addons_info", {
    defaultValue: "Add-on services info",
  });

  const depositHelperText = useMemo(() => {
    if (!(depositValue > 0)) {
      return t("steps.packages.summary.depositHelperNone");
    }
    if (packageDepositConfig?.depositMode === "fixed") {
      return tPackages("summaryView.pricing.deposit.fixed", {
        defaultValue: "Fixed upfront amount",
      });
    }
    if (
      packageDepositConfig?.depositMode &&
      packageDepositConfig.depositValue != null &&
      packageDepositConfig.depositValue > 0
    ) {
      return tPackages("summaryView.pricing.deposit.percent", {
        percent: formatPercent(packageDepositConfig.depositValue),
        target: tPackages(
          `summaryView.pricing.targets.${packageDepositConfig.depositTarget ?? "subtotal"}`
        ),
      });
    }
    return t("summary.cards.pricing.depositHelperDefault");
  }, [depositValue, packageDepositConfig, t, tPackages, formatPercent]);

  const depositAdjustedByExtras =
    !hasManualDepositInput && suggestedDepositAmount - basePackageDepositAmount > 0.009;

  const renderServicePreview = (pkg: PackageRecord) => {
    const defaultServiceIds = pkg.default_add_ons ?? [];
    const defaultServices = services.filter((service) =>
      defaultServiceIds.includes(service.id)
    );
    if (!defaultServices.length) {
      return null;
    }

    const maxToShow = 5;
    const list = defaultServices.slice(0, maxToShow);
    const remaining = defaultServices.length - list.length;
    const tooltipContent = defaultServices.map((service) => service.name).join(", ");

    return (
      <div className="mt-3 text-xs text-muted-foreground">
        <span className="font-medium text-slate-900">
          {t("steps.packages.defaultServices", { count: defaultServices.length })}
        </span>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-slate-600" title={tooltipContent}>
          {list.map((service) => (
            <Badge key={service.id} variant="outline" className="text-[10px] font-medium">
              {service.name}
            </Badge>
          ))}
          {remaining > 0 ? <span className="text-xs text-slate-500">+{remaining}</span> : null}
        </div>
      </div>
    );
  };

  const handleSelectPackage = (pkg: PackageRecord) => {
    const includedFromPackage = buildPackageIncludedItems(pkg);
    const includedIds = new Set(
      includedFromPackage
        .map((item) => item.serviceId)
        .filter((id): id is string => Boolean(id))
    );
    const addonItems = buildPackageAddOnItems(pkg, includedIds);

    updateServices({
      packageId: pkg.id,
      packageLabel: pkg.name,
      includedItems: includedFromPackage,
      extraItems: addonItems,
      showCustomSetup: true,
    });

    const resolvedBasePrice =
      typeof pkg.client_total === "number" && Number.isFinite(pkg.client_total)
        ? pkg.client_total
        : typeof pkg.price === "number" && Number.isFinite(pkg.price)
        ? pkg.price
        : null;

    const detailsUpdate: Partial<ProjectCreationDetails> = {
      depositAmount: undefined,
    };
    if (resolvedBasePrice != null) {
      detailsUpdate.basePrice = String(resolvedBasePrice);
    }
    updateDetails(detailsUpdate);

    const snapshot = buildProjectPackageSnapshot(pkg);
    updateDelivery(deriveDeliveryStateFromSnapshot(snapshot.delivery));
  };

  const handleClearPackage = () => {
    const hasItems = state.services.includedItems.length + state.services.extraItems.length > 0;
    updateServices({
      packageId: undefined,
      packageLabel: hasItems ? t("summary.values.customServices") : undefined,
      showCustomSetup: hasItems || state.services.showCustomSetup,
    });
    updateDelivery(createDefaultProjectDeliveryState());
  };

  const handleEnableCustom = () => {
    updateServices({
      showCustomSetup: true,
    });
  };

  const handleResetCustom = () => {
    updateServices({
      showCustomSetup: false,
      packageId: undefined,
      packageLabel: undefined,
      includedItems: [],
      extraItems: [],
    });
    updateDetails({
      basePrice: "",
      depositAmount: undefined,
    });
    updateDelivery(createDefaultProjectDeliveryState());
  };

  const packagesLoading = packagesQuery.isLoading;
  const packagesError = packagesQuery.error as Error | null;
  const servicesError = servicesQuery.error as Error | null;

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            {t("steps.packages.heading")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("steps.packages.description")}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{t("steps.packages.packageLabel")}</Label>
        </div>

        {packagesLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("steps.packages.loadingPackages")}
          </div>
        ) : packagesError ? (
          <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <p>{t("steps.packages.packagesError")}</p>
            <Button variant="outline" size="sm" onClick={() => packagesQuery.refetch()}>
              {t("steps.packages.retry")}
            </Button>
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            {t("steps.packages.noPackages")}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredPackages.map((pkg) => {
              const isSelected = state.services.packageId === pkg.id;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => handleSelectPackage(pkg)}
                  className={cn(
                    "flex h-full flex-col rounded-xl border px-4 py-3 text-left transition-all duration-300 ease-out hover:border-emerald-400/60 hover:shadow-md",
                    isSelected
                      ? "border-emerald-500 bg-emerald-50/60 shadow-sm shadow-emerald-200"
                      : "border-border bg-white"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{pkg.name}</p>
                        {pkg.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pkg.price != null && (
                        <span className="text-sm font-medium text-emerald-600">
                          ₺{Math.round(pkg.price).toLocaleString()}
                        </span>
                      )}
                      {isSelected ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                          {t("steps.packages.selectedIndicator")}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  {renderServicePreview(pkg)}
                </button>
              );
            })}
          </div>
        )}

        {!state.services.packageId && !showCustomSetup && filteredPackages.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <span>{t("steps.packages.customSetupPrompt")}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleEnableCustom}>
              {t("steps.packages.enableCustom")}
            </Button>
          </div>
        )}

        {(state.services.packageId || showCustomSetup) && (
          <div
            ref={actionsRef}
            className="mx-1 flex flex-col gap-2 rounded-2xl bg-slate-100/80 px-3 py-2 transition-opacity duration-200 sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:gap-2"
          >
            {state.services.packageLabel ? (
              <Badge
                variant="secondary"
                className="w-full rounded-full bg-emerald-100 px-3 text-left text-xs font-medium text-emerald-700 sm:mr-auto sm:w-auto sm:text-center"
              >
                {t("steps.packages.selectedSummary", { name: state.services.packageLabel })}
              </Badge>
            ) : null}
            <div className="flex items-center justify-end gap-4 text-xs font-semibold text-slate-600 sm:gap-2">
              <Button
                variant="textGhost"
                size="sm"
                onClick={handleClearPackage}
                disabled={!state.services.packageId}
                className="h-auto px-0 text-xs text-slate-600 underline decoration-transparent underline-offset-4 hover:text-slate-900 hover:decoration-current disabled:text-slate-300 sm:h-8 sm:rounded-full sm:px-3 sm:no-underline sm:hover:bg-slate-200 sm:hover:text-slate-900"
              >
                {t("steps.packages.clearPackage")}
              </Button>
              <Button
                variant="textGhost"
                size="sm"
                onClick={handleResetCustom}
                disabled={!showCustomSetup}
                className="h-auto px-0 text-xs text-slate-600 underline decoration-transparent underline-offset-4 hover:text-slate-900 hover:decoration-current disabled:text-slate-300 sm:h-8 sm:rounded-full sm:px-3 sm:no-underline sm:hover:bg-slate-200 sm:hover:text-slate-900"
              >
                {t("steps.packages.resetCustom")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {showCustomSetup && (
        <div className="animate-in fade-in slide-in-from-top-2 space-y-6 rounded-2xl border border-border/80 bg-white/80 p-6 shadow-sm transition-all duration-300 ease-out">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-base-price">{t("steps.packages.basePriceLabel")}</Label>
              <Input
                id="project-base-price"
                type="number"
                min="0"
                step="1"
                value={state.details.basePrice ?? ""}
                onChange={(event) => updateDetails({ basePrice: event.target.value })}
                placeholder={t("steps.packages.basePricePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-deposit-amount">{t("steps.packages.depositLabel")}</Label>
              <Input
                id="project-deposit-amount"
                type="number"
                min="0"
                step="0.01"
                value={depositInputValue}
                onChange={(event) => updateDetails({ depositAmount: event.target.value })}
                placeholder={t("steps.packages.depositPlaceholder")}
              />
              {depositAdjustedByExtras ? (
                <p className="rounded-md bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
                  {t("steps.packages.depositAdjustedNotice", {
                    defaultValue: "Add-ons updated the deposit automatically.",
                  })}
                </p>
              ) : null}
            </div>
          </div>

          <TooltipProvider delayDuration={150}>
            <div className="grid gap-4 lg:grid-cols-2">
              <ProjectServicesCard
                items={includedCardItems}
                emptyCtaLabel={includedEmptyCta}
                onAdd={() => handleServiceDialogOpen("included")}
                title={includedCardTitle}
                helperText={includedHelperText}
                tooltipAriaLabel={includedTooltipAria}
                tooltipContent={includedTooltipContent}
                addButtonLabel={
                  includedCardItems.length > 0 ? manageButtonLabel : addButtonLabel
                }
              />
              <ProjectServicesCard
                items={extraCardItems}
                emptyCtaLabel={extraEmptyCta}
                onAdd={() => handleServiceDialogOpen("extra")}
                title={extraCardTitle}
                helperText={extraHelperText}
                tooltipAriaLabel={extraTooltipAria}
                tooltipContent={extraTooltipContent}
                addButtonLabel={
                  extraCardItems.length > 0 ? manageButtonLabel : addButtonLabel
                }
                itemAlign="start"
              />
            </div>
          </TooltipProvider>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{t("steps.packages.servicesLabel")}</Label>
                {existingItems.length > 0 ? (
                  <Badge variant="secondary">
                    {t("steps.packages.servicesBadge", {
                      count: existingItems.length,
                    })}
                  </Badge>
                ) : null}
              </div>
              {hasServices ? (
                <ServicesTableCard
                  rows={summaryTableRows}
                  labels={serviceTableLabels}
                  emptyMessage={t("steps.packages.summary.empty")}
                  formatCurrency={formatCurrency}
                />
              ) : null}
            </div>
            <div className="flex justify-end">
              <SummaryTotalsCard
                className={cn("bg-white/95 w-full max-w-[420px] sm:w-auto sm:min-w-[320px]")}
              >
                {hasBillableServices ? (
                  <>
                    <SummaryTotalsSection>
                      <SummaryTotalRow
                        label={t("steps.packages.summary.servicesAddOnCount")}
                        value={String(addOnCount)}
                      />
                      {vatUiEnabled && (
                        <SummaryTotalRow
                          label={
                            extraVatBreakdown.length === 1
                              ? t("steps.packages.summary.servicesVatWithRate", {
                                  rate: formatPercent(extraVatBreakdown[0].rate),
                                })
                              : t("steps.packages.summary.servicesVat")
                          }
                          value={formatCurrency(extraTotals.vat)}
                        />
                      )}
                      <SummaryTotalRow
                        label={t("steps.packages.summary.servicesCost")}
                        value={formatCurrency(extraTotals.cost)}
                      />
                      <SummaryTotalRow
                        label={t("steps.packages.summary.servicesPrice")}
                        value={formatCurrency(extraTotals.net)}
                        emphasizeLabel={!vatUiEnabled}
                      />
                      {!vatUiEnabled && (
                        <SummaryTotalRow
                          label={t("steps.packages.summary.servicesMargin")}
                          value={formatCurrency(servicesMargin)}
                          tone={servicesMargin >= 0 ? "positive" : "negative"}
                          emphasizeLabel
                        />
                      )}
                    </SummaryTotalsSection>
                    {vatUiEnabled ? (
                      <>
                        <SummaryTotalsDivider />
                        <SummaryTotalsSection className="pt-3">
                          <SummaryTotalRow
                            label={t("steps.packages.summary.servicesGross")}
                            value={formatCurrency(extraTotals.total)}
                            emphasizeLabel
                          />
                          <SummaryTotalRow
                            label={t("steps.packages.summary.servicesMargin")}
                            value={formatCurrency(servicesMargin)}
                            tone={servicesMargin >= 0 ? "positive" : "negative"}
                            emphasizeLabel
                          />
                        </SummaryTotalsSection>
                      </>
                    ) : null}
                    <SummaryTotalsDivider />
                  </>
                ) : null}
                {vatUiEnabled ? (
                  <>
                    <SummaryTotalsSection className={cn("space-y-3", hasBillableServices ? "pt-3" : undefined)}>
                      <SummaryTotalRow
                        label={t("steps.packages.summary.packageNet")}
                        value={formatCurrency(packageDerived.packageNet)}
                        emphasizeLabel
                      />
                      <SummaryTotalRow
                        label={
                          packageDerived.packageVatRate != null
                            ? t("steps.packages.summary.packageVatWithRate", {
                                rate: formatPercent(packageDerived.packageVatRate),
                              })
                            : t("steps.packages.summary.packageVat")
                        }
                        value={formatCurrency(packageDerived.packageVat)}
                        helper={
                          packageDerived.packageVatRate != null
                            ? t("steps.packages.summary.packageVatHelperInclusive")
                            : undefined
                        }
                      />
                      <SummaryTotalRow
                        label={t("steps.packages.summary.packageGross")}
                        value={formatCurrency(packageDerived.packageGross)}
                        emphasizeLabel
                      />
                    </SummaryTotalsSection>
                    <SummaryTotalsDivider />
                    <SummaryTotalsSection className={cn("space-y-3", "pt-3")}>
                      <SummaryTotalRow
                        label={t("steps.packages.summary.clientNet")}
                        value={formatCurrency(clientNet)}
                      />
                      <SummaryTotalRow
                        label={t("steps.packages.summary.clientTax")}
                        value={formatCurrency(clientTax)}
                      />
                      <SummaryTotalRow
                        label={t("steps.packages.summary.clientTotal")}
                        value={formatCurrency(clientTotal)}
                        tone="positive"
                        emphasizeLabel
                        helper={clientHelperText}
                      />
                    </SummaryTotalsSection>
                    <SummaryTotalsDivider />
                  </>
                ) : (
                  <>
                    <SummaryTotalsSection className={cn("space-y-3", hasBillableServices ? "pt-3" : undefined)}>
                      <SummaryTotalRow
                        label={t("steps.packages.summary.packageGross")}
                        value={formatCurrency(clientTotal)}
                        tone="positive"
                        emphasizeLabel
                        helper={clientHelperText}
                      />
                    </SummaryTotalsSection>
                    <SummaryTotalsDivider />
                  </>
                )}
                <SummaryTotalsSection className={cn("space-y-3", hasBillableServices ? "pt-3" : undefined)}>
                  <SummaryTotalRow
                    label={t("steps.packages.summary.deposit")}
                    value={formatCurrency(depositValue)}
                    helper={depositHelperText}
                    emphasizeLabel={depositValue > 0}
                  />
                </SummaryTotalsSection>
              </SummaryTotalsCard>
            </div>
            {!hasServices ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-white/80 p-4 text-sm text-muted-foreground">
                {t("steps.packages.servicesEmpty")}
              </div>
            ) : null}
          </div>
        </div>
      )}
      </div>

      <ProjectServicesQuickEditDialog
        open={serviceDialogState.open}
        onOpenChange={(open) =>
          setServiceDialogState((previous) => ({ ...previous, open }))
        }
        mode={serviceDialogState.mode}
        services={quickEditServices}
        selections={serviceDialogState.mode === "included" ? includedSelections : extraSelections}
        isLoading={servicesQuery.isLoading}
        error={servicesError ? t("steps.packages.servicesError") : null}
        onRetry={servicesError ? () => servicesQuery.refetch() : undefined}
        onSubmit={(results) => handleServiceQuickEditSubmit(serviceDialogState.mode, results)}
      />
    </>
  );
};
