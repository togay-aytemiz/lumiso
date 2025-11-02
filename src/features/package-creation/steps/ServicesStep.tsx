import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Trash2, Users, Package as PackageIcon, Layers } from "lucide-react";
import {
  ServiceInventorySelector,
  type ServiceInventoryItem,
  type ServiceInventoryType,
} from "@/components/ServiceInventorySelector";
import { ServicesTableCard, type ServicesTableRow } from "@/components/ServicesTableCard";
import { useServices, useOrganizationTaxProfile } from "@/hooks/useOrganizationData";
import { usePackageCreationContext } from "../hooks/usePackageCreationContext";
import { usePackageCreationActions } from "../hooks/usePackageCreationActions";
import type { PackageCreationLineItem, PackageVatMode } from "../types";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { cn } from "@/lib/utils";
import { calculateLineItemPricing } from "../utils/lineItemPricing";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

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
  vat_rate?: number | null;
  price_includes_vat?: boolean | null;
}

interface ServiceWithMetadata extends ServiceRecord {
  unitCost: number;
  unitPrice: number;
  serviceType: ServiceInventoryType;
  isActive: boolean;
  vatRate: number | null;
  vatMode: PackageVatMode;
  priceIncludesVat: boolean;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
  }).format(amount);

export const ServicesStep = () => {
  const { t } = useTranslation("packageCreation");
  const { state } = usePackageCreationContext();
  const { updateServices } = usePackageCreationActions();

  const servicesQuery = useServices();
  const taxProfileQuery = useOrganizationTaxProfile();
  const taxProfile = taxProfileQuery.data;
  const defaultVatRate = useMemo(() => {
    if (typeof taxProfile?.defaultVatRate === "number" && Number.isFinite(taxProfile.defaultVatRate)) {
      return Number(taxProfile.defaultVatRate);
    }
    return 0;
  }, [taxProfile]);
  const defaultVatMode: PackageVatMode = useMemo(
    () => (taxProfile?.defaultVatMode === "inclusive" ? "inclusive" : "exclusive"),
    [taxProfile]
  );
  const services = useMemo(
    () => ((servicesQuery.data as ServiceRecord[] | undefined) ?? []),
    [servicesQuery.data]
  );

  const [customName, setCustomName] = useState("");
  const [customCost, setCustomCost] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const hasVatOverrides = useMemo(() => {
    return state.services.items.some((item) => {
      const rate =
        typeof item.vatRate === "number" && Number.isFinite(item.vatRate)
          ? item.vatRate
          : null;
      const mode = item.vatMode ?? null;
      const rateDiff = rate != null && Math.abs(rate - defaultVatRate) > 0.001;
      const modeDiff = mode != null && mode !== defaultVatMode;
      return rateDiff || modeDiff;
    });
  }, [state.services.items, defaultVatRate, defaultVatMode]);
  const [showVatControls, setShowVatControls] = useState(hasVatOverrides);

  useEffect(() => {
    if (hasVatOverrides) {
      setShowVatControls(true);
    }
  }, [hasVatOverrides]);

  const serviceMap = useMemo<Map<string, ServiceWithMetadata>>(
    () =>
      new Map(
        services.map((service) => {
          const vatRate =
            typeof service.vat_rate === "number" && Number.isFinite(service.vat_rate)
              ? Number(service.vat_rate)
              : null;
          const vatMode: PackageVatMode = service.price_includes_vat ? "inclusive" : "exclusive";
          return [
            service.id,
            {
              ...service,
              unitCost: service.cost_price ?? 0,
              unitPrice: service.selling_price ?? service.price ?? 0,
              serviceType: (service.service_type ?? "unknown") as ServiceInventoryType,
              isActive: service.is_active !== false,
              vatRate,
              vatMode,
              priceIncludesVat: service.price_includes_vat ?? false,
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
        isActive: service.is_active !== false,
        vatRate:
          typeof service.vat_rate === "number" && Number.isFinite(service.vat_rate)
            ? Number(service.vat_rate)
            : null,
        priceIncludesVat: service.price_includes_vat ?? false,
      })),
    [services]
  );

  const existingItems = state.services.items.filter((item) => item.type === "existing");
  const customItems = state.services.items.filter((item) => item.type === "custom");

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

  const selectionByType = useMemo(() => {
    const counts: Record<ServiceInventoryType, number> = {
      coverage: 0,
      deliverable: 0,
      unknown: 0,
    };

    existingItems.forEach((item) => {
      if (!item.serviceId) return;
      const service = serviceMap.get(item.serviceId);
      const type = service?.serviceType ?? "unknown";
      counts[type] += 1;
    });

    return counts;
  }, [existingItems, serviceMap]);

  const totals = useMemo(() => {
    return state.services.items.reduce(
      (acc, item) => {
        const quantity = Math.max(1, item.quantity ?? 1);
        const unitCost = Number(item.unitCost ?? 0);
        const pricing = calculateLineItemPricing(item);
        acc.cost += unitCost * quantity;
        acc.price += pricing.net;
        acc.vat += pricing.vat;
        acc.total += pricing.gross;
        return acc;
      },
      { cost: 0, price: 0, vat: 0, total: 0 }
    );
  }, [state.services.items]);

  const margin = totals.price - totals.cost;

  const parseQuantityInput = (value: string) => {
    const numeric = value.replace(/[^0-9]/g, "");
    const parsed = parseInt(numeric, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };

  const handleAddExistingService = (serviceId: string) => {
    const service = serviceMap.get(serviceId);
    if (!service) return;

    const vatRate =
      typeof service.vatRate === "number" && Number.isFinite(service.vatRate)
        ? Number(service.vatRate)
        : defaultVatRate;
    const vatMode: PackageVatMode =
      service.vatMode ?? (service.priceIncludesVat ? "inclusive" : defaultVatMode);

    const filteredExisting = existingItems.filter((item) => item.serviceId !== serviceId);
    const nextItems: PackageCreationLineItem[] = [
      ...filteredExisting,
      {
        id: serviceId,
        type: "existing",
        serviceId,
        name: service.name,
        quantity: 1,
        unitCost: service.unitCost,
        unitPrice: service.unitPrice,
        vendorName: service.vendor_name ?? null,
        source: "catalog",
        vatRate,
        vatMode,
      },
      ...customItems,
    ];

    updateServices({
      items: nextItems,
      showQuickAdd: state.services.showQuickAdd,
    });
  };

  const handleIncreaseExistingService = (serviceId: string) => {
    const nextExisting = existingItems.map((item) => {
      if (item.serviceId !== serviceId) return item;
      const current = Math.max(1, item.quantity ?? 1);
      return { ...item, quantity: current + 1 };
    });

    updateServices({
      items: [...nextExisting, ...customItems],
      showQuickAdd: state.services.showQuickAdd,
    });
  };

  const handleDecreaseExistingService = (serviceId: string) => {
    const nextExisting = existingItems.map((item) => {
      if (item.serviceId !== serviceId) return item;
      const current = Math.max(1, item.quantity ?? 1);
      return { ...item, quantity: Math.max(1, current - 1) };
    });

    updateServices({
      items: [...nextExisting, ...customItems],
      showQuickAdd: state.services.showQuickAdd,
    });
  };

  const handleSetExistingServiceQuantity = (serviceId: string, quantity: number) => {
    const nextExisting = existingItems.map((item) => {
      if (item.serviceId !== serviceId) return item;
      return { ...item, quantity: Math.max(1, quantity) };
    });

    updateServices({
      items: [...nextExisting, ...customItems],
      showQuickAdd: state.services.showQuickAdd,
    });
  };

  const handleRemoveExistingService = (serviceId: string) => {
    const nextExisting = existingItems.filter((item) => item.serviceId !== serviceId);
    updateServices({
      items: [...nextExisting, ...customItems],
      showQuickAdd: state.services.showQuickAdd,
    });
  };

  const inventoryLabels = useMemo(
    () => ({
      typeMeta: {
        coverage: {
          title: t("steps.services.inventory.types.coverage.title", { defaultValue: "Crew services" }),
          subtitle: t("steps.services.inventory.types.coverage.subtitle", {
            defaultValue: "People-based coverage like photographers or videographers",
          }),
          icon: Users,
          iconBackgroundClassName: "bg-emerald-50",
          iconClassName: "text-emerald-600",
        },
        deliverable: {
          title: t("steps.services.inventory.types.deliverable.title", { defaultValue: "Deliverables" }),
          subtitle: t("steps.services.inventory.types.deliverable.subtitle", {
            defaultValue: "Albums, prints and other client handoffs",
          }),
          icon: PackageIcon,
          iconBackgroundClassName: "bg-emerald-50",
          iconClassName: "text-emerald-600",
        },
        unknown: {
          title: t("steps.services.inventory.types.unknown.title", { defaultValue: "Other services" }),
          subtitle: t("steps.services.inventory.types.unknown.subtitle", {
            defaultValue: "Items without a service type yet",
          }),
          icon: Layers,
          iconBackgroundClassName: "bg-emerald-50",
          iconClassName: "text-emerald-600",
        },
      },
      add: t("steps.services.inventory.add", { defaultValue: "Add" }),
      decrease: t("common:actions.decrease", { defaultValue: "Decrease" }),
      increase: t("common:actions.increase", { defaultValue: "Increase" }),
      remove: t("steps.services.list.remove", { defaultValue: "Remove" }),
      vendor: t("steps.services.list.vendor", { defaultValue: "Vendor" }),
      unitCost: t("steps.services.list.unitCost", { defaultValue: "Unit cost" }),
      unitPrice: t("steps.services.list.unitPrice", { defaultValue: "Unit price" }),
      uncategorized: t("steps.services.inventory.uncategorized", { defaultValue: "Other" }),
      inactive: t("steps.services.inventory.inactive", { defaultValue: "Inactive" }),
      empty: t("steps.services.inventory.empty", {
        defaultValue: "No services in your catalog yet. Create services to add them here.",
      }),
      quantity: t("steps.services.list.quantity", { defaultValue: "Quantity" }),
      retry: t("common:actions.retry", { defaultValue: "Retry" }),
    }),
    [t]
  );

  const totalSelected = existingItems.length + customItems.length;

  const summaryTypeRows = [
    {
      key: "coverage" as const,
      label: inventoryLabels.typeMeta.coverage.title,
      count: selectionByType.coverage,
    },
    {
      key: "deliverable" as const,
      label: inventoryLabels.typeMeta.deliverable.title,
      count: selectionByType.deliverable,
    },
    {
      key: "unknown" as const,
      label: inventoryLabels.typeMeta.unknown.title,
      count: selectionByType.unknown,
    },
  ].filter((row) => row.count > 0);

  const serviceTableLabels = useMemo(
    () => ({
      columns: {
        name: t("steps.services.summary.table.name", { defaultValue: "Service" }),
        vendor: t("summaryView.services.columns.vendor"),
        quantity: t("steps.services.summary.table.quantity", { defaultValue: "Qty" }),
        unitPrice: t("summaryView.services.columns.unitPrice"),
        lineTotal: t("summaryView.services.columns.lineTotal"),
      },
      totals: {
        cost: t("summaryView.services.totals.cost", { defaultValue: "Cost total" }),
        price: t("summaryView.services.totals.price", { defaultValue: "Price total" }),
        vat: t("summaryView.services.totals.vat", { defaultValue: "VAT total" }),
        total: t("summaryView.services.totals.total", { defaultValue: "Total" }),
        margin: t("summaryView.services.totals.margin", { defaultValue: "Margin" }),
      },
      customTag: t("summaryView.services.customTag"),
      customVendorFallback: t("summaryView.services.customVendorFallback"),
    }),
    [t]
  );

  const summaryTableRows = useMemo<ServicesTableRow[]>(() => {
    return state.services.items.map((item) => {
      const quantity = Math.max(1, item.quantity ?? 1);
      const unitPriceValue =
        typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice) ? item.unitPrice : null;
      const pricing = calculateLineItemPricing(item);
      const service =
        item.type === "existing" && item.serviceId ? serviceMap.get(item.serviceId) : null;

      const vendor =
        service?.vendor_name ??
        // @ts-expect-error legacy camelCase vendor
        service?.vendorName ??
        item.vendorName ??
        null;

      const displayName = item.name ?? service?.name ?? item.serviceId ?? "—";

      return {
        id: item.id,
        name: displayName,
        vendor,
        quantity,
        unitPrice: unitPriceValue,
        lineTotal: Math.round(pricing.gross * 100) / 100,
        isCustom: item.type === "custom",
      };
    });
  }, [serviceMap, state.services.items]);

  const updateItem = (itemId: string, updates: Partial<PackageCreationLineItem>) => {
    const nextItems = state.services.items.map((item) =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    updateServices({ items: nextItems });
  };

  const handleVatModeChange = (itemId: string, mode: PackageVatMode) => {
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

  const removeItem = (itemId: string) => {
    updateServices({
      items: state.services.items.filter((item) => item.id !== itemId),
    });
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    updateItem(itemId, { quantity: parseQuantityInput(value) });
  };

  const adjustQuantity = (itemId: string, delta: number) => {
    const target = state.services.items.find((item) => item.id === itemId);
    const next = Math.max(1, (target?.quantity ?? 1) + delta);
    updateItem(itemId, { quantity: next });
  };

  const toggleQuickAdd = () => {
    updateServices({ showQuickAdd: !state.services.showQuickAdd });
    setCustomError(null);
    setCustomName("");
    setCustomCost("");
    setCustomPrice("");
  };

  const handleAddCustomService = () => {
    setCustomError(null);
    const trimmedName = customName.trim();
    const parsedPrice = Number(customPrice);
    const parsedCost = customCost.trim() === "" ? 0 : Number(customCost);

    if (!trimmedName) {
      setCustomError(t("steps.services.custom.errors.name", { defaultValue: "Name is required." }));
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setCustomError(t("steps.services.custom.errors.price", { defaultValue: "Enter a valid price." }));
      return;
    }

    if (customCost.trim() !== "" && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
      setCustomError(t("steps.services.custom.errors.cost", { defaultValue: "Enter a valid cost." }));
      return;
    }

    const newItem: PackageCreationLineItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "custom",
      name: trimmedName,
      quantity: 1,
      unitCost: Number.isFinite(parsedCost) ? parsedCost : 0,
      unitPrice: parsedPrice,
      vendorName: null,
      source: "adhoc",
      vatRate: defaultVatRate,
      vatMode: defaultVatMode,
    };

    updateServices({
      items: [...state.services.items, newItem],
      showQuickAdd: true,
    });

    setCustomName("");
    setCustomCost("");
    setCustomPrice("");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {t("steps.services.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("steps.services.description")}
        </p>
      </div>

      <ServiceInventorySelector
        services={inventoryServices}
        selected={selectedQuantities}
        labels={inventoryLabels}
        onAdd={handleAddExistingService}
        onIncrease={handleIncreaseExistingService}
        onDecrease={handleDecreaseExistingService}
        onSetQuantity={handleSetExistingServiceQuantity}
        onRemove={handleRemoveExistingService}
        isLoading={servicesQuery.isLoading}
        error={servicesQuery.error ? t("steps.services.picker.error") : null}
        onRetry={servicesQuery.error ? () => servicesQuery.refetch() : undefined}
      />
      {state.services.items.length > 0 ? (
        <div className="space-y-4 rounded-2xl border border-border/70 bg-white/80 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 max-w-xl">
              <h3 className="text-sm font-semibold text-slate-900">
                {t("steps.services.vatControls.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("steps.services.vatControls.description")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="package-vat-adjust-toggle"
                checked={showVatControls}
                onCheckedChange={setShowVatControls}
                aria-label={t("steps.services.vatControls.toggleLabel")}
              />
              <div className="space-y-1">
                <Label htmlFor="package-vat-adjust-toggle" className="text-sm font-medium text-slate-900">
                  {t("steps.services.vatControls.toggleLabel")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("steps.services.vatControls.toggleDescription")}
                </p>
              </div>
            </div>
          </div>
          {showVatControls ? (
            <div className="space-y-3">
              {state.services.items.map((item) => {
                const service = item.serviceId ? serviceMap.get(item.serviceId) : null;
                const vatModeValue: PackageVatMode = item.vatMode ?? defaultVatMode;
                const vatRateValue =
                  typeof item.vatRate === "number" && Number.isFinite(item.vatRate)
                    ? String(item.vatRate)
                    : "";
                const serviceTypeLabel = service
                  ? t(`steps.services.inventory.types.${service.serviceType ?? "unknown"}.title`)
                  : t("steps.services.inventory.types.unknown.title");
                const vendorLabel = item.vendorName
                  ? t("steps.services.vatControls.vendorLabel", { vendor: item.vendorName })
                  : service?.vendor_name
                  ? t("steps.services.vatControls.vendorLabel", { vendor: service.vendor_name })
                  : null;
                const typeLabel = t("steps.services.vatControls.typeLabel", { type: serviceTypeLabel });
                const vatRateInputId = `vat-rate-${item.id}`;

                return (
                  <div key={item.id} className="rounded-xl border border-border/60 bg-white/95 p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="min-w-[220px] space-y-1">
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {vendorLabel ? <span>{vendorLabel}</span> : null}
                          <span>{typeLabel}</span>
                          {item.type === "custom" ? (
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                              {t("summaryView.services.customTag")}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <Label
                            htmlFor={vatRateInputId}
                            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            {t("steps.services.vatControls.rateLabel")}
                          </Label>
                          <Input
                            id={vatRateInputId}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={99.99}
                            step="0.01"
                            value={vatRateValue}
                            onChange={(event) => handleVatRateChange(item.id, event.target.value)}
                            className="h-9 w-[96px] sm:w-[110px]"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t("steps.services.vatControls.modeLabel")}
                          </Label>
                          <Select
                            value={vatModeValue}
                            onValueChange={(value) => handleVatModeChange(item.id, value as PackageVatMode)}
                          >
                            <SelectTrigger className="h-9 w-[160px] sm:w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inclusive">{t("steps.services.vatControls.mode.inclusive")}</SelectItem>
                              <SelectItem value="exclusive">{t("steps.services.vatControls.mode.exclusive")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-4 rounded-2xl border border-border/70 bg-white/80 p-5 shadow-sm backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              {t("steps.services.custom.managerTitle", { defaultValue: "Custom services" })}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("steps.services.custom.managerDescription", {
                defaultValue: "Add one-off services that aren’t part of your catalog yet.",
              })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleQuickAdd}
            className="h-8 rounded-full px-3 text-xs"
          >
            {state.services.showQuickAdd
              ? t("steps.services.custom.cancel")
              : t("steps.services.custom.toggle")}
          </Button>
        </div>

        {state.services.showQuickAdd && (
          <div className="space-y-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4">
            <h4 className="text-sm font-semibold text-slate-900">
              {t("steps.services.custom.title")}
            </h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <Label htmlFor="custom-name">{t("steps.services.custom.nameLabel")}</Label>
                <Input
                  id="custom-name"
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  placeholder={t("steps.services.custom.namePlaceholder")}
                />
              </div>
              <div>
                <Label htmlFor="custom-cost">{t("steps.services.custom.costLabel")}</Label>
                <Input
                  id="custom-cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={customCost}
                  onChange={(event) => setCustomCost(event.target.value)}
                  placeholder={t("steps.services.custom.costPlaceholder")}
                />
              </div>
              <div>
                <Label htmlFor="custom-price">{t("steps.services.custom.priceLabel")}</Label>
                <Input
                  id="custom-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={customPrice}
                  onChange={(event) => setCustomPrice(event.target.value)}
                  placeholder={t("steps.services.custom.pricePlaceholder")}
                />
              </div>
            </div>
            {customError ? <p className="text-xs text-destructive">{customError}</p> : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={handleAddCustomService}>
                {t("steps.services.custom.add")}
              </Button>
              <Button size="sm" variant="outline" onClick={toggleQuickAdd}>
                {t("steps.services.custom.cancel")}
              </Button>
            </div>
          </div>
        )}

        {customItems.length > 0 ? (
          <div className="space-y-3">
            {customItems.map((item) => {
              const quantityValue = Math.max(1, item.quantity ?? 1);
              const showInlineDelete = quantityValue === 1;

              return (
                <div key={item.id} className="rounded-lg border bg-muted/10 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={`custom-name-${item.id}`} className="text-xs text-muted-foreground">
                        {t("steps.services.custom.nameLabel")}
                      </Label>
                      <Input
                        id={`custom-name-${item.id}`}
                        value={item.name}
                        onChange={(event) => updateItem(item.id, { name: event.target.value })}
                        className="h-10 w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                      <div className="space-y-2 sm:w-40 sm:flex-none">
                        <Label htmlFor={`custom-cost-${item.id}`} className="text-xs text-muted-foreground">
                          {t("steps.services.list.unitCost")}
                        </Label>
                        <Input
                          id={`custom-cost-${item.id}`}
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unitCost ?? ""}
                          onChange={(event) =>
                            updateItem(item.id, {
                              unitCost: event.target.value === "" ? null : Number(event.target.value),
                            })
                          }
                          className="h-10 w-full sm:w-40"
                        />
                      </div>
                      <div className="space-y-2 sm:w-40 sm:flex-none">
                        <Label htmlFor={`custom-price-${item.id}`} className="text-xs text-muted-foreground">
                          {t("steps.services.list.unitPrice")}
                        </Label>
                        <Input
                          id={`custom-price-${item.id}`}
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unitPrice ?? ""}
                          onChange={(event) =>
                            updateItem(item.id, {
                              unitPrice: event.target.value === "" ? null : Number(event.target.value),
                            })
                          }
                          className="h-10 w-full sm:w-40"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        {t("steps.services.list.quantity")}
                      </span>
                      <div className="flex items-center gap-1 rounded-full border px-1 py-1">
                        {showInlineDelete ? (
                          <IconActionButton
                            onClick={() => removeItem(item.id)}
                            aria-label={t("steps.services.list.remove")}
                            variant="danger"
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconActionButton>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => adjustQuantity(item.id, -1)}
                            aria-label={t("common:actions.decrease", { defaultValue: "Decrease" })}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        )}
                        <Input
                          id={`custom-quantity-${item.id}`}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={String(quantityValue)}
                          onChange={(event) => handleQuantityChange(item.id, event.target.value)}
                          className="h-8 w-14 border-0 bg-transparent text-center text-sm font-medium focus-visible:ring-0"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => adjustQuantity(item.id, 1)}
                          aria-label={t("common:actions.increase", { defaultValue: "Increase" })}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {!showInlineDelete ? (
                      <IconActionButton
                        onClick={() => removeItem(item.id)}
                        aria-label={t("steps.services.list.remove")}
                        variant="danger"
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconActionButton>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : !state.services.showQuickAdd ? (
          <p className="text-sm text-muted-foreground">
            {t("steps.services.custom.emptyState", { defaultValue: "No custom services yet." })}
          </p>
        ) : null}
      </div>

      <div className="space-y-4 rounded-2xl border border-border/70 bg-white/80 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">{t("steps.services.summary.title")}</h3>
            <Badge variant="secondary" className="rounded-full text-xs font-medium transition-colors duration-200">
              {t("steps.services.summary.selectedCount", { count: totalSelected })}
            </Badge>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("steps.services.summary.cost")}</span>
              <span className="font-medium text-slate-900">{formatCurrency(totals.cost)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("steps.services.summary.price")}</span>
              <span className="font-medium text-slate-900">{formatCurrency(totals.price)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {t("steps.services.summary.vat", { defaultValue: "VAT" })}
              </span>
              <span className="font-medium text-slate-900">{formatCurrency(totals.vat)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {t("steps.services.summary.gross", { defaultValue: "Total" })}
              </span>
              <span className="font-medium text-slate-900">{formatCurrency(totals.total)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("steps.services.summary.margin")}</span>
              <span className={cn("font-medium transition-colors duration-200", margin >= 0 ? "text-emerald-600" : "text-destructive")}>
                {formatCurrency(margin)}
              </span>
            </div>
          </div>
        </div>

        {summaryTypeRows.length > 0 ? (
          <div className="space-y-1.5 border-t border-border/60 pt-3 text-xs">
            <p className="font-medium uppercase tracking-wide text-muted-foreground">
              {t("steps.services.summary.typeBreakdown", { defaultValue: "By service type" })}
            </p>
            {summaryTypeRows.map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between text-slate-900 transition-colors duration-200"
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-semibold">{row.count}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("steps.services.summary.listHeading", { defaultValue: "Selected services" })}
        </p>
        <ServicesTableCard
          rows={summaryTableRows}
          totals={{ cost: totals.cost, price: totals.price, vat: totals.vat, total: totals.total, margin }}
          labels={serviceTableLabels}
          emptyMessage={t("steps.services.summary.empty")}
          formatCurrency={formatCurrency}
          className="bg-white/80 backdrop-blur"
        />
      </div>
    </div>
  );
};
