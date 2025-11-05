import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ServiceInventorySelector,
  type ServiceInventoryItem,
  type ServiceInventoryType,
} from "@/components/ServiceInventorySelector";
import {
  ServicesTableCard,
  SummaryTotalRow,
  SummaryTotalsCard,
  SummaryTotalsDivider,
  SummaryTotalsSection,
  type ServicesTableRow,
} from "@/components/services";
import { usePackages, useProjectTypes, useServices } from "@/hooks/useOrganizationData";
import { useProjectCreationContext } from "../hooks/useProjectCreationContext";
import { useProjectCreationActions } from "../hooks/useProjectCreationActions";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles } from "lucide-react";
import type { ProjectCreationDetails, ProjectServiceLineItem } from "../types";
import { calculateLineItemPricing } from "@/features/package-creation/utils/lineItemPricing";
import { DEFAULT_SERVICE_UNIT, normalizeServiceUnit } from "@/lib/services/units";
import type { VatMode } from "@/lib/accounting/vat";

interface PackageRecord {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  client_total?: number | null;
  applicable_types: string[];
  default_add_ons: string[];
  is_active?: boolean;
  include_addons_in_price?: boolean | null;
  pricing_metadata?: Record<string, unknown> | null;
}

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
  const { state } = useProjectCreationContext();
  const { updateServices, updateDetails } = useProjectCreationActions();

  const packagesQuery = usePackages();
  const servicesQuery = useServices();
  const projectTypesQuery = useProjectTypes();

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
      return pkg.applicable_types.includes(selectedProjectType.name);
    });
  }, [packages, selectedProjectType]);

  const selectedPackage = state.services.packageId
    ? filteredPackages.find((pkg) => pkg.id === state.services.packageId) ??
      packages.find((pkg) => pkg.id === state.services.packageId)
    : undefined;

  const showCustomSetup =
    Boolean(state.services.packageId) ||
    state.services.showCustomSetup ||
    state.services.items.length > 0;

  const serviceMap = useMemo<Map<string, ServiceWithMetadata>>(
    () =>
      new Map(
        services.map((service) => {
          const vatRate =
            typeof service.vat_rate === "number" && Number.isFinite(service.vat_rate)
              ? Number(service.vat_rate)
              : null;
          const vatMode: VatMode = service.price_includes_vat ? "inclusive" : "exclusive";
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
              priceIncludesVat: service.price_includes_vat ?? false,
              unit,
              isActive: service.is_active !== false,
            },
          ] as const;
        })
      ) as Map<string, ServiceWithMetadata>,
    [services]
  );

  const inventoryServices = useMemo<ServiceInventoryItem[]>(
    () =>
      services
        .filter((service) => service.is_active !== false)
        .map((service) => ({
        id: service.id,
        name: service.name,
        category: service.category,
        serviceType: (service.service_type ?? "unknown") as ServiceInventoryType,
        vendorName: service.vendor_name ?? null,
        unitCost: service.cost_price ?? null,
        unitPrice: service.selling_price ?? service.price ?? null,
        unit: normalizeServiceUnit(service.default_unit),
        defaultUnit: service.default_unit ?? null,
        isActive: service.is_active !== false,
        vatRate:
          typeof service.vat_rate === "number" && Number.isFinite(service.vat_rate)
            ? Number(service.vat_rate)
            : null,
        priceIncludesVat: service.price_includes_vat ?? false,
      })),
    [services]
  );

  const existingItems = state.services.items;
  const hasServices = existingItems.length > 0;
  const [openPricingIds, setOpenPricingIds] = useState<Set<string>>(() => new Set());
  const [openVatIds, setOpenVatIds] = useState<Set<string>>(() => new Set());
  const [pendingPricingResetId, setPendingPricingResetId] = useState<string | null>(null);
  const [pendingVatResetId, setPendingVatResetId] = useState<string | null>(null);
  const selectedItemsByServiceId = useMemo(() => {
    const map = new Map<string, ProjectServiceLineItem>();
    existingItems.forEach((item) => {
      if (item.serviceId) {
        map.set(item.serviceId, item);
      } else {
        map.set(item.id, item);
      }
    });
    return map;
  }, [existingItems]);

  const selectedQuantities = useMemo(
    () =>
      existingItems.reduce<Record<string, number>>((acc, item) => {
        if (item.serviceId) {
          acc[item.serviceId] = Math.max(1, item.quantity ?? 1);
        }
        return acc;
      }, {}),
    [existingItems]
  );

  useEffect(() => {
    const validIds = new Set(existingItems.map((item) => item.id));
    setOpenPricingIds((previous) => {
      let changed = false;
      const next = new Set<string>();
      previous.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : previous;
    });
    setOpenVatIds((previous) => {
      let changed = false;
      const next = new Set<string>();
      previous.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : previous;
    });
  }, [existingItems]);

  const totals = useMemo(() => {
    return existingItems.reduce(
      (acc, item) => {
        const quantity = Math.max(1, item.quantity ?? 1);
        const unitCost = Number(item.unitCost ?? 0);
        const pricing = calculateLineItemPricing(item);
        acc.cost += unitCost * quantity;
        acc.net += pricing.net;
        acc.vat += pricing.vat;
        acc.total += pricing.gross;
        return acc;
      },
      { cost: 0, net: 0, vat: 0, total: 0 }
    );
  }, [existingItems]);

  const setItems = useCallback(
    (items: ProjectServiceLineItem[]) => {
      updateServices({ items });
    },
    [updateServices]
  );

  const servicesMargin = totals.net - totals.cost;
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
  const totalQuantity = useMemo(
    () =>
      existingItems.reduce(
        (acc, item) => acc + Math.max(1, item.quantity ?? 1),
        0
      ),
    [existingItems]
  );
  const vatBreakdown = useMemo(() => {
    const buckets = new Map<number, number>();
    existingItems.forEach((item) => {
      const pricing = calculateLineItemPricing(item);
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
  }, [existingItems]);

  const updateItem = useCallback((itemId: string, updates: Partial<ProjectServiceLineItem>) => {
    const nextItems = existingItems.map((item) =>
      item.id === itemId || item.serviceId === itemId ? { ...item, ...updates } : item
    );
    setItems(nextItems);
  }, [existingItems, setItems]);

  const removeItem = useCallback((itemId: string) => {
    setItems(existingItems.filter((item) => item.id !== itemId && item.serviceId !== itemId));
  }, [existingItems, setItems]);

  const adjustQuantity = useCallback((itemId: string, delta: number) => {
    const target = existingItems.find((item) => item.serviceId === itemId || item.id === itemId);
    const next = Math.max(1, (target?.quantity ?? 1) + delta);
    updateItem(itemId, { quantity: next });
  }, [existingItems, updateItem]);

  const buildLineItemFromService = useCallback((service: ServiceWithMetadata): ProjectServiceLineItem => ({
    id: service.id,
    type: "existing",
    serviceId: service.id,
    name: service.name,
    quantity: 1,
    unitCost: service.unitCost,
    unitPrice: service.unitPrice,
    vendorName: service.vendor_name ?? null,
    vatRate: service.vatRate ?? undefined,
    vatMode: service.vatMode,
    unit: service.unit,
    source: "catalog",
  }), []);

  const handleAddService = useCallback((serviceId: string) => {
    const service = serviceMap.get(serviceId);
    if (!service) return;

    const filtered = existingItems.filter((item) => item.serviceId !== serviceId);
    const nextItem = buildLineItemFromService(service);
    setItems([...filtered, nextItem]);
    updateServices({ showCustomSetup: true });
  }, [existingItems, buildLineItemFromService, serviceMap, setItems, updateServices]);

  const handleIncreaseService = (serviceId: string) => adjustQuantity(serviceId, 1);
  const handleDecreaseService = (serviceId: string) => adjustQuantity(serviceId, -1);

  const handleSetServiceQuantity = (serviceId: string, quantity: number) => {
    updateItem(serviceId, { quantity: Math.max(1, quantity) });
  };

  const handleRemoveService = (serviceId: string) => {
    removeItem(serviceId);
  };

  const closePricingAndVatEditors = useCallback((itemId: string) => {
    setOpenPricingIds((previous) => {
      if (!previous.has(itemId)) {
        return previous;
      }
      const next = new Set(previous);
      next.delete(itemId);
      return next;
    });
    setOpenVatIds((previous) => {
      if (!previous.has(itemId)) {
        return previous;
      }
      const next = new Set(previous);
      next.delete(itemId);
      return next;
    });
  }, []);

  const closeVatEditor = useCallback((itemId: string) => {
    setOpenVatIds((previous) => {
      if (!previous.has(itemId)) {
        return previous;
      }
      const next = new Set(previous);
      next.delete(itemId);
      return next;
    });
  }, []);

  const getLineItemDefaults = useCallback(
    (lineItem: ProjectServiceLineItem) => {
      const serviceMeta = serviceMap.get(lineItem.serviceId ?? lineItem.id);
      const toFiniteNumber = (value: number | null | undefined) =>
        typeof value === "number" && Number.isFinite(value) ? value : null;

      return {
        serviceMeta,
        unitCost: serviceMeta?.unitCost ?? toFiniteNumber(lineItem.unitCost),
        unitPrice: serviceMeta?.unitPrice ?? toFiniteNumber(lineItem.unitPrice),
        vatMode: serviceMeta?.vatMode ?? (lineItem.vatMode ?? "exclusive"),
        vatRate: serviceMeta ? toFiniteNumber(serviceMeta.vatRate) : toFiniteNumber(lineItem.vatRate),
      };
    },
    [serviceMap]
  );

  const isPricingDirty = useCallback(
    (lineItem: ProjectServiceLineItem) => {
      const defaults = getLineItemDefaults(lineItem);
      const toFiniteNumber = (value: number | null | undefined) =>
        typeof value === "number" && Number.isFinite(value) ? value : null;

      const currentUnitCost = toFiniteNumber(lineItem.unitCost);
      const currentUnitPrice = toFiniteNumber(lineItem.unitPrice);
      const currentVatMode = lineItem.vatMode ?? defaults.vatMode;
      const currentVatRate = toFiniteNumber(lineItem.vatRate);

      return (
        currentUnitCost !== defaults.unitCost ||
        currentUnitPrice !== defaults.unitPrice ||
        currentVatMode !== defaults.vatMode ||
        currentVatRate !== defaults.vatRate
      );
    },
    [getLineItemDefaults]
  );

  const isVatDirty = useCallback(
    (lineItem: ProjectServiceLineItem) => {
      const defaults = getLineItemDefaults(lineItem);
      const toFiniteNumber = (value: number | null | undefined) =>
        typeof value === "number" && Number.isFinite(value) ? value : null;

      const currentVatMode = lineItem.vatMode ?? defaults.vatMode;
      const currentVatRate = toFiniteNumber(lineItem.vatRate);

      return currentVatMode !== defaults.vatMode || currentVatRate !== defaults.vatRate;
    },
    [getLineItemDefaults]
  );

  const resetLineItemPricing = useCallback(
    (lineItem: ProjectServiceLineItem) => {
      const defaults = getLineItemDefaults(lineItem);
      updateItem(lineItem.id, {
        unitCost: defaults.unitCost,
        unitPrice: defaults.unitPrice,
        vatMode: defaults.vatMode,
        vatRate: defaults.vatRate ?? null,
      });
    },
    [getLineItemDefaults, updateItem]
  );

  const resetLineItemVat = useCallback(
    (lineItem: ProjectServiceLineItem) => {
      const defaults = getLineItemDefaults(lineItem);
      updateItem(lineItem.id, {
        vatMode: defaults.vatMode,
        vatRate: defaults.vatRate ?? null,
      });
    },
    [getLineItemDefaults, updateItem]
  );

  const handlePricingButtonClick = (lineItem: ProjectServiceLineItem) => {
    const isOpen = openPricingIds.has(lineItem.id);
    if (!isOpen) {
      setOpenPricingIds((previous) => {
        const next = new Set(previous);
        next.add(lineItem.id);
        return next;
      });
      return;
    }

    const dirty = isPricingDirty(lineItem);
    if (dirty) {
      setPendingPricingResetId(lineItem.id);
      return;
    }

    resetLineItemPricing(lineItem);
    closePricingAndVatEditors(lineItem.id);
  };

  const handleVatButtonClick = (lineItem: ProjectServiceLineItem) => {
    const isOpen = openVatIds.has(lineItem.id);
    if (!isOpen) {
      setOpenVatIds((previous) => {
        const next = new Set(previous);
        next.add(lineItem.id);
        return next;
      });
      return;
    }

    const dirty = isVatDirty(lineItem);
    if (dirty) {
      setPendingVatResetId(lineItem.id);
      return;
    }

    resetLineItemVat(lineItem);
    closeVatEditor(lineItem.id);
  };

  const handleVatModeChange = useCallback((itemId: string, mode: VatModeOption) => {
    updateItem(itemId, { vatMode: mode });
  }, [updateItem]);

  const handleVatRateChange = useCallback((itemId: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      updateItem(itemId, { vatRate: null });
      return;
    }

    const numeric = Number(trimmed.replace(/,/g, "."));
    if (Number.isNaN(numeric)) {
      return;
    }

    const clamped = Math.min(99.99, Math.max(0, numeric));
    updateItem(itemId, { vatRate: clamped });
  }, [updateItem]);

  const pendingPricingLineItem = useMemo(() => {
    if (!pendingPricingResetId) {
      return null;
    }
    return (
      existingItems.find(
        (item) => item.id === pendingPricingResetId || item.serviceId === pendingPricingResetId
      ) ?? null
    );
  }, [existingItems, pendingPricingResetId]);

  const pendingVatLineItem = useMemo(() => {
    if (!pendingVatResetId) {
      return null;
    }
    return (
      existingItems.find(
        (item) => item.id === pendingVatResetId || item.serviceId === pendingVatResetId
      ) ?? null
    );
  }, [existingItems, pendingVatResetId]);

  useEffect(() => {
    if (pendingPricingResetId && !pendingPricingLineItem) {
      setPendingPricingResetId(null);
    }
  }, [pendingPricingLineItem, pendingPricingResetId]);

  useEffect(() => {
    if (pendingVatResetId && !pendingVatLineItem) {
      setPendingVatResetId(null);
    }
  }, [pendingVatLineItem, pendingVatResetId]);

  const confirmPricingReset = useCallback(() => {
    if (!pendingPricingLineItem) {
      setPendingPricingResetId(null);
      return;
    }
    resetLineItemPricing(pendingPricingLineItem);
    closePricingAndVatEditors(pendingPricingLineItem.id);
    setPendingPricingResetId(null);
  }, [pendingPricingLineItem, resetLineItemPricing, closePricingAndVatEditors]);

  const confirmVatReset = useCallback(() => {
    if (!pendingVatLineItem) {
      setPendingVatResetId(null);
      return;
    }
    resetLineItemVat(pendingVatLineItem);
    closeVatEditor(pendingVatLineItem.id);
    setPendingVatResetId(null);
  }, [pendingVatLineItem, resetLineItemVat, closeVatEditor]);

  const inventoryLabels = useMemo(
    () => ({
      typeMeta: {
        coverage: {
          title: t("steps.packages.inventory.types.coverage.title", { defaultValue: "Crew services" }),
          subtitle: t("steps.packages.inventory.types.coverage.subtitle", {
            defaultValue: "On-site coverage like photographers or videographers",
          }),
        },
        deliverable: {
          title: t("steps.packages.inventory.types.deliverable.title", { defaultValue: "Deliverables" }),
          subtitle: t("steps.packages.inventory.types.deliverable.subtitle", {
            defaultValue: "Products delivered after the shoot",
          }),
        },
        unknown: {
          title: t("steps.packages.inventory.types.unknown.title", { defaultValue: "Other services" }),
          subtitle: t("steps.packages.inventory.types.unknown.subtitle", {
            defaultValue: "Items without a service type yet",
          }),
        },
      },
      add: t("steps.packages.inventory.add", { defaultValue: "Add" }),
      decrease: t("common:actions.decrease", { defaultValue: "Decrease" }),
      increase: t("common:actions.increase", { defaultValue: "Increase" }),
      remove: t("steps.packages.list.remove", { defaultValue: "Remove" }),
      vendor: t("steps.packages.list.vendor", { defaultValue: "Vendor" }),
      unitCost: t("steps.packages.list.unitCost", { defaultValue: "Unit cost" }),
      unitPrice: t("steps.packages.list.unitPrice", { defaultValue: "Unit price" }),
      uncategorized: t("steps.packages.inventory.uncategorized", { defaultValue: "Other" }),
      inactive: t("steps.packages.inventory.inactive", { defaultValue: "Inactive" }),
      empty: t("steps.packages.inventory.empty", {
        defaultValue: "No services in your catalog yet. Create services to add them here.",
      }),
      quantity: t("steps.packages.list.quantity", { defaultValue: "Quantity" }),
      selectedTag: (selected: number, total: number) =>
        t("steps.packages.inventory.selectedTag", {
          defaultValue: "{{selected}} of {{total}} selected",
          selected,
          total,
        }),
      quantityTag: (count: number) =>
        t("steps.packages.inventory.quantityTag", {
          defaultValue: "{{count}} items",
          count,
        }),
      retry: t("common:actions.retry", { defaultValue: "Retry" }),
    }),
    [t]
  );

  const getUnitLabel = useCallback(
    (unit?: string | null) =>
      t(`steps.packages.units.short.${normalizeServiceUnit(unit)}`, {
        defaultValue: t(`steps.packages.units.options.${normalizeServiceUnit(unit)}`),
      }),
    [t]
  );

  const vatModeOptions = useMemo(
    () => [
      {
        value: "inclusive" as VatModeOption,
        label: t("steps.packages.vatControls.mode.inclusive"),
      },
      {
        value: "exclusive" as VatModeOption,
        label: t("steps.packages.vatControls.mode.exclusive"),
      },
    ],
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
      const vendorLabel = service?.vendor_name ?? item.vendorName ?? undefined;
      return {
        id: item.id,
        name: item.name,
        vendor: vendorLabel,
        quantity,
        unitLabel: getUnitLabel(item.unit ?? service?.unit ?? DEFAULT_SERVICE_UNIT),
        lineCost,
        unitPrice: item.unitPrice ?? service?.unitPrice ?? null,
        lineTotal: Math.round(pricing.gross * 100) / 100,
        isCustom: false,
      };
    });
  }, [existingItems, getUnitLabel, serviceMap]);

  useEffect(() => {
    if (!actionsRef.current) return;
    if (!state.services.packageId && !showCustomSetup) return;
    actionsRef.current.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  }, [state.services.packageId, showCustomSetup]);

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

  const includeAddOnsInPrice = selectedPackage?.include_addons_in_price ?? true;

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

  const suggestedDepositAmount = useMemo(() => {
    if (!packageDepositConfig || !packageDepositConfig.enableDeposit) {
      return 0;
    }
    const { depositMode, depositValue, depositTarget, depositAmount } = packageDepositConfig;
    const roundCurrency = (value: number) => Math.round(value * 100) / 100;
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
    const subtotal = Math.max(0, basePriceValue + totals.total);
    const clientTotal = includeAddOnsInPrice ? basePriceValue : subtotal;
    const targetAmount =
      targetKey === "base"
        ? basePriceValue
        : includeAddOnsInPrice
        ? clientTotal
        : subtotal;
    if (!(targetAmount > 0)) {
      return depositAmount != null && depositAmount > 0 ? roundCurrency(depositAmount) : 0;
    }
    const calculated = (targetAmount * depositValue) / 100;
    const rounded = roundCurrency(calculated);
    if (rounded > 0) {
      return rounded;
    }
    return depositAmount != null && depositAmount > 0 ? roundCurrency(depositAmount) : 0;
  }, [packageDepositConfig, basePriceValue, totals.total, includeAddOnsInPrice]);

  const depositInputValue =
    state.details.depositAmount !== undefined
      ? state.details.depositAmount
      : suggestedDepositAmount > 0
      ? String(suggestedDepositAmount)
      : "";

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
    const singleVatRate =
      vatBreakdown.length === 1 && Number.isFinite(vatBreakdown[0].rate)
        ? vatBreakdown[0].rate
        : null;

    if (basePriceValue > 0) {
      if (singleVatRate != null) {
        const divisor = 1 + singleVatRate / 100;
        const net = round(basePriceValue / divisor);
        const vat = round(basePriceValue - net);
        return {
          packageNet: net,
          packageVat: vat,
          packageGross: round(basePriceValue),
          packageVatRate: singleVatRate,
        };
      }
      const vatPortion = Math.min(totals.vat, basePriceValue);
      const netPortion = round(Math.max(basePriceValue - vatPortion, 0));
      return {
        packageNet: netPortion,
        packageVat: round(vatPortion),
        packageGross: round(basePriceValue),
        packageVatRate: singleVatRate,
      };
    }

    return {
      packageNet: round(totals.net),
      packageVat: round(totals.vat),
      packageGross: round(totals.total),
      packageVatRate: singleVatRate,
    };
  }, [basePriceValue, totals, vatBreakdown]);

  const clientNet = packageDerived.packageNet;
  const clientTax = packageDerived.packageVat;
  const clientTotal = packageDerived.packageGross;
  const depositValue = depositNumeric;
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
    const defaultServiceIds = pkg.default_add_ons ?? [];
    const defaultItems = defaultServiceIds
      .map((serviceId) => serviceMap.get(serviceId))
      .filter((service): service is ServiceWithMetadata => Boolean(service))
      .map((service) => buildLineItemFromService(service));

    updateServices({
      packageId: pkg.id,
      packageLabel: pkg.name,
      items: defaultItems,
      showCustomSetup: true,
    });

    updateDetails({ depositAmount: undefined });
    if (pkg.price != null) {
      updateDetails({ basePrice: pkg.price.toString() });
    }
  };

  const handleClearPackage = () => {
    const hasItems = state.services.items.length > 0;
    updateServices({
      packageId: undefined,
      packageLabel: hasItems ? t("summary.values.customServices") : undefined,
      showCustomSetup: hasItems || state.services.showCustomSetup,
    });
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
      items: [],
    });
    updateDetails({
      basePrice: "",
      depositAmount: undefined,
    });
  };

  const packagesLoading = packagesQuery.isLoading;
  const servicesLoading = servicesQuery.isLoading;
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
            className="flex items-center justify-end gap-2 rounded-full bg-slate-100/80 px-3 py-1.5 transition-opacity duration-200"
          >
            {state.services.packageLabel ? (
              <Badge
                variant="secondary"
                className="mr-auto h-7 rounded-full bg-emerald-100 px-3 text-xs font-medium text-emerald-700"
              >
                {t("steps.packages.selectedSummary", { name: state.services.packageLabel })}
              </Badge>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearPackage}
              disabled={!state.services.packageId}
              className="h-8 rounded-full px-3 text-xs text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            >
              {t("steps.packages.clearPackage")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetCustom}
              disabled={!showCustomSetup}
              className="h-8 rounded-full px-3 text-xs text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            >
              {t("steps.packages.resetCustom")}
            </Button>
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
            </div>
          </div>

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
              <ServiceInventorySelector
                services={inventoryServices}
                selected={selectedQuantities}
                labels={inventoryLabels}
                onAdd={handleAddService}
                onIncrease={handleIncreaseService}
                onDecrease={handleDecreaseService}
                onSetQuantity={handleSetServiceQuantity}
                onRemove={handleRemoveService}
                isLoading={servicesLoading}
                error={servicesError ? t("steps.packages.servicesError") : null}
                onRetry={servicesError ? () => servicesQuery.refetch() : undefined}
                renderSelectedActions={({ service }) => {
                  const lineItem = selectedItemsByServiceId.get(service.id);
                  if (!lineItem) return null;
                  const isPricingOpen = openPricingIds.has(lineItem.id);
                  const isVatOpen = openVatIds.has(lineItem.id);
                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="link"
                        size="sm"
                        className="px-0 text-emerald-600"
                        onClick={() => handlePricingButtonClick(lineItem)}
                      >
                        {isPricingOpen
                          ? t("steps.packages.actions.resetPricing")
                          : t("steps.packages.actions.editPricing")}
                      </Button>
                    </div>
                  );
                }}
                renderSelectedContent={({ service }) => {
                  const lineItem = selectedItemsByServiceId.get(service.id);
                  if (!lineItem) return null;
                  const isPricingOpen = openPricingIds.has(lineItem.id);
                  if (!isPricingOpen) {
                    return null;
                  }
                  const serviceMeta = serviceMap.get(lineItem.serviceId ?? service.id);
                  const isVatOpen = openVatIds.has(lineItem.id);
                  const vatModeDefault: VatModeOption =
                    lineItem.vatMode === "inclusive" || lineItem.vatMode === "exclusive"
                      ? lineItem.vatMode
                      : serviceMeta?.vatMode === "inclusive"
                      ? "inclusive"
                      : "exclusive";
                  const vatRateValue =
                    typeof lineItem.vatRate === "number" && Number.isFinite(lineItem.vatRate)
                      ? String(lineItem.vatRate)
                      : serviceMeta?.vatRate != null
                      ? String(serviceMeta.vatRate)
                      : "";

                  return (
                    <div className="animate-in fade-in slide-in-from-top-2 space-y-3 rounded-xl border border-emerald-100 bg-white/90 p-4 shadow-sm transition-all duration-200">
                      <div className="grid gap-3 sm:grid-cols-[repeat(2,minmax(0,200px))]">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t("steps.packages.list.unitCost")}
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={lineItem.unitCost ?? ""}
                            onChange={(event) =>
                              updateItem(lineItem.id, {
                                unitCost: event.target.value === "" ? null : Number(event.target.value),
                              })
                            }
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t("steps.packages.list.unitPrice")}
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={lineItem.unitPrice ?? ""}
                            onChange={(event) =>
                              updateItem(lineItem.id, {
                                unitPrice: event.target.value === "" ? null : Number(event.target.value),
                              })
                            }
                            className="h-9"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <Button
                          variant="link"
                          size="sm"
                          className="w-fit px-0 text-emerald-600"
                          onClick={() => handleVatButtonClick(lineItem)}
                        >
                          {isVatOpen
                            ? t("steps.packages.actions.resetVat")
                            : t("steps.packages.actions.editVat")}
                        </Button>
                        {isVatOpen ? (
                          <div className="animate-in fade-in slide-in-from-top-2 grid gap-3 sm:max-w-[420px] sm:grid-cols-2 transition-all duration-200">
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {t("steps.packages.vatControls.modeLabel")}
                              </Label>
                              <Select
                                value={vatModeDefault}
                                onValueChange={(value) => handleVatModeChange(lineItem.id, value as VatModeOption)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder={t("steps.packages.vatControls.modeLabel")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {vatModeOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {t("steps.packages.vatControls.rateLabel")}
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                max={99.99}
                                step="0.01"
                                value={vatRateValue}
                                onChange={(event) => handleVatRateChange(lineItem.id, event.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                }}
              />
            </div>

            {hasServices ? (
              <ServicesTableCard
                rows={summaryTableRows}
                labels={serviceTableLabels}
                emptyMessage={t("steps.packages.summary.empty")}
                formatCurrency={formatCurrency}
              />
            ) : null}
            <div className={cn("flex", hasServices ? "justify-end" : "justify-stretch")}>
              <SummaryTotalsCard
                className={cn(
                  "bg-white/95",
                  hasServices ? "sm:w-auto sm:min-w-[320px]" : "w-full max-w-none"
                )}
              >
                {hasServices ? (
                  <>
                    <SummaryTotalsSection>
                      <SummaryTotalRow
                        label={t("steps.packages.summary.servicesCount")}
                        value={String(existingItems.length)}
                      />
                      <SummaryTotalRow
                        label={
                          vatBreakdown.length === 1
                            ? t("steps.packages.summary.servicesVatWithRate", {
                                rate: formatPercent(vatBreakdown[0].rate),
                              })
                            : t("steps.packages.summary.servicesVat")
                        }
                        value={formatCurrency(totals.vat)}
                      />
                      <SummaryTotalRow
                        label={t("steps.packages.summary.servicesCost")}
                        value={formatCurrency(totals.cost)}
                      />
                      <SummaryTotalRow
                        label={t("steps.packages.summary.servicesPrice")}
                        value={formatCurrency(totals.net)}
                      />
                    </SummaryTotalsSection>
                    <SummaryTotalsDivider />
                    <SummaryTotalsSection className="pt-3">
                      <SummaryTotalRow
                        label={t("steps.packages.summary.servicesGross")}
                        value={formatCurrency(totals.total)}
                        emphasizeLabel
                      />
                      <SummaryTotalRow
                        label={t("steps.packages.summary.servicesMargin")}
                        value={formatCurrency(servicesMargin)}
                        tone={servicesMargin >= 0 ? "positive" : "negative"}
                        emphasizeLabel
                      />
                    </SummaryTotalsSection>
                    <SummaryTotalsDivider />
                  </>
                ) : null}
                <SummaryTotalsSection className={cn("space-y-3", hasServices ? "pt-3" : undefined)}>
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
                <SummaryTotalsSection className={cn("space-y-3", hasServices ? "pt-3" : undefined)}>
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
                    helper={
                      basePriceValue > 0
                        ? t("steps.packages.summary.clientTotalHelperInclusive")
                        : undefined
                    }
                  />
                </SummaryTotalsSection>
                <SummaryTotalsDivider />
                <SummaryTotalsSection className={cn("space-y-3", hasServices ? "pt-3" : undefined)}>
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

      {pendingPricingLineItem ? (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setPendingPricingResetId(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("steps.packages.actions.resetPricingConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("steps.packages.actions.resetPricingConfirm")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingPricingResetId(null)}>
                {t("steps.packages.actions.resetPricingConfirmCancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmPricingReset}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("steps.packages.actions.resetPricingConfirmConfirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {pendingVatLineItem ? (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setPendingVatResetId(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("steps.packages.actions.resetVatConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("steps.packages.actions.resetVatConfirm")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingVatResetId(null)}>
                {t("steps.packages.actions.resetVatConfirmCancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmVatReset}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("steps.packages.actions.resetVatConfirmConfirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
};
