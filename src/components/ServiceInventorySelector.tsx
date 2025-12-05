import { useEffect, useMemo, useState, type ReactNode, useCallback } from "react";
import { LucideIcon, FolderOpen, Layers, Trash2, ChevronDown, Package as PackageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { DEFAULT_CATEGORY_TRANSLATION_MAP, type ServiceType } from "@/constants/serviceCategories";

export type ServiceInventoryType = "coverage" | "deliverable" | "unknown";

export interface ServiceInventoryItem {
  id: string;
  name: string;
  category?: string | null;
  serviceType?: ServiceInventoryType | null;
  vendorName?: string | null;
  unitCost?: number | null;
  unitPrice?: number | null;
  unit?: string | null;
  defaultUnit?: string | null;
  isActive?: boolean | null;
  vatRate?: number | null;
  priceIncludesVat?: boolean | null;
}

type ServiceInventoryTypeStats = {
  totalServices: number;
  selectedServices: number;
  totalQuantity: number;
};

export interface ServiceInventoryLabels {
  typeMeta: Record<
    ServiceInventoryType,
    {
      title: string;
      subtitle?: string;
      icon?: LucideIcon;
      iconClassName?: string;
      iconBackgroundClassName?: string;
      borderClassName?: string;
      segmentedLabel?: (stats: ServiceInventoryTypeStats) => string;
    }
  >;
  add: string;
  decrease: string;
  increase: string;
  remove: string;
  vendor: string;
  unitCost: string;
  unitPrice: string;
  uncategorized: string;
  inactive: string;
  empty: string;
  quantity: string;
  selectedTag: (selected: number, total: number) => string;
  quantityTag: (count: number) => string;
  retry?: string;
}

export interface ServiceInventorySelectedContext {
  service: ServiceInventoryItem;
  quantity: number;
}

interface ServiceInventorySelectorProps {
  services: ServiceInventoryItem[];
  selected: Record<string, number>;
  labels: ServiceInventoryLabels;
  onAdd(serviceId: string): void;
  onIncrease(serviceId: string): void;
  onDecrease(serviceId: string): void;
  onSetQuantity(serviceId: string, quantity: number): void;
  onRemove(serviceId: string): void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  renderSelectedActions?: (
    context: ServiceInventorySelectedContext
  ) => ReactNode;
  renderSelectedContent?: (
    context: ServiceInventorySelectedContext
  ) => ReactNode;
}

const typeOrder: ServiceInventoryType[] = ["deliverable", "coverage", "unknown"];

const formatCurrency = (amount?: number | null) => {
  if (!amount || Number.isNaN(amount)) return "₺0";
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₺${amount}`;
  }
};

export function ServiceInventorySelector({
  services,
  selected,
  labels,
  onAdd,
  onIncrease,
  onDecrease,
  onSetQuantity,
  onRemove,
  isLoading,
  error,
  onRetry,
  renderSelectedActions,
  renderSelectedContent,
}: ServiceInventorySelectorProps) {
  const selectedMap = useMemo(() => new Map(Object.entries(selected || {})), [selected]);
  const { t: tForms } = useTranslation("forms");

  const translateCategory = useCallback(
    (category: string, type: ServiceInventoryType) => {
      const translationKey =
        type === "unknown"
          ? null
          : DEFAULT_CATEGORY_TRANSLATION_MAP[type as ServiceType]?.[category];
      if (translationKey) {
        return tForms(translationKey, { defaultValue: category });
      }
      return category;
    },
    [tForms]
  );

  const groupedByType = useMemo(() => {
    const grouped: Record<ServiceInventoryType, Record<string, ServiceInventoryItem[]>> = {
      coverage: {},
      deliverable: {},
      unknown: {},
    };

    services.forEach((service) => {
      const type = (service.serviceType ?? "unknown") as ServiceInventoryType;
      const categoryKey = service.category?.trim() || labels.uncategorized;
      if (!grouped[type][categoryKey]) {
        grouped[type][categoryKey] = [];
      }
      grouped[type][categoryKey].push(service);
    });

    typeOrder.forEach((type) => {
      Object.keys(grouped[type]).forEach((category) => {
        grouped[type][category].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      });
    });

    return grouped;
  }, [labels.uncategorized, services]);

  const typeStats = useMemo(
    () =>
      typeOrder.reduce<Record<ServiceInventoryType, ServiceInventoryTypeStats>>((acc, type) => {
        const categories = Object.values(groupedByType[type] ?? {});
        const totals = categories.reduce(
          (stats, items) => {
            stats.totalServices += items.length;
            items.forEach((item) => {
              const quantity = selectedMap.get(item.id) ?? 0;
              if (quantity > 0) {
                stats.selectedServices += 1;
                stats.totalQuantity += quantity;
              }
            });
            return stats;
          },
          { totalServices: 0, selectedServices: 0, totalQuantity: 0 }
        );

        acc[type] = totals;
        return acc;
      }, {} as Record<ServiceInventoryType, ServiceInventoryTypeStats>),
    [groupedByType, selectedMap]
  );

  const availableTypes = useMemo(
    () => typeOrder.filter((type) => typeStats[type]?.totalServices > 0),
    [typeStats]
  );

  const [activeType, setActiveType] = useState<ServiceInventoryType>(() => availableTypes[0] ?? "deliverable");

  useEffect(() => {
    if (!availableTypes.includes(activeType)) {
      setActiveType(availableTypes[0] ?? "deliverable");
    }
  }, [availableTypes, activeType]);

  const categoryDefaultOpen = useMemo(() => {
    const defaults: Record<string, boolean> = {};
    typeOrder.forEach((type) => {
      const categories = Object.keys(groupedByType[type] ?? {});
      const shouldExpandByDefault = categories.length <= 1;
      categories.forEach((category) => {
        defaults[`${type}::${category}`] = shouldExpandByDefault;
      });
    });
    return defaults;
  }, [groupedByType]);

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    ...categoryDefaultOpen,
  });

  useEffect(() => {
    setExpandedCategories((previous) => {
      const next = { ...previous };
      let mutates = false;

      Object.entries(categoryDefaultOpen).forEach(([key, defaultOpen]) => {
        if (!(key in next)) {
          next[key] = defaultOpen;
          mutates = true;
        } else if (defaultOpen && !next[key]) {
          next[key] = true;
          mutates = true;
        }
      });

      Object.keys(next).forEach((key) => {
        if (!(key in categoryDefaultOpen)) {
          delete next[key];
          mutates = true;
        }
      });

      return mutates ? next : previous;
    });
  }, [categoryDefaultOpen]);

  const hasServices = services.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 rounded-xl" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2 rounded-2xl border border-border/60 bg-white/60 p-4">
              <Skeleton className="h-6 w-40 rounded" />
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((__, innerIndex) => (
                  <Skeleton key={innerIndex} className="h-12 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        <div>{error}</div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="w-fit">
            {labels.retry ?? "Retry"}
          </Button>
        )}
      </div>
    );
  }

  if (!hasServices) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        {labels.empty}
      </div>
    );
  }

  const resolvedType = availableTypes.includes(activeType) ? activeType : availableTypes[0] ?? "deliverable";
  const activeMeta = labels.typeMeta[resolvedType];
  const activeCategories = Object.entries(groupedByType[resolvedType] ?? {})
    .map(([category, items]) => ({
      category,
      items,
      label: translateCategory(category, resolvedType),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  const activeStats = typeStats[resolvedType] ?? { totalServices: 0, selectedServices: 0, totalQuantity: 0 };
  const ActiveIcon =
    activeMeta?.icon ??
    (resolvedType === "deliverable"
      ? PackageIcon
      : resolvedType === "coverage"
      ? Layers
      : FolderOpen);

  return (
    <div className="space-y-5">
      {availableTypes.length > 1 ? (
        <SegmentedControl
          value={resolvedType}
          onValueChange={(next) => setActiveType(next as ServiceInventoryType)}
          options={availableTypes.map((type) => {
            const meta = labels.typeMeta[type];
            const stats = typeStats[type] ?? { totalServices: 0, selectedServices: 0, totalQuantity: 0 };
            const defaultLabel = `${meta?.title ?? type} (${stats.selectedServices}/${stats.totalServices})`;
            return {
              label: meta?.segmentedLabel ? meta.segmentedLabel(stats) : defaultLabel,
              value: type,
            };
          })}
        />
      ) : null}

      <section
        className={cn(
          "space-y-4 rounded-2xl border bg-white/70 p-5 shadow-sm backdrop-blur",
          activeMeta?.borderClassName ?? "border-border/60"
        )}
      >
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full",
                activeMeta?.iconBackgroundClassName ?? "bg-emerald-50",
                activeMeta?.iconClassName ?? "text-emerald-600"
              )}
            >
              <ActiveIcon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{activeMeta?.title}</h3>
              {activeMeta?.subtitle ? (
                <p className="text-xs text-muted-foreground">{activeMeta.subtitle}</p>
              ) : null}
            </div>
          </div>
          <Badge variant="secondary" className="self-start rounded-full text-xs font-medium">
            {activeStats.selectedServices}/{activeStats.totalServices}
          </Badge>
        </header>

        <div className="space-y-4">
          {activeCategories.map(({ category, items, label }) => {
            const categoryKey = `${resolvedType}::${category}`;
            const isExpanded = expandedCategories[categoryKey] ?? categoryDefaultOpen[categoryKey] ?? false;
            const categorySelected = items.filter((item) => (selectedMap.get(item.id) ?? 0) > 0).length;
            const categoryQuantity = items.reduce((total, item) => total + (selectedMap.get(item.id) ?? 0), 0);
            const hasSelection = categorySelected > 0;
            const selectedTagLabel = labels.selectedTag(categorySelected, items.length);
            const quantityTagLabel = labels.quantityTag(categoryQuantity);

            return (
              <Collapsible
                key={categoryKey}
                open={isExpanded}
                onOpenChange={(nextOpen) =>
                  setExpandedCategories((previous) => ({ ...previous, [categoryKey]: nextOpen }))
                }
                className={cn(
                  "overflow-hidden rounded-xl border border-border/50 bg-muted/20 transition-shadow duration-200",
                  hasSelection && "border-emerald-300/70 bg-emerald-50/30 shadow-sm"
                )}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "group flex w-full flex-col gap-2 border-b border-border/60 px-3 py-2 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3",
                      hasSelection ? "bg-white" : "bg-muted/30 hover:bg-muted/40"
                    )}
                  >
                    <div className="flex w-full items-start gap-3 sm:items-center">
                      <p className="text-sm font-medium text-slate-900">{label}</p>
                      <ChevronDown className="ml-auto h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 sm:ml-0" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:flex-nowrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm whitespace-nowrap",
                          hasSelection
                            ? "border-amber-400/80 bg-amber-50 text-amber-700"
                            : "border-slate-300 bg-slate-100 text-slate-500"
                        )}
                      >
                        {selectedTagLabel}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-muted-foreground shadow-sm whitespace-nowrap"
                      >
                        {quantityTagLabel}
                      </Badge>
                    </div>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent
                  forceMount
                  className="grid grid-rows-[0fr] transition-[grid-template-rows,opacity] duration-250 ease-in-out data-[state=open]:grid-rows-[1fr] data-[state=open]:opacity-100 data-[state=closed]:opacity-0"
                >
                  <div className="divide-y divide-border/40 overflow-hidden">
                    {items.map((service) => {
                      const quantity = selectedMap.get(service.id) ?? 0;
                      const isSelected = quantity > 0;
                      const unitCostLabel = formatCurrency(service.unitCost ?? 0);
                      const unitPriceLabel = formatCurrency(service.unitPrice ?? 0);
                      const context: ServiceInventorySelectedContext = {
                        service,
                        quantity,
                      };

                      return (
                        <div
                          key={service.id}
                          className="space-y-3 px-3 py-3 transition-colors duration-200 data-[selected=true]:bg-emerald-50/40 sm:px-4 sm:py-4"
                          data-selected={isSelected}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-slate-900">{service.name}</p>
                                {service.isActive === false && (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full border-amber-200 bg-amber-50 text-[11px] text-amber-700"
                                  >
                                    {labels.inactive}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span>
                                  {labels.unitCost}: {unitCostLabel}
                                </span>
                                <span>
                                  {labels.unitPrice}: {unitPriceLabel}
                                </span>
                                {service.vendorName ? (
                                  <span>
                                    {labels.vendor}: {service.vendorName}
                                  </span>
                                ) : null}
                              </div>
                              {isSelected && renderSelectedActions ? (
                                <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-emerald-600">
                                  {renderSelectedActions(context)}
                                </div>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-1.5 sm:gap-2">
                              {isSelected ? (
                                <>
                                  <div
                                    className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1 py-1 shadow-inner transition-colors duration-200"
                                    data-touch-target="compact"
                                  >
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => onDecrease(service.id)}
                                      aria-label={labels.decrease}
                                      data-touch-target="compact"
                                      className="h-7 w-7 transition-colors duration-200 sm:h-8 sm:w-8"
                                      disabled={quantity <= 1}
                                    >
                                      –
                                    </Button>
                                    <Input
                                      aria-label={labels.quantity}
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      value={String(quantity)}
                                      onChange={(event) => {
                                        const numeric = event.target.value.replace(/[^0-9]/g, "");
                                        const parsed = parseInt(numeric, 10);
                                        const nextQuantity = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
                                        onSetQuantity(service.id, nextQuantity);
                                      }}
                                      data-touch-target="compact"
                                      className="h-7 w-12 rounded-full border-0 bg-transparent px-0 text-center text-sm font-semibold text-slate-900 focus-visible:ring-0 sm:h-8 sm:w-14"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => onIncrease(service.id)}
                                      aria-label={labels.increase}
                                      data-touch-target="compact"
                                      className="h-7 w-7 transition-colors duration-200 sm:h-8 sm:w-8"
                                    >
                                      +
                                    </Button>
                                  </div>
                                  <IconActionButton
                                    onClick={() => onRemove(service.id)}
                                    aria-label={labels.remove}
                                    variant="danger"
                                    data-touch-target="compact"
                                    className="h-7 w-7 transition-colors duration-200 sm:h-8 sm:w-8"
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden />
                                  </IconActionButton>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={service.isActive === false}
                                  onClick={() => onAdd(service.id)}
                                  aria-label={labels.add}
                                  data-touch-target="compact"
                                  className="h-9 rounded-full px-3 text-xs transition-colors duration-200 sm:h-8"
                                >
                                  {labels.add}
                                </Button>
                              )}
                            </div>
                          </div>
                          {isSelected && renderSelectedContent ? (
                            <div className="space-y-3">
                              {renderSelectedContent(context)}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                 </div>
               </CollapsibleContent>
             </Collapsible>
            );
          })}
        </div>
      </section>
    </div>
  );
}
