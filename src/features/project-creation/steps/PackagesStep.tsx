import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ServiceInventorySelector,
  type ServiceInventoryItem,
  type ServiceInventoryType,
} from "@/components/ServiceInventorySelector";
import { ServicesTableCard, type ServicesTableRow } from "@/components/services";
import { usePackages, useProjectTypes, useServices } from "@/hooks/useOrganizationData";
import { useProjectCreationContext } from "../hooks/useProjectCreationContext";
import { useProjectCreationActions } from "../hooks/useProjectCreationActions";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles, Plus, Minus, Trash2 } from "lucide-react";
import type { ProjectCreationDetails, ProjectServiceLineItem } from "../types";
import { calculateLineItemPricing } from "@/features/package-creation/utils/lineItemPricing";
import { DEFAULT_SERVICE_UNIT, SERVICE_UNIT_OPTIONS, normalizeServiceUnit } from "@/lib/services/units";
import type { VatMode } from "@/lib/accounting/vat";
import { IconActionButton } from "@/components/ui/icon-action-button";
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
  ServiceVatOverridesSection,
  type ServiceVatOverridesItem,
  type ServiceVatOverridesMeta,
  type VatModeOption,
} from "@/features/services/components/ServiceVatOverridesSection";

interface PackageRecord {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  applicable_types: string[];
  default_add_ons: string[];
  is_active?: boolean;
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

export const PackagesStep = () => {
  const { t } = useTranslation("projectCreation");
  const { state } = useProjectCreationContext();
  const { updateServices, updateDetails } = useProjectCreationActions();

  const packagesQuery = usePackages();
  const servicesQuery = useServices();
  const projectTypesQuery = useProjectTypes();

  const packages = (packagesQuery.data as PackageRecord[]) ?? [];
  const services = (servicesQuery.data as ServiceRecord[]) ?? [];
  const projectTypes = projectTypesQuery.data ?? [];
  const actionsRef = useRef<HTMLDivElement | null>(null);

  const selectedProjectType = useMemo(
    () => projectTypes.find((type: any) => type.id === state.details.projectTypeId),
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
      services.map((service) => ({
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

  const hasVatOverrides = useMemo(() => {
    return existingItems.some((item) => {
      const service = serviceMap.get(item.serviceId);
      const defaultRate = service?.vatRate ?? 0;
      const defaultMode = service?.vatMode ?? "exclusive";
      const rate = typeof item.vatRate === "number" ? item.vatRate : defaultRate;
      const mode = (item.vatMode ?? defaultMode) as VatMode;
      const rateDiff = Math.abs(rate - defaultRate) > 0.001;
      const modeDiff = mode !== defaultMode;
      return rateDiff || modeDiff;
    });
  }, [existingItems, serviceMap]);

  const [showVatControls, setShowVatControls] = useState(hasVatOverrides);
  const [showVatResetPrompt, setShowVatResetPrompt] = useState(false);

  useEffect(() => {
    if (hasVatOverrides) {
      setShowVatControls(true);
    }
  }, [hasVatOverrides]);

  const handleToggleVatControls = () => {
    if (showVatControls) {
      if (hasVatOverrides) {
        setShowVatResetPrompt(true);
        return;
      }
      setShowVatControls(false);
      return;
    }
    setShowVatControls(true);
  };

  const resetVatOverrides = useCallback(() => {
    const resetItems = existingItems.map((item) => {
      const service = item.serviceId ? serviceMap.get(item.serviceId) : null;
      const fallbackRate =
        typeof service?.vatRate === "number" && Number.isFinite(service.vatRate)
          ? service.vatRate
          : null;
      const fallbackMode: VatModeOption =
        service?.vatMode === "inclusive" || service?.vatMode === "exclusive"
          ? service.vatMode
          : "exclusive";

      return {
        ...item,
        vatRate: fallbackRate,
        vatMode: fallbackMode,
      };
    });

    setItems(resetItems);
    setShowVatControls(false);
    setShowVatResetPrompt(false);
  }, [existingItems, serviceMap, setItems]);

  const updateItem = (itemId: string, updates: Partial<ProjectServiceLineItem>) => {
    const nextItems = existingItems.map((item) =>
      item.id === itemId || item.serviceId === itemId ? { ...item, ...updates } : item
    );
    setItems(nextItems);
  };

  const removeItem = (itemId: string) => {
    setItems(existingItems.filter((item) => item.id !== itemId && item.serviceId !== itemId));
  };

  const parseQuantityInput = (value: string) => {
    const numeric = value.replace(/[^0-9]/g, "");
    const parsed = parseInt(numeric, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };

  const handleSetQuantity = (itemId: string, value: string) => {
    updateItem(itemId, { quantity: parseQuantityInput(value) });
  };

  const adjustQuantity = (itemId: string, delta: number) => {
    const target = existingItems.find((item) => item.serviceId === itemId || item.id === itemId);
    const next = Math.max(1, (target?.quantity ?? 1) + delta);
    updateItem(itemId, { quantity: next });
  };

  const buildLineItemFromService = (service: ServiceWithMetadata): ProjectServiceLineItem => ({
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
  });

  const handleAddService = (serviceId: string) => {
    const service = serviceMap.get(serviceId);
    if (!service) return;

    const filtered = existingItems.filter((item) => item.serviceId !== serviceId);
    const nextItem = buildLineItemFromService(service);
    setItems([...filtered, nextItem]);
    updateServices({ showCustomSetup: true });
  };

  const handleIncreaseService = (serviceId: string) => adjustQuantity(serviceId, 1);
  const handleDecreaseService = (serviceId: string) => adjustQuantity(serviceId, -1);

  const handleSetServiceQuantity = (serviceId: string, quantity: number) => {
    updateItem(serviceId, { quantity: Math.max(1, quantity) });
  };

  const handleRemoveService = (serviceId: string) => {
    removeItem(serviceId);
  };

  const handleVatModeChange = (itemId: string, mode: VatModeOption) => {
    updateItem(itemId, { vatMode: mode });
  };

  const handleVatRateChange = (itemId: string, value: string) => {
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
  };

  const handleUnitChange = (itemId: string, unit: string) => {
    updateItem(itemId, { unit: normalizeServiceUnit(unit) });
  };

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

  const vatOverrideItems = useMemo<ServiceVatOverridesItem[]>(() => {
    return existingItems.map((item) => {
      const service = item.serviceId ? serviceMap.get(item.serviceId) : null;
      const vatRateValue =
        typeof item.vatRate === "number" && Number.isFinite(item.vatRate)
          ? String(item.vatRate)
          : "";
      const fallbackMode =
        service?.vatMode === "inclusive" || service?.vatMode === "exclusive"
          ? service.vatMode
          : "exclusive";
      const vatModeValue: VatModeOption =
        item.vatMode === "inclusive" || item.vatMode === "exclusive"
          ? item.vatMode
          : fallbackMode;
      const meta: ServiceVatOverridesMeta[] = [];

      const vendorLabel = item.vendorName
        ? t("steps.packages.vatControls.vendorLabel", { vendor: item.vendorName })
        : service?.vendor_name
        ? t("steps.packages.vatControls.vendorLabel", { vendor: service.vendor_name })
        : null;
      if (vendorLabel) {
        meta.push({ label: vendorLabel });
      }

      const serviceTypeKey = service?.serviceType ?? "unknown";
      const serviceTypeLabel = t(
        `steps.packages.inventory.types.${serviceTypeKey}.title`,
        {
          defaultValue: t("steps.packages.inventory.types.unknown.title"),
        }
      );
      meta.push({
        label: t("steps.packages.vatControls.typeLabel", { type: serviceTypeLabel }),
      });

      if (item.type === "custom") {
        meta.push({
          label: t("steps.packages.summary.customTag", { defaultValue: "Custom item" }),
          variant: "badge",
        });
      }

      return {
        id: item.id,
        name: item.name,
        vatRate: vatRateValue,
        vatMode: vatModeValue,
        meta,
      };
    });
  }, [existingItems, serviceMap, t]);

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
      const vendorLabel = service?.vendor_name ?? item.vendorName ?? t("steps.packages.summary.customVendorFallback", { defaultValue: "—" });
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
  }, [existingItems, getUnitLabel, serviceMap, t]);

  useEffect(() => {
    if (!actionsRef.current) return;
    if (!state.services.packageId && !showCustomSetup) return;
    actionsRef.current.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  }, [state.services.packageId, showCustomSetup]);

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
    });
  };

  const packagesLoading = packagesQuery.isLoading;
  const servicesLoading = servicesQuery.isLoading;
  const packagesError = packagesQuery.error as Error | null;
  const servicesError = servicesQuery.error as Error | null;

  return (
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
        <div
          key={`custom-${state.services.packageId}-${existingItems.map((item) => item.id).join(",")}`}
          className="animate-in fade-in slide-in-from-top-2 space-y-6 rounded-2xl border border-border/80 bg-white/80 p-6 shadow-sm transition-all duration-300 ease-out"
        >
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
              />
            </div>

            {existingItems.length > 0 ? (
              <>
                <div className="space-y-3 rounded-2xl border border-border/70 bg-slate-50/60 p-5 shadow-sm">
                  {existingItems.map((item) => {
                    const service = item.serviceId ? serviceMap.get(item.serviceId) : null;
                    const quantityValue = Math.max(1, item.quantity ?? 1);
                    const serviceTypeLabel = service
                      ? t(`steps.packages.inventory.types.${service.serviceType ?? "unknown"}.title`)
                      : t("steps.packages.inventory.types.unknown.title");
                    const vendorLabel = item.vendorName
                      ? t("steps.packages.vatControls.vendorLabel", { vendor: item.vendorName })
                      : service?.vendor_name
                      ? t("steps.packages.vatControls.vendorLabel", { vendor: service.vendor_name })
                      : null;
                    const typeLabel = t("steps.packages.vatControls.typeLabel", { type: serviceTypeLabel });
                    const unitValue = normalizeServiceUnit(item.unit ?? service?.unit ?? DEFAULT_SERVICE_UNIT);
                    const targetId = item.serviceId ?? item.id;

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border/60 bg-white/95 p-4 shadow-sm transition-shadow hover:shadow-sm"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {vendorLabel ? <span>{vendorLabel}</span> : null}
                              <span>{typeLabel}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveService(targetId)}
                            className="h-8 gap-1 rounded-full text-xs text-slate-500 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            {t("steps.packages.list.remove", { defaultValue: "Remove" })}
                          </Button>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,220px)_repeat(3,minmax(0,200px))]">
                          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-white px-3 py-2">
                            <IconActionButton
                              icon={Minus}
                              label={t("common:actions.decrease", { defaultValue: "Decrease" })}
                              onClick={() => handleDecreaseService(targetId)}
                              size="sm"
                            />
                            <Input
                              value={quantityValue}
                              onChange={(event) => handleSetQuantity(targetId, event.target.value)}
                              inputMode="numeric"
                              className="h-9 w-16 text-center"
                            />
                            <IconActionButton
                              icon={Plus}
                              label={t("common:actions.increase", { defaultValue: "Increase" })}
                              onClick={() => handleIncreaseService(targetId)}
                              size="sm"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("steps.packages.list.unitCost")}
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.unitCost ?? ""}
                              onChange={(event) =>
                                updateItem(item.id, {
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
                              value={item.unitPrice ?? ""}
                              onChange={(event) =>
                                updateItem(item.id, {
                                  unitPrice: event.target.value === "" ? null : Number(event.target.value),
                                })
                              }
                              className="h-9"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("steps.packages.units.label")}
                            </Label>
                            <Select value={unitValue} onValueChange={(value) => handleUnitChange(item.id, value)}>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder={t("steps.packages.units.placeholder")} />
                              </SelectTrigger>
                              <SelectContent>
                                {SERVICE_UNIT_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {t(option.translationKey)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <ServiceVatOverridesSection
                  title={t("steps.packages.vatControls.title")}
                  description={t("steps.packages.vatControls.description")}
                  tooltipLabel={t("steps.packages.vatControls.toggleLabel")}
                  tooltipContent={t("steps.packages.vatControls.toggleDescription")}
                  toggleButtonLabel={
                    showVatControls
                      ? t("steps.packages.vatControls.buttonClose")
                      : t("steps.packages.vatControls.buttonOpen")
                  }
                  isOpen={showVatControls}
                  onToggle={handleToggleVatControls}
                  items={vatOverrideItems}
                  rateLabel={t("steps.packages.vatControls.rateLabel")}
                  modeLabel={t("steps.packages.vatControls.modeLabel")}
                  modeOptions={vatModeOptions}
                  onRateChange={handleVatRateChange}
                  onModeChange={handleVatModeChange}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("steps.packages.servicesEmpty")}
              </p>
            )}

            <ServicesTableCard
              rows={summaryTableRows}
              totals={{
                cost: totals.cost,
                price: totals.net,
                vat: totals.vat,
                total: totals.total,
                margin: servicesMargin,
              }}
              labels={serviceTableLabels}
              emptyMessage={t("steps.packages.summary.empty")}
              formatCurrency={(value) =>
                new Intl.NumberFormat("tr-TR", {
                  style: "currency",
                  currency: "TRY",
                  minimumFractionDigits: 0,
                }).format(value)
              }
            />
          </div>
        </div>
      )}

      <AlertDialog open={showVatResetPrompt} onOpenChange={setShowVatResetPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("steps.packages.vatControls.resetConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("steps.packages.vatControls.resetConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowVatResetPrompt(false)}>
              {t("steps.packages.vatControls.resetConfirmCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={resetVatOverrides}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("steps.packages.vatControls.resetConfirmConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
