import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { cn } from "@/lib/utils";
import { calculateLineItemPricing } from "../utils/lineItemPricing";
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
import { Users, Package as PackageIcon, Layers } from "lucide-react";
import {
  ServiceVatOverridesSection,
  type ServiceVatOverridesItem,
  type ServiceVatOverridesMeta,
} from "@/features/services/components/ServiceVatOverridesSection";
import {
  CustomServicesSection,
  type CustomServiceFormState,
  type CustomServiceItemView,
} from "@/features/services/components/CustomServicesSection";
import {
  SummaryTotalRow,
  SummaryTotalsCard,
  SummaryTotalsDivider,
  SummaryTotalsSection,
} from "@/features/services/components/SummaryTotalsCard";
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

  const vatModeOptions = useMemo(
    () => [
      {
        value: "inclusive" as PackageVatMode,
        label: t("steps.services.vatControls.mode.inclusive"),
      },
      {
        value: "exclusive" as PackageVatMode,
        label: t("steps.services.vatControls.mode.exclusive"),
      },
    ],
    [t]
  );

  const vatOverrideItems = useMemo<ServiceVatOverridesItem[]>(() => {
    return state.services.items.map((item) => {
      const service =
        item.type === "existing" && item.serviceId ? serviceMap.get(item.serviceId) : null;
      const vatRateValue =
        typeof item.vatRate === "number" && Number.isFinite(item.vatRate)
          ? String(item.vatRate)
          : "";
      const vatModeValue: PackageVatMode =
        item.vatMode === "inclusive" || item.vatMode === "exclusive"
          ? item.vatMode
          : defaultVatMode;
      const meta: ServiceVatOverridesMeta[] = [];
      const vendorLabel = item.vendorName
        ? t("steps.services.vatControls.vendorLabel", { vendor: item.vendorName })
        : service?.vendor_name
        ? t("steps.services.vatControls.vendorLabel", { vendor: service.vendor_name })
        : null;
      if (vendorLabel) {
        meta.push({ label: vendorLabel });
      }
      const serviceTypeKey =
        (service?.serviceType as ServiceInventoryType | undefined) ?? "unknown";
      const serviceTypeLabel =
        serviceTypeKey === "unknown"
          ? t("steps.services.inventory.types.unknown.title")
          : tForms(`services.types.${serviceTypeKey}`, {
              defaultValue: t(
                `steps.services.inventory.types.${serviceTypeKey}.title`
              ),
            });
      meta.push({
        label: t("steps.services.vatControls.typeLabel", { type: serviceTypeLabel }),
      });
      if (item.type === "custom") {
        meta.push({
          label: t("summaryView.services.customTag"),
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
  }, [state.services.items, serviceMap, defaultVatMode, t, tForms]);

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

  const customFormState: CustomServiceFormState = {
    name: customName,
    cost: customCost,
    price: customPrice,
    vatRate: customVatRate,
    vatMode: customVatMode,
    vatFormOpen: showQuickAddVatForm,
  };

  const handleCustomFormChange = (updates: Partial<CustomServiceFormState>) => {
    if (updates.name !== undefined) setCustomName(updates.name);
    if (updates.cost !== undefined) setCustomCost(updates.cost);
    if (updates.price !== undefined) setCustomPrice(updates.price);
    if (updates.vatRate !== undefined) setCustomVatRate(updates.vatRate);
    if (updates.vatMode !== undefined) setCustomVatMode(updates.vatMode);
  };

  const customServiceItems = useMemo<CustomServiceItemView[]>(
    () =>
      customItems.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: Math.max(1, item.quantity ?? 1),
        unitCost: item.unitCost ?? null,
        unitPrice: item.unitPrice ?? null,
        unitLabel: getUnitLabel(item.unit ?? DEFAULT_SERVICE_UNIT),
        vatRate:
          typeof item.vatRate === "number" && Number.isFinite(item.vatRate)
            ? item.vatRate
            : null,
        vatMode:
          item.vatMode === "inclusive" || item.vatMode === "exclusive"
            ? item.vatMode
            : defaultVatMode,
        vatEditorOpen: Boolean(customVatPanels[item.id]),
      })),
    [customItems, customVatPanels, getUnitLabel, defaultVatMode]
  );

  const customServicesStrings = useMemo(() => {
    const vatModeLabel = t(`steps.services.vatControls.mode.${defaultVatMode}`);
    const vatHelperText = t("steps.services.custom.vatHelper", {
      rate: formatPercent(defaultVatRate),
      mode: vatModeLabel,
    });
    return {
      nameLabel: t("steps.services.custom.nameLabel"),
      namePlaceholder: t("steps.services.custom.namePlaceholder"),
      costLabel: t("steps.services.custom.costLabel"),
      costPlaceholder: t("steps.services.custom.costPlaceholder"),
      priceLabel: t("steps.services.custom.priceLabel"),
      pricePlaceholder: t("steps.services.custom.pricePlaceholder"),
      listCostLabel: t("steps.services.list.unitCost"),
      listPriceLabel: t("steps.services.list.unitPrice"),
      addButton: t("steps.services.custom.add"),
      cancelButton: t("steps.services.custom.cancel"),
      vatToggleOpen: t("steps.services.custom.vatButtonOpen"),
      vatToggleClose: t("steps.services.custom.vatButtonClose"),
      vatRateLabel: t("steps.services.custom.vatRateLabel"),
      vatRatePlaceholder: t("steps.services.custom.vatRatePlaceholder"),
      vatModeLabel: t("steps.services.custom.vatModeLabel"),
      vatHelper: vatHelperText,
      vatHelperPerItem: vatHelperText,
      quantityLabel: t("steps.services.list.quantity"),
      decreaseAriaLabel: t("common:actions.decrease", {
        defaultValue: "Decrease",
      }),
      increaseAriaLabel: t("common:actions.increase", {
        defaultValue: "Increase",
      }),
      removeAriaLabel: t("steps.services.list.remove"),
      customBadgeLabel: t("summaryView.services.customTag"),
      emptyState: t("steps.services.custom.emptyState", {
        defaultValue: "No custom services yet.",
      }),
    };
  }, [t, defaultVatRate, defaultVatMode]);

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

  const handleCustomVatToggle = (itemId: string) => {
    const item = state.services.items.find((serviceItem) => serviceItem.id === itemId);
    if (!item) return;
    const isOpen = Boolean(customVatPanels[itemId]);
    if (isOpen) {
      if (customItemHasVatOverrides(item)) {
        setPendingCustomVatResetId(itemId);
        return;
      }
      setCustomVatPanels((previous) => {
        const next = { ...previous };
        delete next[itemId];
        return next;
      });
      return;
    }
    setCustomVatPanels((previous) => ({ ...previous, [itemId]: true }));
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
        <ServiceVatOverridesSection
          title={t("steps.services.vatControls.title")}
          description={t("steps.services.vatControls.description")}
          tooltipLabel={t("steps.services.vatControls.toggleLabel")}
          tooltipContent={t("steps.services.vatControls.toggleDescription")}
          toggleButtonLabel={
            showVatControls
              ? t("steps.services.vatControls.buttonClose")
              : t("steps.services.vatControls.buttonOpen")
          }
          isOpen={showVatControls}
          onToggle={handleToggleVatControls}
          items={vatOverrideItems}
          rateLabel={t("steps.services.vatControls.rateLabel")}
          modeLabel={t("steps.services.vatControls.modeLabel")}
          modeOptions={vatModeOptions}
          onRateChange={handleVatRateChange}
          onModeChange={handleVatModeChange}
        />
      ) : null}

      <CustomServicesSection
        title={t("steps.services.custom.managerTitle")}
        description={t("steps.services.custom.managerDescription")}
        tooltipLabel={t("steps.services.custom.managerTitle")}
        tooltipContent={t("steps.services.custom.catalogTooltip")}
        toggleButtonLabels={{
          open: t("steps.services.custom.buttonOpen"),
          close: t("steps.services.custom.buttonClose"),
        }}
        open={state.services.showQuickAdd}
        onToggle={toggleQuickAdd}
        form={customFormState}
        onFormChange={handleCustomFormChange}
        onSubmit={handleAddCustomService}
        onCancel={toggleQuickAdd}
        error={customError}
        strings={customServicesStrings}
        vatModeOptions={vatModeOptions}
        onQuickAddVatToggle={handleQuickAddVatToggle}
        items={customServiceItems}
        onItemNameChange={(itemId, value) => updateItem(itemId, { name: value })}
        onItemCostChange={(itemId, value) =>
          updateItem(itemId, { unitCost: value === "" ? null : Number(value) })
        }
        onItemPriceChange={(itemId, value) =>
          updateItem(itemId, { unitPrice: value === "" ? null : Number(value) })
        }
        onItemQuantityChange={handleQuantityChange}
        onItemAdjustQuantity={adjustQuantity}
        onItemRemove={removeItem}
        onItemVatToggle={handleCustomVatToggle}
        onItemVatRateChange={handleVatRateChange}
        onItemVatModeChange={handleVatModeChange}
      />

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
            <SummaryTotalsCard className="sm:w-auto sm:min-w-[320px]">
              <SummaryTotalRow
                label={t("steps.services.summary.countLabel")}
                value={totalSelected}
              />
              <SummaryTotalsSection>
                <SummaryTotalRow
                  label={t("steps.services.summary.cost")}
                  value={formatCurrency(totals.cost)}
                />
                <SummaryTotalRow
                  label={t("steps.services.summary.price")}
                  value={formatCurrency(totals.price)}
                />
              </SummaryTotalsSection>
              {vatBreakdown.length ? (
                <SummaryTotalsSection className="space-y-1">
                  {vatBreakdown.map((entry) => (
                    <SummaryTotalRow
                      key={entry.rate}
                      label={t("steps.services.summary.vatBreakdownItem", {
                        rate: formatPercent(entry.rate),
                      })}
                      value={formatCurrency(entry.amount)}
                    />
                  ))}
                </SummaryTotalsSection>
              ) : null}
              {vatBreakdown.length !== 1 ? (
                <SummaryTotalsSection>
                  <SummaryTotalRow
                    label={
                      vatBreakdown.length > 1
                        ? t("steps.services.summary.vatTotal", {
                            defaultValue: "Total VAT",
                          })
                        : t("steps.services.summary.vat", {
                            defaultValue: "VAT",
                          })
                    }
                    value={formatCurrency(totals.vat)}
                  />
                </SummaryTotalsSection>
              ) : null}
              <SummaryTotalsDivider />
              <SummaryTotalsSection className="pt-3">
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
              </SummaryTotalsSection>
            </SummaryTotalsCard>
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
