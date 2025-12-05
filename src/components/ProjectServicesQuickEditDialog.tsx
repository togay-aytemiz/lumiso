import { useCallback, useEffect, useMemo, useState } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  ServiceInventorySelector,
  type ServiceInventoryItem,
  type ServiceInventoryLabels,
  type ServiceInventoryType,
} from "./ServiceInventorySelector";
import { useTranslation } from "react-i18next";
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
import { useOrganizationTaxProfile } from "@/hooks/useOrganizationData";
import { AlertTriangle } from "lucide-react";

export interface QuickServiceRecord {
  id: string;
  name: string;
  category?: string | null;
  selling_price?: number | null;
  price?: number | null;
  cost_price?: number | null;
  vat_rate?: number | null;
  price_includes_vat?: boolean | null;
  service_type?: "coverage" | "deliverable" | null;
  extra: boolean;
}

export type VatModeOption = "inclusive" | "exclusive";

export interface ProjectServiceQuickEditSelection {
  serviceId: string;
  projectServiceId?: string;
  quantity: number;
  unitCost: number | null;
  unitPrice: number | null;
  vatMode: VatModeOption;
  vatRate: number | null;
}

export interface ProjectServiceQuickEditResult {
  serviceId: string;
  projectServiceId?: string;
  billingType: "included" | "extra";
  quantity: number;
  overrides: {
    unitCost?: number | null;
    unitPrice?: number | null;
    vatMode?: VatModeOption;
    vatRate?: number | null;
  };
}

interface ProjectServicesQuickEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "included" | "extra";
  services: QuickServiceRecord[];
  selections: ProjectServiceQuickEditSelection[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSubmit: (selection: ProjectServiceQuickEditResult[]) => Promise<void> | void;
}

type SelectionValues = {
  unitCost: number | null;
  unitPrice: number | null;
  vatMode: VatModeOption;
  vatRate: number | null;
};

type SelectedServiceEntry = {
  projectServiceId?: string;
  quantity: number;
  values: SelectionValues;
  defaults: SelectionValues;
  openPricing: boolean;
  openVat: boolean;
};

const createDefaultValues = (): SelectionValues => ({
  unitCost: null,
  unitPrice: null,
  vatMode: "inclusive",
  vatRate: null,
});

const isSameNumber = (a: number | null | undefined, b: number | null | undefined) => {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (Number.isFinite(a) && Number.isFinite(b)) {
    return Number(a) === Number(b);
  }
  return a === b;
};

const isPricingDirty = (entry: SelectedServiceEntry) =>
  !isSameNumber(entry.values.unitCost, entry.defaults.unitCost) ||
  !isSameNumber(entry.values.unitPrice, entry.defaults.unitPrice);

const isVatDirty = (entry: SelectedServiceEntry, vatEnabled: boolean) =>
  vatEnabled &&
  (entry.values.vatMode !== entry.defaults.vatMode ||
    !isSameNumber(entry.values.vatRate, entry.defaults.vatRate));

