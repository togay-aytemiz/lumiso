import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Minus,
  Trash2,
  Users,
  Package as PackageIcon,
  Layers,
  Info,
} from "lucide-react";
import {
  ServiceInventorySelector,
  type ServiceInventoryItem,
  type ServiceInventoryType,
} from "@/components/ServiceInventorySelector";
import {
  ServicesTableCard,
  type ServicesTableRow,
} from "@/components/ServicesTableCard";
import {
  useServices,
  useOrganizationTaxProfile,
} from "@/hooks/useOrganizationData";
import { usePackageCreationContext } from "../hooks/usePackageCreationContext";
import { usePackageCreationActions } from "../hooks/usePackageCreationActions";
import type { PackageCreationLineItem, PackageVatMode } from "../types";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { cn } from "@/lib/utils";
import { calculateLineItemPricing } from "../utils/lineItemPricing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DEFAULT_SERVICE_UNIT,
  normalizeServiceUnit,
  type ServiceUnit,
} from "@/lib/services/units";
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
  default_unit?: string | null;
}

interface ServiceWithMetadata extends ServiceRecord {
  unitCost: number;
  unitPrice: number;
  serviceType: ServiceInventoryType;
  isActive: boolean;
  vatRate: number | null;
  vatMode: PackageVatMode;
  priceIncludesVat: boolean;
  unit: ServiceUnit;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
  }).format(amount);

