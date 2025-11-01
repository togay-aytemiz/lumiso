import { useMemo } from "react";
import { LucideIcon, FolderOpen, Layers, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { cn } from "@/lib/utils";

export type ServiceInventoryType = "coverage" | "deliverable" | "unknown";

export interface ServiceInventoryItem {
  id: string;
  name: string;
  category?: string | null;
  serviceType?: ServiceInventoryType | null;
  vendorName?: string | null;
  unitCost?: number | null;
  unitPrice?: number | null;
  isActive?: boolean | null;
}

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
  selectedPill: (quantity: number) => string;
  retry?: string;
}

interface ServiceInventorySelectorProps {
  services: ServiceInventoryItem[];
  selected: Record<string, number>;
  labels: ServiceInventoryLabels;
  onAdd(serviceId: string): void;
  onIncrease(serviceId: string): void;
  onDecrease(serviceId: string): void;
  onRemove(serviceId: string): void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const typeOrder: ServiceInventoryType[] = ["coverage", "deliverable", "unknown"];

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
  onRemove,
  isLoading,
  error,
  onRetry,
}: ServiceInventorySelectorProps) {
  const selectedMap = useMemo(() => new Map(Object.entries(selected || {})), [selected]);

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

  return (
    <div className="space-y-5">
      {typeOrder.map((type) => {
        const categories = groupedByType[type];
        const categoryEntries = Object.entries(categories);
        if (categoryEntries.length === 0) {
          return null;
        }

        const meta = labels.typeMeta[type];
        const IconComponent = meta?.icon ?? (type === "coverage" ? Layers : FolderOpen);
        const totalCount = categoryEntries.reduce((acc, [, items]) => acc + items.length, 0);
        const selectedCount = categoryEntries.reduce(
          (acc, [, items]) => acc + items.filter((item) => selectedMap.has(item.id)).length,
          0
        );

        return (
          <section
            key={type}
            className={cn(
              "space-y-4 rounded-2xl border bg-white/70 p-5 shadow-sm backdrop-blur",
              meta?.borderClassName ?? "border-border/60"
            )}
          >
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full",
                    meta?.iconBackgroundClassName ?? "bg-emerald-50",
                    meta?.iconClassName ?? "text-emerald-600"
                  )}
                >
                  <IconComponent className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{meta?.title}</h3>
                  {meta?.subtitle ? (
                    <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
                  ) : null}
                </div>
              </div>
              <Badge variant="secondary" className="self-start rounded-full text-xs font-medium">
                {selectedCount}/{totalCount}
              </Badge>
            </header>

            <div className="space-y-4">
              {categoryEntries.map(([category, items]) => {
                const categorySelected = items.filter((item) => selectedMap.has(item.id)).length;
                const CategoryIcon = FolderOpen;

                return (
                  <div
                    key={`${type}-${category}`}
                    className="overflow-hidden rounded-xl border border-border/50 bg-muted/20"
                  >
                    <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-muted-foreground">
                          <CategoryIcon className="h-4 w-4" aria-hidden />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{category}</p>
                          <p className="text-xs text-muted-foreground">
                            {categorySelected}/{items.length}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-border/40">
                      {items.map((service) => {
                        const quantity = selectedMap.get(service.id) ?? 0;
                        const isSelected = quantity > 0;
                        const unitCostLabel = formatCurrency(service.unitCost ?? 0);
                        const unitPriceLabel = formatCurrency(service.unitPrice ?? 0);

                        return (
                          <div
                            key={service.id}
                            className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-slate-900">{service.name}</p>
                                {isSelected ? (
                                  <Badge variant="outline" className="rounded-full text-[11px]">
                                    {labels.selectedPill(quantity)}
                                  </Badge>
                                ) : null}
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
                            </div>

                            <div className="flex items-center gap-2">
                              {isSelected ? (
                                <>
                                  <div className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1 py-1 shadow-inner">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => onDecrease(service.id)}
                                      aria-label={labels.decrease}
                                      className="h-7 w-7"
                                    >
                                      –
                                    </Button>
                                    <span className="w-8 text-center text-sm font-semibold text-slate-900">
                                      {quantity}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => onIncrease(service.id)}
                                      aria-label={labels.increase}
                                      className="h-7 w-7"
                                    >
                                      +
                                    </Button>
                                  </div>
                                  <IconActionButton
                                    onClick={() => onRemove(service.id)}
                                    aria-label={labels.remove}
                                    variant="danger"
                                    className="h-8 w-8"
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
                                  className="h-8 rounded-full px-3 text-xs"
                                >
                                  {labels.add}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