export function ProjectServicesQuickEditDialog({
  open,
  onOpenChange,
  mode,
  services,
  selections,
  isLoading,
  error,
  onRetry,
  onSubmit,
}: ProjectServicesQuickEditDialogProps) {
  const { t } = useFormsTranslation();
  const { t: tProject } = useTranslation("projectCreation");
  const { t: tCommon } = useTranslation("common");
  const { isInGuidedSetup, isOnboardingComplete } = useOnboarding();
  const taxProfileQuery = useOrganizationTaxProfile();
  const vatExempt = Boolean(taxProfileQuery.data?.vatExempt);
  const vatUiEnabled = !vatExempt;

  const [selectionMap, setSelectionMap] = useState<Map<string, SelectedServiceEntry>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [pendingReset, setPendingReset] = useState<
    | {
        serviceId: string;
        type: "pricing" | "vat";
      }
    | null
  >(null);

  const serviceMap = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);

  const computeDefaults = useCallback(
    (serviceId: string, fallback?: SelectionValues): SelectionValues => {
      const catalog = serviceMap.get(serviceId);
      if (!catalog) {
        return fallback ? { ...fallback } : createDefaultValues();
      }
      return {
        unitCost: catalog.cost_price ?? fallback?.unitCost ?? null,
        unitPrice: catalog.selling_price ?? catalog.price ?? fallback?.unitPrice ?? null,
        vatMode: vatUiEnabled
          ? catalog.price_includes_vat === false
            ? "exclusive"
            : fallback?.vatMode ?? "inclusive"
          : "exclusive",
        vatRate: vatUiEnabled ? catalog.vat_rate ?? fallback?.vatRate ?? null : null,
      };
    },
    [serviceMap, vatUiEnabled],
  );

  useEffect(() => {
    if (!open) return;
    setSelectionMap(() => {
      const next = new Map<string, SelectedServiceEntry>();
      selections.forEach((selection) => {
        const defaults = computeDefaults(selection.serviceId, {
          unitCost: selection.unitCost,
          unitPrice: selection.unitPrice,
          vatMode: selection.vatMode,
          vatRate: selection.vatRate,
        });
        const entry: SelectedServiceEntry = {
          projectServiceId: selection.projectServiceId,
          quantity: Math.max(1, selection.quantity ?? 1),
          values: {
            unitCost: selection.unitCost ?? defaults.unitCost ?? null,
            unitPrice: selection.unitPrice ?? defaults.unitPrice ?? null,
            vatMode: vatUiEnabled ? selection.vatMode ?? defaults.vatMode : "exclusive",
            vatRate: vatUiEnabled ? selection.vatRate ?? defaults.vatRate ?? null : null,
          },
          defaults,
          openPricing: false,
          openVat: false,
        };
        const pricingDirty = isPricingDirty(entry);
        const vatDirty = isVatDirty(entry, vatUiEnabled);
        next.set(selection.serviceId, {
          ...entry,
          openPricing: pricingDirty,
          openVat: vatUiEnabled && vatDirty,
        });
      });
      return next;
    });
  }, [computeDefaults, open, selections, vatUiEnabled]);

  const inventoryServices = useMemo<ServiceInventoryItem[]>(
    () =>
      services.map((service) => ({
        id: service.id,
        name: service.name,
        category: service.category ?? undefined,
        serviceType: (service.service_type ?? undefined) as ServiceInventoryType | undefined,
        unitCost: service.cost_price ?? undefined,
        unitPrice: service.selling_price ?? service.price ?? undefined,
        vatRate:
          vatUiEnabled && typeof service.vat_rate === "number"
            ? service.vat_rate
            : undefined,
        priceIncludesVat: vatUiEnabled && service.price_includes_vat ? true : false,
      })),
    [services, vatUiEnabled],
  );

  const inventoryLabels = useMemo<ServiceInventoryLabels>(() => ({
    typeMeta: {
      coverage: {
        title: tProject("steps.packages.inventory.types.coverage.title", {
          defaultValue: "Crew services",
        }),
        subtitle: tProject("steps.packages.inventory.types.coverage.subtitle", {
          defaultValue: "On-site coverage like photographers or videographers",
        }),
        segmentedLabel: ({ selectedServices, totalServices }) =>
          tProject("steps.packages.inventory.segmented.coverage", {
            defaultValue: "Team & coverage ({{selected}}/{{total}})",
            selected: selectedServices,
            total: totalServices,
          }),
      },
      deliverable: {
        title: tProject("steps.packages.inventory.types.deliverable.title", {
          defaultValue: "Deliverables",
        }),
        subtitle: tProject("steps.packages.inventory.types.deliverable.subtitle", {
          defaultValue: "Products delivered after the shoot",
        }),
        segmentedLabel: ({ selectedServices, totalServices }) =>
          tProject("steps.packages.inventory.segmented.deliverable", {
            defaultValue: "Products & deliverables ({{selected}}/{{total}})",
            selected: selectedServices,
            total: totalServices,
          }),
      },
      unknown: {
        title: tProject("steps.packages.inventory.types.unknown.title", {
          defaultValue: "Other services",
        }),
        subtitle: tProject("steps.packages.inventory.types.unknown.subtitle", {
          defaultValue: "Items without a service type yet",
        }),
        segmentedLabel: ({ selectedServices, totalServices }) =>
          tProject("steps.packages.inventory.segmented.unknown", {
            defaultValue: "Other services ({{selected}}/{{total}})",
            selected: selectedServices,
            total: totalServices,
          }),
      },
    },
    add: tProject("steps.packages.inventory.add", { defaultValue: "Add" }),
    decrease: tCommon("actions.decrease", { defaultValue: "Decrease" }),
    increase: tCommon("actions.increase", { defaultValue: "Increase" }),
    remove: tProject("steps.packages.list.remove", { defaultValue: "Remove" }),
    vendor: tProject("steps.packages.list.vendor", { defaultValue: "Vendor" }),
    unitCost: tProject("steps.packages.list.unitCost", { defaultValue: "Unit cost" }),
    unitPrice: tProject("steps.packages.list.unitPrice", { defaultValue: "Unit price" }),
    uncategorized: tProject("steps.packages.inventory.uncategorized", { defaultValue: "Other" }),
    inactive: tProject("steps.packages.inventory.inactive", { defaultValue: "Inactive" }),
    empty: tProject("steps.packages.inventory.empty", {
      defaultValue: "No services in your catalog yet. Create services to add them here.",
    }),
    quantity: tProject("steps.packages.list.quantity", { defaultValue: "Quantity" }),
    selectedTag: (selected, total) =>
      tProject("steps.packages.inventory.selectedTag", {
        defaultValue: "{{selected}} of {{total}} selected",
        selected,
        total,
      }),
    quantityTag: (count) =>
      tProject("steps.packages.inventory.quantityTag", {
        defaultValue: "x{{count}}",
        count,
      }),
    retry: t("payments.services.retry", { defaultValue: "Retry" }),
  }), [t, tCommon, tProject]);

  const vatModeOptions = useMemo(
    () => [
      {
        value: "inclusive" as VatModeOption,
        label: tProject("steps.packages.vatControls.mode.inclusive", {
          defaultValue: "Price includes VAT",
        }),
      },
      {
        value: "exclusive" as VatModeOption,
        label: tProject("steps.packages.vatControls.mode.exclusive", {
          defaultValue: "Add VAT on top",
        }),
      },
    ],
    [tProject],
  );

  const helperNote = useMemo(() => {
    if (mode === "included") {
      return t("payments.services.quick_edit_included_helper", {
        defaultValue: "Included services are covered by your package price.",
      });
    }
    return t("payments.services.quick_edit_extra_helper", {
      defaultValue: "Add-on services are billed on top of the package price.",
    });
  }, [mode, t]);

  const resetDialogStrings = useMemo(() => {
    if (!pendingReset) return null;
    if (pendingReset.type === "pricing") {
      return {
        title: tProject("steps.packages.actions.resetPricingConfirmTitle", {
          defaultValue: "Reset price overrides?",
        }),
        description: tProject("steps.packages.actions.resetPricingConfirm", {
          defaultValue: "This will restore the original price and VAT values for this service. Do you want to continue?",
        }),
        cancel: tProject("steps.packages.actions.resetPricingConfirmCancel", {
          defaultValue: "Keep changes",
        }),
        confirm: tProject("steps.packages.actions.resetPricingConfirmConfirm", {
          defaultValue: "Reset price",
        }),
      } as const;
    }
    return {
      title: tProject("steps.packages.actions.resetVatConfirmTitle", {
        defaultValue: "Reset VAT overrides?",
      }),
      description: tProject("steps.packages.actions.resetVatConfirm", {
        defaultValue: "This will restore the original VAT configuration for this service. Do you want to continue?",
      }),
      cancel: tProject("steps.packages.actions.resetVatConfirmCancel", {
        defaultValue: "Keep changes",
      }),
      confirm: tProject("steps.packages.actions.resetVatConfirmConfirm", {
        defaultValue: "Reset VAT",
      }),
    } as const;
  }, [pendingReset, tProject]);

  const selectedQuantities = useMemo(() => {
    const next: Record<string, number> = {};
    selectionMap.forEach((entry, serviceId) => {
      next[serviceId] = entry.quantity;
    });
    return next;
  }, [selectionMap]);

  const addService = useCallback(
    (serviceId: string) => {
      setSelectionMap((previous) => {
        if (previous.has(serviceId)) {
          return previous;
        }
        const defaults = computeDefaults(serviceId);
        const entry: SelectedServiceEntry = {
          projectServiceId: undefined,
          quantity: 1,
          values: { ...defaults },
          defaults,
          openPricing: false,
          openVat: false,
        };
        const next = new Map(previous);
        next.set(serviceId, entry);
        return next;
      });
    },
    [computeDefaults],
  );

  const removeService = useCallback((serviceId: string) => {
    setSelectionMap((previous) => {
      if (!previous.has(serviceId)) return previous;
      const next = new Map(previous);
      next.delete(serviceId);
      return next;
    });
  }, []);

  const setQuantity = useCallback(
    (serviceId: string, quantity: number) => {
      setSelectionMap((previous) => {
        const current = previous.get(serviceId);
        if (!current) {
          if (quantity <= 0) return previous;
          const defaults = computeDefaults(serviceId);
          const entry: SelectedServiceEntry = {
            projectServiceId: undefined,
            quantity,
            values: { ...defaults },
            defaults,
            openPricing: false,
            openVat: false,
          };
          const next = new Map(previous);
          next.set(serviceId, entry);
          return next;
        }
        if (quantity <= 0) {
          const next = new Map(previous);
          next.delete(serviceId);
          return next;
        }
        const next = new Map(previous);
        next.set(serviceId, {
          ...current,
          quantity,
        });
        return next;
      });
    },
    [computeDefaults],
  );

  const updateEntry = useCallback(
    (serviceId: string, updater: (entry: SelectedServiceEntry) => SelectedServiceEntry) => {
      setSelectionMap((previous) => {
        const current = previous.get(serviceId);
        if (!current) return previous;
        const next = new Map(previous);
        next.set(serviceId, updater(current));
        return next;
      });
    },
    [],
  );

  const togglePricing = useCallback(
    (serviceId: string) => {
      let shouldPrompt = false;
      updateEntry(serviceId, (entry) => {
        if (!entry.openPricing) {
          return {
            ...entry,
            openPricing: true,
          };
        }

        if (isPricingDirty(entry)) {
          shouldPrompt = true;
          return entry;
        }

        return {
          ...entry,
          values: {
            ...entry.values,
            unitCost: entry.defaults.unitCost ?? null,
            unitPrice: entry.defaults.unitPrice ?? null,
          },
          openPricing: false,
          openVat: false,
        };
      });

      if (shouldPrompt) {
        setPendingReset({ serviceId, type: "pricing" });
      }
    },
    [setPendingReset, updateEntry],
  );

  const toggleVat = useCallback(
    (serviceId: string) => {
      if (!vatUiEnabled) return;
      let shouldPrompt = false;
      updateEntry(serviceId, (entry) => {
        if (!entry.openVat) {
          return {
            ...entry,
            openVat: true,
          };
        }

        if (isVatDirty(entry, vatUiEnabled)) {
          shouldPrompt = true;
          return entry;
        }

        return {
          ...entry,
          values: {
            ...entry.values,
            vatMode: entry.defaults.vatMode,
            vatRate: entry.defaults.vatRate ?? null,
          },
          openVat: false,
        };
      });

      if (shouldPrompt) {
        setPendingReset({ serviceId, type: "vat" });
      }
    },
    [setPendingReset, updateEntry, vatUiEnabled],
  );

  const handleConfirmReset = useCallback(() => {
    if (!pendingReset) return;
    if (!vatUiEnabled && pendingReset.type === "vat") {
      setPendingReset(null);
      return;
    }
    setSelectionMap((previous) => {
      const current = previous.get(pendingReset.serviceId);
      if (!current) return previous;
      const next = new Map(previous);
      if (pendingReset.type === "pricing") {
        next.set(pendingReset.serviceId, {
          ...current,
          values: {
            ...current.values,
            unitCost: current.defaults.unitCost ?? null,
            unitPrice: current.defaults.unitPrice ?? null,
          },
          openPricing: false,
          openVat: false,
        });
      } else {
        next.set(pendingReset.serviceId, {
          ...current,
          values: {
            ...current.values,
            vatMode: current.defaults.vatMode,
            vatRate: current.defaults.vatRate ?? null,
          },
          openVat: false,
        });
      }
      return next;
    });
    setPendingReset(null);
  }, [pendingReset, vatUiEnabled]);

  const handleCancelReset = useCallback(() => {
    setPendingReset(null);
  }, []);

  const handleNumericChange = useCallback(
    (serviceId: string, field: keyof SelectionValues, raw: string) => {
      if (!vatUiEnabled && (field === "vatMode" || field === "vatRate")) {
        return;
      }
      const trimmed = raw.trim();
      if (trimmed === "") {
        updateEntry(serviceId, (entry) => ({
          ...entry,
          values: {
            ...entry.values,
            [field]: null,
          },
        }));
        return;
      }
      const parsed = Number(trimmed.replace(/,/g, "."));
      if (Number.isNaN(parsed)) {
        return;
      }
      updateEntry(serviceId, (entry) => ({
        ...entry,
        values: {
          ...entry.values,
          [field]: parsed,
        },
      }));
    },
    [updateEntry, vatUiEnabled],
  );

  const handleVatRateChange = useCallback(
    (serviceId: string, raw: string) => {
      if (!vatUiEnabled) return;
      const trimmed = raw.trim();
      if (!trimmed) {
        updateEntry(serviceId, (entry) => ({
          ...entry,
          values: {
            ...entry.values,
            vatRate: null,
          },
        }));
        return;
      }
      const numeric = Number(trimmed.replace(/,/g, "."));
      if (Number.isNaN(numeric)) return;
      const clamped = Math.min(99.99, Math.max(0, numeric));
      updateEntry(serviceId, (entry) => ({
        ...entry,
        values: {
          ...entry.values,
          vatRate: clamped,
        },
      }));
    },
    [updateEntry, vatUiEnabled],
  );

  const handleVatModeChange = useCallback(
    (serviceId: string, value: VatModeOption) => {
      if (!vatUiEnabled) return;
      updateEntry(serviceId, (entry) => ({
        ...entry,
        values: {
          ...entry.values,
          vatMode: value,
        },
      }));
    },
    [updateEntry, vatUiEnabled],
  );

  const handleSubmit = useCallback(async () => {
    setIsSaving(true);
    try {
      const payload: ProjectServiceQuickEditResult[] = [];
      selectionMap.forEach((entry, serviceId) => {
        const overrides: ProjectServiceQuickEditResult["overrides"] = {};
        if (isPricingDirty(entry)) {
          overrides.unitCost = entry.values.unitCost;
          overrides.unitPrice = entry.values.unitPrice;
        }
        if (isVatDirty(entry, vatUiEnabled)) {
          overrides.vatMode = entry.values.vatMode;
          overrides.vatRate = entry.values.vatRate;
        }
        payload.push({
          serviceId,
          projectServiceId: entry.projectServiceId,
          billingType: mode,
          quantity: entry.quantity,
          overrides,
        });
      });

      await onSubmit(payload);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  }, [mode, onOpenChange, onSubmit, selectionMap, vatUiEnabled]);

  const isCatalogLocked = isInGuidedSetup && !isOnboardingComplete;
  const catalogDescriptionKey = isCatalogLocked
    ? "payments.services.catalog_notice_onboarding_description"
    : "payments.services.catalog_notice_description";

  return (
    <>
      <AppSheetModal
      title={
        mode === "included"
          ? t("payments.services.quick_edit_included_title", {
              defaultValue: "Manage included services",
            })
          : t("payments.services.quick_edit_extra_title", {
              defaultValue: "Manage add-on services",
            })
      }
      isOpen={open}
      onOpenChange={onOpenChange}
      size="md"
      footerActions={[
        {
          label: t("buttons.cancel", { defaultValue: "Cancel" }),
          onClick: () => onOpenChange(false),
          variant: "outline" as const,
          disabled: isSaving,
        },
        {
          label: isSaving
            ? t("payments.updating", { defaultValue: "Updating..." })
            : t("payments.services.quick_edit_save", { defaultValue: "Save services" }),
          onClick: handleSubmit,
          disabled: isSaving,
          loading: isSaving,
        },
      ]}
    >
      <div className="space-y-4">
        <Alert className="border-amber-200/80 bg-amber-50 text-amber-900">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
            <div className="space-y-1">
              <AlertTitle className="text-sm font-semibold text-amber-900">
                {t("payments.services.catalog_notice_title", {
                  defaultValue: "Services come from Settings \u2192 Services",
                })}
              </AlertTitle>
              <AlertDescription className="text-sm text-amber-900/90">
                <span className="block">
                  {t(catalogDescriptionKey, {
                    defaultValue: isCatalogLocked
                      ? "This list pulls from your Services catalog in Settings. Once onboarding is done, you can manage services there."
                      : "This list pulls from your Services catalog in Settings. Add new services or adjust details there, then include them here.",
                  })}
                </span>
                {isCatalogLocked ? null : (
                  <a
                    href="/settings/services#services"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 font-semibold text-amber-800 underline underline-offset-4 hover:text-amber-900"
                  >
                    {t("payments.services.catalog_notice_action", {
                      defaultValue: "Open Services in Settings",
                    })}
                  </a>
                )}
              </AlertDescription>
            </div>
          </div>
        </Alert>
        <p className="text-sm text-muted-foreground">{helperNote}</p>
        <ServiceInventorySelector
          services={inventoryServices}
          selected={selectedQuantities}
          labels={inventoryLabels}
          onAdd={addService}
          onIncrease={(serviceId) =>
            setSelectionMap((previous) => {
              const current = previous.get(serviceId);
              if (!current) return previous;
              const next = new Map(previous);
              next.set(serviceId, {
                ...current,
                quantity: Math.max(1, current.quantity + 1),
              });
              return next;
            })
          }
          onDecrease={(serviceId) =>
            setSelectionMap((previous) => {
              const current = previous.get(serviceId);
              if (!current) return previous;
              const nextQuantity = Math.max(0, current.quantity - 1);
              if (nextQuantity === 0) {
                const next = new Map(previous);
                next.delete(serviceId);
                return next;
              }
              const next = new Map(previous);
              next.set(serviceId, {
                ...current,
                quantity: nextQuantity,
              });
              return next;
            })
          }
          onSetQuantity={setQuantity}
          onRemove={removeService}
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
          renderSelectedActions={({ service }) => {
            const entry = selectionMap.get(service.id);
            if (!entry) return null;
            const pricingDirty = isPricingDirty(entry);
            const vatDirty = isVatDirty(entry, vatUiEnabled);
            const showVatButton = vatUiEnabled && (entry.openPricing || entry.openVat);
            return (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 text-emerald-600"
                  onClick={() => togglePricing(service.id)}
                >
                  {entry.openPricing || pricingDirty
                    ? tProject("steps.packages.actions.resetPricing", {
                        defaultValue: "Reset price",
                      })
                    : tProject("steps.packages.actions.editPricing", {
                        defaultValue: "Edit prices",
                      })}
                </Button>
                {showVatButton ? (
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 text-emerald-600"
                    onClick={() => toggleVat(service.id)}
                  >
                    {entry.openVat || vatDirty
                      ? tProject("steps.packages.actions.resetVat", {
                          defaultValue: "Reset VAT",
                        })
                      : tProject("steps.packages.actions.editVat", {
                          defaultValue: "Adjust VAT",
                        })}
                  </Button>
                ) : null}
              </div>
            );
          }}
          renderSelectedContent={({ service }) => {
            const entry = selectionMap.get(service.id);
            if (!entry || (!entry.openPricing && !entry.openVat)) {
              return null;
            }

            return (
              <div className="space-y-4 rounded-xl border border-emerald-100 bg-white/90 p-4 shadow-sm">
                {entry.openPricing ? (
                  <div className="grid gap-3 sm:grid-cols-[repeat(2,minmax(0,200px))]">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {tProject("steps.packages.list.unitCost", { defaultValue: "Unit cost" })}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={entry.values.unitCost ?? ""}
                        onChange={(event) => handleNumericChange(service.id, "unitCost", event.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {tProject("steps.packages.list.unitPrice", { defaultValue: "Unit price" })}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={entry.values.unitPrice ?? ""}
                        onChange={(event) => handleNumericChange(service.id, "unitPrice", event.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>
                ) : null}

                {vatUiEnabled && entry.openVat ? (
                  <div className="grid gap-3 sm:grid-cols-[repeat(2,minmax(0,200px))]">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {tProject("steps.packages.vatControls.modeLabel", { defaultValue: "VAT mode" })}
                      </Label>
                      <Select
                        value={entry.values.vatMode}
                        onValueChange={(value) => handleVatModeChange(service.id, value as VatModeOption)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
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
                        {tProject("steps.packages.vatControls.rateLabel", { defaultValue: "VAT rate (%)" })}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={99.99}
                        step="0.01"
                        value={entry.values.vatRate ?? ""}
                        onChange={(event) => handleVatRateChange(service.id, event.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          }}
        />
        {mode === "extra" && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {t("payments.services.quick_edit_extra_notice", {
              defaultValue: "Remember to review pricing for new add-on services.",
            })}
          </div>
        )}
      </div>
      </AppSheetModal>
      <AlertDialog
        open={pendingReset !== null}
        onOpenChange={(open) => {
          if (!open) {
            handleCancelReset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{resetDialogStrings?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {resetDialogStrings?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReset}>
              {resetDialogStrings?.cancel ?? t("buttons.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetDialogStrings?.confirm ?? t("buttons.confirm", { defaultValue: "Confirm" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