export const ServicesStep = () => {
  const { t } = useTranslation("packageCreation");
  const { t: tForms } = useTranslation("forms");
  const { state } = usePackageCreationContext();
  const { updateServices } = usePackageCreationActions();

  const servicesQuery = useServices();
  const taxProfileQuery = useOrganizationTaxProfile();
  const taxProfile = taxProfileQuery.data;
  const defaultVatRate = useMemo(() => {
    if (
      typeof taxProfile?.defaultVatRate === "number" &&
      Number.isFinite(taxProfile.defaultVatRate)
    ) {
      return Number(taxProfile.defaultVatRate);
    }
    return 0;
  }, [taxProfile]);
  const defaultVatMode: PackageVatMode = useMemo(
    () =>
      taxProfile?.defaultVatMode === "inclusive" ? "inclusive" : "exclusive",
    [taxProfile]
  );
  const defaultVatRateString = useMemo(
    () =>
      Number.isFinite(defaultVatRate) && defaultVatRate !== null
        ? String(defaultVatRate)
        : "",
    [defaultVatRate]
  );
  const services = useMemo(
    () => (servicesQuery.data as ServiceRecord[] | undefined) ?? [],
    [servicesQuery.data]
  );

  const [customName, setCustomName] = useState("");
  const [customCost, setCustomCost] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [customVatRate, setCustomVatRate] = useState<string>(
    defaultVatRateString
  );
  const [customVatMode, setCustomVatMode] =
    useState<PackageVatMode>(defaultVatMode);
  const [customVatPanels, setCustomVatPanels] = useState<
    Record<string, boolean>
  >({});
  const [showQuickAddVatForm, setShowQuickAddVatForm] = useState(false);
  const [showQuickAddVatResetPrompt, setShowQuickAddVatResetPrompt] =
    useState(false);
  const [pendingCustomVatResetId, setPendingCustomVatResetId] = useState<
    string | null
  >(null);
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
  const [showVatControls, setShowVatControls] = useState(false);
  const [showVatResetPrompt, setShowVatResetPrompt] = useState(false);

  useEffect(() => {
    if (!state.services.showQuickAdd) {
      setCustomVatRate(defaultVatRateString);
      setCustomVatMode(defaultVatMode);
      setShowQuickAddVatForm(false);
      setShowQuickAddVatResetPrompt(false);
    }
  }, [
    defaultVatMode,
    defaultVatRateString,
    state.services.showQuickAdd,
  ]);

  const serviceMap = useMemo<Map<string, ServiceWithMetadata>>(() => {
    const entries = services
      .filter((service) => service.is_active !== false)
      .map((service) => {
        const vatRate =
          typeof service.vat_rate === "number" &&
          Number.isFinite(service.vat_rate)
            ? Number(service.vat_rate)
            : null;
        const vatMode: PackageVatMode = service.price_includes_vat
          ? "inclusive"
          : "exclusive";
        const unit = normalizeServiceUnit(service.default_unit);
        return [
          service.id,
          {
            ...service,
            unitCost: service.cost_price ?? 0,
            unitPrice: service.selling_price ?? service.price ?? 0,
            serviceType: (service.service_type ??
              "unknown") as ServiceInventoryType,
            isActive: true,
            vatRate,
            vatMode,
            priceIncludesVat: service.price_includes_vat ?? false,
            unit,
          },
        ] as const;
      });
    return new Map(entries);
  }, [services]);

  const inventoryServices = useMemo<ServiceInventoryItem[]>(
    () =>
      services
        .filter((service) => service.is_active !== false)
        .map((service) => ({
          id: service.id,
          name: service.name,
          category: service.category,
          serviceType: (service.service_type ??
            "unknown") as ServiceInventoryType,
          vendorName: service.vendor_name ?? null,
          unitCost: service.cost_price ?? null,
          unitPrice: service.selling_price ?? service.price ?? null,
          unit: normalizeServiceUnit(service.default_unit),
          defaultUnit: service.default_unit ?? null,
          isActive: true,
          vatRate:
            typeof service.vat_rate === "number" &&
            Number.isFinite(service.vat_rate)
              ? Number(service.vat_rate)
              : null,
          priceIncludesVat: service.price_includes_vat ?? false,
        })),
    [services]
  );

  const existingItems = state.services.items.filter(
    (item) => item.type === "existing"
  );
  const customItems = state.services.items.filter(
    (item) => item.type === "custom"
  );

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
    const vatMode: PackageVatMode = service.priceIncludesVat
      ? "inclusive"
      : "exclusive";
    const unit = service.unit ?? DEFAULT_SERVICE_UNIT;

    const filteredExisting = existingItems.filter(
      (item) => item.serviceId !== serviceId
    );
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
        unit,
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

  const handleSetExistingServiceQuantity = (
    serviceId: string,
    quantity: number
  ) => {
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
    const nextExisting = existingItems.filter(
      (item) => item.serviceId !== serviceId
    );
    updateServices({
      items: [...nextExisting, ...customItems],
      showQuickAdd: state.services.showQuickAdd,
    });
  };

  const inventoryLabels = useMemo(
    () => ({
      typeMeta: {
        deliverable: {
          title: tForms("services.types.deliverable", {
            defaultValue: t("steps.services.inventory.types.deliverable.title", {
              defaultValue: "Deliverables",
            }),
          }),
          subtitle: tForms("services.types.deliverable_hint", {
            defaultValue: t(
              "steps.services.inventory.types.deliverable.subtitle",
              { defaultValue: "Albums, prints and other client handoffs" }
            ),
          }),
          icon: PackageIcon,
          iconBackgroundClassName: "bg-emerald-50",
          iconClassName: "text-emerald-600",
        },
        coverage: {
          title: tForms("services.types.coverage", {
            defaultValue: t("steps.services.inventory.types.coverage.title", {
              defaultValue: "Crew services",
            }),
          }),
          subtitle: tForms("services.types.coverage_hint", {
            defaultValue: t(
              "steps.services.inventory.types.coverage.subtitle",
              {
                defaultValue:
                  "People-based coverage like photographers or videographers",
              }
            ),
          }),
          icon: Users,
          iconBackgroundClassName: "bg-emerald-50",
          iconClassName: "text-emerald-600",
        },
        unknown: {
          title: t("steps.services.inventory.types.unknown.title", {
            defaultValue: "Other services",
          }),
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
      unitCost: t("steps.services.list.unitCost", {
        defaultValue: "Unit cost",
      }),
      unitPrice: t("steps.services.list.unitPrice", {
        defaultValue: "Unit price",
      }),
      uncategorized: t("steps.services.inventory.uncategorized", {
        defaultValue: "Other",
      }),
      inactive: t("steps.services.inventory.inactive", {
        defaultValue: "Inactive",
      }),
      empty: t("steps.services.inventory.empty", {
        defaultValue:
          "No services in your catalog yet. Create services to add them here.",
      }),
      quantity: t("steps.services.list.quantity", { defaultValue: "Quantity" }),
      retry: t("common:actions.retry", { defaultValue: "Retry" }),
    }),
    [t, tForms]
  );

  const getUnitLabel = useCallback(
    (unit?: string | null) =>
      t(`steps.services.units.short.${normalizeServiceUnit(unit)}`, {
        defaultValue: t(
          `steps.services.units.options.${normalizeServiceUnit(unit)}`
        ),
      }),
    [t]
  );

  const totalSelected = existingItems.length + customItems.length;

  const serviceTableLabels = useMemo(
    () => ({
      columns: {
        name: t("steps.services.summary.table.name", {
          defaultValue: "Service",
        }),
        quantity: t("steps.services.summary.table.quantity", {
          defaultValue: "Qty",
        }),
        cost: t("steps.services.summary.table.cost", { defaultValue: "Cost" }),
        unitPrice: t("summaryView.services.columns.unitPrice"),
        lineTotal: t("summaryView.services.columns.lineTotal"),
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
        typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice)
          ? item.unitPrice
          : null;
      const pricing = calculateLineItemPricing(item);
      const service =
        item.type === "existing" && item.serviceId
          ? serviceMap.get(item.serviceId)
          : null;

      const vendorName =
        service?.vendor_name ??
        // @ts-expect-error legacy camelCase vendor
        service?.vendorName ??
        item.vendorName ??
        null;
      const displayName = item.name ?? service?.name ?? item.serviceId ?? "—";
      const unitLabel = getUnitLabel(
        item.unit ?? service?.unit ?? DEFAULT_SERVICE_UNIT
      );

      const lineCost =
        typeof item.unitCost === "number" && Number.isFinite(item.unitCost)
          ? Math.round(item.unitCost * quantity * 100) / 100
          : service?.unitCost
          ? Math.round(service.unitCost * quantity * 100) / 100
          : null;

      return {
        id: item.id,
        name: displayName,
        vendor: vendorName,
        quantity,
        unitLabel,
        lineCost,
        unitPrice: unitPriceValue,
        lineTotal: Math.round(pricing.gross * 100) / 100,
        isCustom: item.type === "custom",
      };
    });
  }, [serviceMap, state.services.items, t]);

  const updateItem = (
    itemId: string,
    updates: Partial<PackageCreationLineItem>
  ) => {
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

  const formatPercent = (value: number) =>
    new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
      maximumFractionDigits: 2,
    }).format(value);

  const vatBreakdown = useMemo(() => {
    const buckets = new Map<number, number>();
    state.services.items.forEach((item) => {
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
  }, [state.services.items]);

  const removeItem = (itemId: string) => {
    updateServices({
      items: state.services.items.filter((item) => item.id !== itemId),
    });
    setCustomVatPanels((previous) => {
      if (!previous[itemId]) {
        return previous;
      }
      const next = { ...previous };
      delete next[itemId];
      return next;
    });
    if (pendingCustomVatResetId === itemId) {
      setPendingCustomVatResetId(null);
    }
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    updateItem(itemId, { quantity: parseQuantityInput(value) });
  };

  const adjustQuantity = (itemId: string, delta: number) => {
    const target = state.services.items.find((item) => item.id === itemId);
    const next = Math.max(1, (target?.quantity ?? 1) + delta);
    updateItem(itemId, { quantity: next });
  };

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

  const hasQuickAddVatOverrides = useCallback(() => {
    const trimmed = customVatRate.trim();
    const numeric = trimmed
      ? Number(trimmed.replace(/,/g, "."))
      : defaultVatRate;
    const normalized = Number.isFinite(numeric)
      ? Math.min(99.99, Math.max(0, numeric))
      : defaultVatRate;
    const rateDiff = Math.abs(normalized - defaultVatRate) > 0.0001;
    const modeDiff = customVatMode !== defaultVatMode;
    return rateDiff || modeDiff;
  }, [customVatRate, customVatMode, defaultVatMode, defaultVatRate]);

  const handleQuickAddVatToggle = () => {
    if (!showQuickAddVatForm) {
      setShowQuickAddVatForm(true);
      return;
    }
    if (hasQuickAddVatOverrides()) {
      setShowQuickAddVatResetPrompt(true);
      return;
    }
    setCustomVatRate(defaultVatRateString);
    setCustomVatMode(defaultVatMode);
    setShowQuickAddVatForm(false);
    setShowQuickAddVatResetPrompt(false);
  };

  const handleConfirmQuickAddVatReset = () => {
    setCustomVatRate(defaultVatRateString);
    setCustomVatMode(defaultVatMode);
    setShowQuickAddVatForm(false);
    setShowQuickAddVatResetPrompt(false);
  };

  const customItemHasVatOverrides = useCallback(
    (item: PackageCreationLineItem) => {
      const rate =
        typeof item.vatRate === "number" && Number.isFinite(item.vatRate)
          ? item.vatRate
          : defaultVatRate;
      const mode = item.vatMode ?? defaultVatMode;
      const rateDiff = Math.abs(rate - defaultVatRate) > 0.0001;
      const modeDiff = mode !== defaultVatMode;
      return rateDiff || modeDiff;
    },
    [defaultVatMode, defaultVatRate]
  );

  const handleCustomVatToggle = (item: PackageCreationLineItem) => {
    const isOpen = Boolean(customVatPanels[item.id]);
    if (isOpen) {
      if (customItemHasVatOverrides(item)) {
        setPendingCustomVatResetId(item.id);
        return;
      }
      setCustomVatPanels((previous) => {
        const next = { ...previous };
        delete next[item.id];
        return next;
      });
      return;
    }
    setCustomVatPanels((previous) => ({ ...previous, [item.id]: true }));
  };

  const handleConfirmCustomVatReset = () => {
    if (!pendingCustomVatResetId) return;
    updateItem(pendingCustomVatResetId, {
      vatRate: defaultVatRate,
      vatMode: defaultVatMode,
    });
    setCustomVatPanels((previous) => {
      const next = { ...previous };
      delete next[pendingCustomVatResetId];
      return next;
    });
    setPendingCustomVatResetId(null);
  };

  const resetVatOverrides = useCallback(() => {
    const resetItems = state.services.items.map((item) => {
      const service =
        item.type === "existing" && item.serviceId
          ? serviceMap.get(item.serviceId)
          : null;
      const fallbackRate =
        typeof service?.vatRate === "number" && Number.isFinite(service.vatRate)
          ? service.vatRate
          : defaultVatRate;
      const fallbackMode: PackageVatMode = service?.vatMode ?? defaultVatMode;

      return {
        ...item,
        vatRate: fallbackRate,
        vatMode: fallbackMode,
      };
    });

    updateServices({ items: resetItems });
    setShowVatControls(false);
    setShowVatResetPrompt(false);
  }, [
    state.services.items,
    serviceMap,
    defaultVatRate,
    defaultVatMode,
    updateServices,
  ]);

  const toggleQuickAdd = () => {
    const nextOpen = !state.services.showQuickAdd;
    updateServices({ showQuickAdd: nextOpen });
    setCustomError(null);
    setCustomName("");
    setCustomCost("");
    setCustomPrice("");
    setCustomVatRate(defaultVatRateString);
    setCustomVatMode(defaultVatMode);
    setShowQuickAddVatForm(false);
    setShowQuickAddVatResetPrompt(false);
    setPendingCustomVatResetId(null);
  };

  const handleAddCustomService = () => {
    setCustomError(null);
    const trimmedName = customName.trim();
    const parsedPrice = Number(customPrice);
    const parsedCost = customCost.trim() === "" ? 0 : Number(customCost);
    const trimmedVat = customVatRate.trim();

    if (!trimmedName) {
      setCustomError(
        t("steps.services.custom.errors.name", {
          defaultValue: "Name is required.",
        })
      );
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setCustomError(
        t("steps.services.custom.errors.price", {
          defaultValue: "Enter a valid price.",
        })
      );
      return;
    }

    if (
      customCost.trim() !== "" &&
      (!Number.isFinite(parsedCost) || parsedCost < 0)
    ) {
      setCustomError(
        t("steps.services.custom.errors.cost", {
          defaultValue: "Enter a valid cost.",
        })
      );
      return;
    }

    let parsedVatRate = defaultVatRate;
    if (trimmedVat) {
      const numericVat = Number(trimmedVat.replace(/,/g, "."));
      if (Number.isNaN(numericVat)) {
        setCustomError(
          t("steps.services.custom.errors.vat", {
            defaultValue: "Enter a valid VAT rate.",
          })
        );
        return;
      }
      parsedVatRate = Math.min(99.99, Math.max(0, numericVat));
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
      vatRate: parsedVatRate,
      vatMode: customVatMode,
      unit: DEFAULT_SERVICE_UNIT,
    };

    updateServices({
      items: [...state.services.items, newItem],
      showQuickAdd: true,
    });

    setCustomName("");
    setCustomCost("");
    setCustomPrice("");
    setCustomVatRate(defaultVatRateString);
    setCustomVatMode(defaultVatMode);
    setShowQuickAddVatForm(false);
    setShowQuickAddVatResetPrompt(false);
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
        onRetry={
          servicesQuery.error ? () => servicesQuery.refetch() : undefined
        }
      />
      {state.services.items.length > 0 ? (
        <div className="space-y-4 rounded-2xl border border-border/70 bg-white/80 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 max-w-xl">
              <h3 className="text-sm font-semibold text-slate-900">
                {t("steps.services.vatControls.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("steps.services.vatControls.description")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <HelperTooltip
                label={t("steps.services.vatControls.toggleLabel")}
                content={t("steps.services.vatControls.toggleDescription")}
              />
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto px-0 text-xs font-semibold"
                onClick={handleToggleVatControls}
              >
                {showVatControls
                  ? t("steps.services.vatControls.buttonClose")
                  : t("steps.services.vatControls.buttonOpen")}
              </Button>
            </div>
          </div>
          {showVatControls ? (
            <div className="space-y-3">
              {state.services.items.map((item) => {
                const service = item.serviceId
                  ? serviceMap.get(item.serviceId)
                  : null;
                const vatModeValue: PackageVatMode =
                  item.vatMode ?? defaultVatMode;
                const vatRateValue =
                  typeof item.vatRate === "number" &&
                  Number.isFinite(item.vatRate)
                    ? String(item.vatRate)
                    : "";
                const serviceTypeKey =
                  (service?.serviceType as ServiceInventoryType | undefined) ??
                  "unknown";
                const serviceTypeLabel =
                  serviceTypeKey === "unknown"
                    ? t("steps.services.inventory.types.unknown.title")
                    : tForms(`services.types.${serviceTypeKey}`, {
                        defaultValue: t(
                          `steps.services.inventory.types.${serviceTypeKey}.title`
                        ),
                      });
                const vendorLabel = item.vendorName
                  ? t("steps.services.vatControls.vendorLabel", {
                      vendor: item.vendorName,
                    })
                  : service?.vendor_name
                  ? t("steps.services.vatControls.vendorLabel", {
                      vendor: service.vendor_name,
                    })
                  : null;
                const typeLabel = t("steps.services.vatControls.typeLabel", {
                  type: serviceTypeLabel,
                });
                const vatRateInputId = `vat-rate-${item.id}`;
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border/60 bg-white/95 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="min-w-[220px] space-y-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {item.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {vendorLabel ? <span>{vendorLabel}</span> : null}
                          <span>{typeLabel}</span>
                          {item.type === "custom" ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase tracking-wide"
                            >
                              {t("summaryView.services.customTag")}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-end">
                        <div className="space-y-1">
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
                            onChange={(event) =>
                              handleVatRateChange(item.id, event.target.value)
                            }
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t("steps.services.vatControls.modeLabel")}
                          </Label>
                          <Select
                            value={vatModeValue}
                            onValueChange={(value) =>
                              handleVatModeChange(
                                item.id,
                                value as PackageVatMode
                              )
                            }
                          >
                            <SelectTrigger className="h-9 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inclusive">
                                {t("steps.services.vatControls.mode.inclusive")}
                              </SelectItem>
                              <SelectItem value="exclusive">
                                {t("steps.services.vatControls.mode.exclusive")}
                              </SelectItem>
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 max-w-xl">
            <h3 className="text-sm font-semibold text-slate-900">
              {t("steps.services.custom.managerTitle")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("steps.services.custom.managerDescription")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <HelperTooltip
              label={t("steps.services.custom.managerTitle")}
              content={t("steps.services.custom.catalogTooltip")}
            />
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={toggleQuickAdd}
              className="h-auto px-0 text-xs font-semibold"
            >
              {state.services.showQuickAdd
                ? t("steps.services.custom.buttonClose")
                : t("steps.services.custom.buttonOpen")}
            </Button>
          </div>
        </div>

        {state.services.showQuickAdd && (
          <div className="space-y-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4">
            <h4 className="text-sm font-semibold text-slate-900">
              {t("steps.services.custom.title")}
            </h4>
            <p className="text-xs text-muted-foreground">
              {t("steps.services.custom.catalogNotice")}
            </p>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-4">
                <Label htmlFor="custom-name">
                  {t("steps.services.custom.nameLabel")}
                </Label>
                <Input
                  id="custom-name"
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  placeholder={t("steps.services.custom.namePlaceholder")}
                />
              </div>
              <div className="sm:col-span-1">
                <Label htmlFor="custom-cost">
                  {t("steps.services.custom.costLabel")}
                </Label>
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
              <div className="sm:col-span-1">
                <Label htmlFor="custom-price">
                  {t("steps.services.custom.priceLabel")}
                </Label>
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
            <div className="pt-1">
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto px-0 text-xs font-semibold"
                onClick={handleQuickAddVatToggle}
              >
                {showQuickAddVatForm
                  ? t("steps.services.custom.vatButtonClose")
                  : t("steps.services.custom.vatButtonOpen")}
              </Button>
            </div>
            {showQuickAddVatForm ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                  <div className="sm:col-span-1">
                    <Label htmlFor="custom-vat-rate">
                      {t("steps.services.custom.vatRateLabel")}
                    </Label>
                    <Input
                      id="custom-vat-rate"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={99.99}
                      step="0.01"
                      value={customVatRate}
                      onChange={(event) =>
                        setCustomVatRate(
                          event.target.value.replace(/[^0-9.,]/g, "")
                        )
                      }
                      placeholder={t(
                        "steps.services.custom.vatRatePlaceholder"
                      )}
                      className="h-10"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <Label className="text-xs text-muted-foreground">
                      {t("steps.services.custom.vatModeLabel")}
                    </Label>
                    <Select
                      value={customVatMode}
                      onValueChange={(value) =>
                        setCustomVatMode(value as PackageVatMode)
                      }
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inclusive">
                          {t("steps.services.vatControls.mode.inclusive")}
                        </SelectItem>
                        <SelectItem value="exclusive">
                          {t("steps.services.vatControls.mode.exclusive")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t("steps.services.custom.vatHelper", {
                    rate: formatPercent(defaultVatRate),
                    mode: t(
                      `steps.services.vatControls.mode.${defaultVatMode}`
                    ),
                  })}
                </p>
              </>
            ) : null}
            {customError ? (
              <p className="text-xs text-destructive">{customError}</p>
            ) : null}
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
              const isVatPanelOpen = Boolean(customVatPanels[item.id]);
              const customItemVatRateValue =
                typeof item.vatRate === "number" &&
                Number.isFinite(item.vatRate)
                  ? String(item.vatRate)
                  : "";
              const customItemVatModeValue: PackageVatMode =
                item.vatMode === "inclusive" || item.vatMode === "exclusive"
                  ? item.vatMode
                  : defaultVatMode;

              return (
                <div
                  key={item.id}
                  className="rounded-lg border bg-muted/10 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                    <div className="flex-1 space-y-2">
                      <Label
                        htmlFor={`custom-name-${item.id}`}
                        className="text-xs text-muted-foreground"
                      >
                        {t("steps.services.custom.nameLabel")}
                      </Label>
                      <Input
                        id={`custom-name-${item.id}`}
                        value={item.name}
                        onChange={(event) =>
                          updateItem(item.id, { name: event.target.value })
                        }
                        className="h-10 w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                      <div className="space-y-2 sm:w-40 sm:flex-none">
                        <Label
                          htmlFor={`custom-cost-${item.id}`}
                          className="text-xs text-muted-foreground"
                        >
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
                              unitCost:
                                event.target.value === ""
                                  ? null
                                  : Number(event.target.value),
                            })
                          }
                          className="h-10 w-full sm:w-40"
                        />
                      </div>
                      <div className="space-y-2 sm:w-40 sm:flex-none">
                        <Label
                          htmlFor={`custom-price-${item.id}`}
                          className="text-xs text-muted-foreground"
                        >
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
                              unitPrice:
                                event.target.value === ""
                                  ? null
                                  : Number(event.target.value),
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
                            aria-label={t("common:actions.decrease", {
                              defaultValue: "Decrease",
                            })}
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
                          onChange={(event) =>
                            handleQuantityChange(item.id, event.target.value)
                          }
                          className="h-8 w-14 border-0 bg-transparent text-center text-sm font-medium focus-visible:ring-0"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => adjustQuantity(item.id, 1)}
                          aria-label={t("common:actions.increase", {
                            defaultValue: "Increase",
                          })}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto px-0 text-xs font-semibold"
                      onClick={() => handleCustomVatToggle(item)}
                    >
                      {isVatPanelOpen
                        ? t("steps.services.custom.vatButtonClose")
                        : t("steps.services.custom.vatButtonOpen")}
                    </Button>

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
                  {isVatPanelOpen ? (
                    <div className="mt-3 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label
                            htmlFor={`custom-vat-rate-${item.id}`}
                            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            {t("steps.services.custom.vatRateLabel")}
                          </Label>
                          <Input
                            id={`custom-vat-rate-${item.id}`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={99.99}
                            step="0.01"
                            value={customItemVatRateValue}
                            onChange={(event) =>
                              handleVatRateChange(item.id, event.target.value)
                            }
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t("steps.services.custom.vatModeLabel")}
                          </Label>
                          <Select
                            value={customItemVatModeValue}
                            onValueChange={(value) =>
                              handleVatModeChange(
                                item.id,
                                value as PackageVatMode
                              )
                            }
                          >
                            <SelectTrigger className="h-10 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inclusive">
                                {t("steps.services.vatControls.mode.inclusive")}
                              </SelectItem>
                              <SelectItem value="exclusive">
                                {t("steps.services.vatControls.mode.exclusive")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {t("steps.services.custom.vatHelper", {
                          rate: formatPercent(defaultVatRate),
                          mode: t(
                            `steps.services.vatControls.mode.${defaultVatMode}`
                          ),
                        })}
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : !state.services.showQuickAdd ? (
          <p className="text-sm text-muted-foreground">
            {t("steps.services.custom.emptyState", {
              defaultValue: "No custom services yet.",
            })}
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("steps.services.summary.listHeading", {
            defaultValue: "Selected services",
          })}
        </p>
        <ServicesTableCard
          rows={summaryTableRows}
          totals={undefined}
          labels={serviceTableLabels}
          emptyMessage={t("steps.services.summary.empty")}
          formatCurrency={formatCurrency}
          className="bg-white/80 backdrop-blur"
        />
        {summaryTableRows.length ? (
          <div className="flex justify-end">
            <div className="w-full space-y-3 rounded-xl border border-border/60 bg-white p-4 shadow-sm sm:w-auto sm:min-w-[320px]">
              <div className="flex items-center justify-between text-sm text-slate-900">
                <span className="text-muted-foreground">
                  {t("steps.services.summary.countLabel")}
                </span>
                <span className="font-medium">{totalSelected}</span>
              </div>
              <SummaryTotalRow
                label={t("steps.services.summary.cost")}
                value={formatCurrency(totals.cost)}
              />
              <SummaryTotalRow
                label={t("steps.services.summary.price")}
                value={formatCurrency(totals.price)}
              />
              {vatBreakdown.length ? (
                <div className="space-y-1">
                  {vatBreakdown.map((entry) => (
                    <SummaryTotalRow
                      key={entry.rate}
                      label={t("steps.services.summary.vatBreakdownItem", {
                        rate: formatPercent(entry.rate),
                      })}
                      value={formatCurrency(entry.amount)}
                    />
                  ))}
                </div>
              ) : null}
              {vatBreakdown.length !== 1 ? (
                <SummaryTotalRow
                  label={
                    vatBreakdown.length > 1
                      ? t("steps.services.summary.vatTotal", {
                          defaultValue: "Total VAT",
                        })
                      : t("steps.services.summary.vat", { defaultValue: "VAT" })
                  }
                  value={formatCurrency(totals.vat)}
                />
              ) : null}
              <div className="border-t border-border/60 pt-3 space-y-2">
                <SummaryTotalRow
                  label={t("steps.services.summary.gross", {
                    defaultValue: "Total",
                  })}
                  value={formatCurrency(totals.total)}
                  emphasizeLabel
                />
                <SummaryTotalRow
                  label={t("steps.services.summary.margin")}
                  value={formatCurrency(margin)}
                  tone={margin >= 0 ? "positive" : "negative"}
                  emphasizeLabel
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <AlertDialog
        open={showVatResetPrompt}
        onOpenChange={setShowVatResetPrompt}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("steps.services.vatControls.resetConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("steps.services.vatControls.resetConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowVatResetPrompt(false);
              }}
            >
              {t("steps.services.vatControls.resetConfirmCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={resetVatOverrides}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("steps.services.vatControls.resetConfirmConfirm")}
            </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

      <AlertDialog
        open={showQuickAddVatResetPrompt}
        onOpenChange={setShowQuickAddVatResetPrompt}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("steps.services.vatControls.resetConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("steps.services.vatControls.resetConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setShowQuickAddVatResetPrompt(false)}
            >
              {t("steps.services.vatControls.resetConfirmCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmQuickAddVatReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("steps.services.vatControls.resetConfirmConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingCustomVatResetId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCustomVatResetId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("steps.services.vatControls.resetConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("steps.services.vatControls.resetConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingCustomVatResetId(null)}>
              {t("steps.services.vatControls.resetConfirmCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCustomVatReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("steps.services.vatControls.resetConfirmConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const SummaryTotalRow = ({
  label,
  value,
  tone,
  emphasizeLabel,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  emphasizeLabel?: boolean;
}) => {
  const valueClassName = cn(
    "font-medium",
    tone === "positive" && "text-emerald-600",
    tone === "negative" && "text-destructive"
  );

  return (
    <div className="flex items-center justify-between text-sm">
      <span
        className={cn(
          emphasizeLabel
            ? "font-semibold text-slate-900"
            : "text-muted-foreground"
        )}
      >
        {label}
      </span>
      <span className={valueClassName}>{value}</span>
    </div>
  );
};

const HelperTooltip = ({
  label,
  content,
}: {
  label: string;
  content: string;
}) => (
  <TooltipProvider delayDuration={150} disableHoverableContent>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground transition-colors hover:text-slate-900"
          aria-label={label}
        >
          <Info className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-snug">
        {content}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
