import { useCallback, useEffect, useMemo, useState } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ServiceInventorySelector,
  type ServiceInventoryItem,
  type ServiceInventoryLabels,
  type ServiceInventoryType
} from "./ServiceInventorySelector";
import { useTranslation } from "react-i18next";

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

interface ProjectServicesQuickEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "included" | "extra";
  services: QuickServiceRecord[];
  selectedIds: string[];
  conflictingIds: Set<string>;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSubmit: (ids: string[]) => Promise<void> | void;
}

export function ProjectServicesQuickEditDialog({
  open,
  onOpenChange,
  mode,
  services,
  selectedIds,
  conflictingIds,
  isLoading,
  error,
  onRetry,
  onSubmit
}: ProjectServicesQuickEditDialogProps) {
  const { t } = useFormsTranslation();
  const { t: tProject } = useTranslation("projectCreation");
  const { t: tCommon } = useTranslation("common");

  const [localSelection, setLocalSelection] = useState<Record<string, number>>(() => {
    return Object.fromEntries(selectedIds.map((id) => [id, 1]));
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalSelection(Object.fromEntries(selectedIds.map((id) => [id, 1])));
    }
  }, [open, selectedIds]);

  const helperNote = useMemo(() => {
    if (mode === "included") {
      return t("payments.services.quick_edit_included_helper", {
        defaultValue: "Included services are covered by your package price."
      });
    }
    return t("payments.services.quick_edit_extra_helper", {
      defaultValue: "Add-on services are billed on top of the package price."
    });
  }, [mode, t]);

  const conflictingCount = useMemo(
    () => services.filter((service) => conflictingIds.has(service.id)).length,
    [services, conflictingIds]
  );

  const inventoryServices = useMemo<ServiceInventoryItem[]>(
    () =>
      services.map((service) => ({
        id: service.id,
        name: service.name,
        category: service.category ?? undefined,
        serviceType: (service.service_type ?? undefined) as ServiceInventoryType | undefined,
        unitCost: service.cost_price ?? undefined,
        unitPrice: service.selling_price ?? service.price ?? undefined,
        vatRate: service.vat_rate ?? undefined,
        priceIncludesVat: service.price_includes_vat ?? undefined
      })),
    [services]
  );

  const inventoryLabels = useMemo<ServiceInventoryLabels>(() => ({
    typeMeta: {
      coverage: {
        title: tProject("steps.packages.inventory.types.coverage.title", {
          defaultValue: "Crew services"
        }),
        subtitle: tProject("steps.packages.inventory.types.coverage.subtitle", {
          defaultValue: "On-site coverage like photographers or videographers"
        })
      },
      deliverable: {
        title: tProject("steps.packages.inventory.types.deliverable.title", {
          defaultValue: "Deliverables"
        }),
        subtitle: tProject("steps.packages.inventory.types.deliverable.subtitle", {
          defaultValue: "Products delivered after the shoot"
        })
      },
      unknown: {
        title: tProject("steps.packages.inventory.types.unknown.title", {
          defaultValue: "Other services"
        }),
        subtitle: tProject("steps.packages.inventory.types.unknown.subtitle", {
          defaultValue: "Items without a service type yet"
        })
      }
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
      defaultValue: "No services in your catalog yet. Create services to add them here."
    }),
    quantity: tProject("steps.packages.list.quantity", { defaultValue: "Quantity" }),
    selectedTag: (selected, total) =>
      tProject("steps.packages.inventory.selectedTag", {
        defaultValue: "{{selected}} of {{total}} selected",
        selected,
        total
      }),
    quantityTag: (count) =>
      tProject("steps.packages.inventory.quantityTag", {
        defaultValue: "x{{count}}",
        count
      }),
    retry: t("payments.services.retry", { defaultValue: "Retry" })
  }), [t, tCommon, tProject]);

  const setQuantity = useCallback((serviceId: string, quantity: number) => {
    setLocalSelection((prev) => {
      const next = { ...prev };
      if (!quantity || quantity <= 0) {
        delete next[serviceId];
      } else {
        next[serviceId] = 1;
      }
      return next;
    });
  }, []);

  const handleAdd = useCallback((serviceId: string) => {
    setQuantity(serviceId, 1);
  }, [setQuantity]);

  const handleIncrease = useCallback((serviceId: string) => {
    setQuantity(serviceId, 1);
  }, [setQuantity]);

  const handleDecrease = useCallback((serviceId: string) => {
    setQuantity(serviceId, 0);
  }, [setQuantity]);

  const handleRemove = useCallback((serviceId: string) => {
    setQuantity(serviceId, 0);
  }, [setQuantity]);

  const handleSetQuantity = useCallback(
    (serviceId: string, quantity: number) => {
      setQuantity(serviceId, quantity > 0 ? 1 : 0);
    },
    [setQuantity]
  );

  const footerActions = [
    {
      label: t("buttons.cancel", { defaultValue: "Cancel" }),
      onClick: () => onOpenChange(false),
      variant: "outline" as const,
      disabled: isSaving
    },
    {
      label: isSaving
        ? t("payments.updating", { defaultValue: "Updating..." })
        : t("payments.services.quick_edit_save", { defaultValue: "Save services" }),
      onClick: async () => {
        setIsSaving(true);
        await onSubmit(Object.keys(localSelection));
        setIsSaving(false);
        onOpenChange(false);
      },
      disabled: isSaving,
      loading: isSaving
    }
  ];

  const header = (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{helperNote}</p>
      {conflictingCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            {t("payments.services.quick_edit_conflict_badge", {
              count: conflictingCount,
              defaultValue: "{{count}} already assigned"
            })}
          </Badge>
          <span>
            {t("payments.services.quick_edit_conflict_helper", {
              defaultValue: "Selecting a service moves it to this category."
            })}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <AppSheetModal
      title={
        mode === "included"
          ? t("payments.services.quick_edit_included_title", {
              defaultValue: "Manage included services"
            })
          : t("payments.services.quick_edit_extra_title", {
              defaultValue: "Manage add-on services"
            })
      }
      isOpen={open}
      onOpenChange={onOpenChange}
      size="lg"
      footerActions={footerActions}
    >
      <div className="space-y-4">
        {header}
        <ServiceInventorySelector
          services={inventoryServices}
          selected={localSelection}
          labels={inventoryLabels}
          onAdd={handleAdd}
          onIncrease={handleIncrease}
          onDecrease={handleDecrease}
          onSetQuantity={handleSetQuantity}
          onRemove={handleRemove}
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
        />
        {mode === "extra" && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {t("payments.services.quick_edit_extra_notice", {
              defaultValue: "Remember to review pricing for new add-on services."
            })}
          </div>
        )}
      </div>
    </AppSheetModal>
  );
}
