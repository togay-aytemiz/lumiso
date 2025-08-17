import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type PickerService = {
  id: string;
  name: string;
  category?: string | null;
  cost_price?: number | null;
  selling_price?: number | null;
  price?: number | null;
  salesCurrency?: string | null; // optional, defaults to TRY
  isActive?: boolean;
};

interface ServicePickerProps {
  services: PickerService[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const formatCurrency = (amount: number, currency?: string | null) => {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: (currency || "TRY") as Intl.NumberFormatOptions["currency"],
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₺${amount}`;
  }
};

export function ServicePicker({
  services,
  value,
  onChange,
  disabled,
  isLoading,
  error,
  onRetry,
}: ServicePickerProps) {
  const [openItems, setOpenItems] = useState<string[]>([]);

  const grouped = useMemo(() => {
    const groups: Record<string, PickerService[]> = {};
    (services || []).forEach((s) => {
      const key = s.category || "Uncategorized";
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    // sort services by name inside each group
    Object.keys(groups).forEach((k) => groups[k].sort((a, b) => a.name.localeCompare(b.name)));
    return groups;
  }, [services]);

  const categories = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  const toggle = (id: string) => {
    if (disabled) return;
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  const clearAll = () => onChange([]);

  const selectedServices = useMemo(
    () => services.filter((s) => value.includes(s.id)),
    [services, value]
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-between rounded-md border p-3 text-sm">
        <span className="text-destructive">{error}</span>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} className="h-8">
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Accordion for service selection */}
      <Accordion
        type="multiple"
        value={openItems}
        onValueChange={(v) => setOpenItems(v as string[])}
        className="w-full"
      >
        {categories.map((category) => {
          const items = grouped[category] || [];
          const selectedCount = items.filter((s) => value.includes(s.id)).length;
          return (
            <AccordionItem key={category} value={category} className="border rounded-md mb-3">
              <AccordionTrigger className="px-3 py-2 text-sm">
                <div className="flex w-full items-center justify-between">
                  <span className="font-medium">{category}</span>
                  <span className="text-xs text-muted-foreground">
                    {selectedCount}/{items.length}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="px-3 pb-3">
                  <div className="flex flex-wrap gap-2">
                    {items.map((service) => {
                      const selected = value.includes(service.id);
                      const costPrice = service.cost_price ?? 0;
                      const sellingPrice = service.selling_price ?? service.price ?? 0;
                      const hasPrices = costPrice > 0 || sellingPrice > 0;
                      return (
                        <Button
                          key={service.id}
                          type="button"
                          variant={selected ? "default" : "secondary"}
                          onClick={() => toggle(service.id)}
                          disabled={disabled || service.isActive === false}
                          className={cn(
                            "h-8 rounded-full px-3 text-xs justify-start whitespace-nowrap",
                            "overflow-hidden text-ellipsis",
                            selected ? "" : "border",
                          )}
                          title={`${service.name}${hasPrices ? ` - Cost: ₺${costPrice}, Selling: ₺${sellingPrice}` : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            {selected && <Check className="h-3 w-3" aria-hidden />}
                            <span>
                              {service.name}
                              {hasPrices && (
                                <>
                                  <span className="mx-1">·</span>
                                  <span className={selected ? "text-primary-foreground/80" : "text-muted-foreground"}>
                                    ₺{costPrice}/₺{sellingPrice}
                                  </span>
                                </>
                              )}
                            </span>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Selected services display */}
      {selectedServices.length > 0 && (
        <div className="rounded-md border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Selected Services ({selectedServices.length})</span>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              disabled={disabled}
              className="h-8"
            >
              Clear All
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedServices.map((service) => {
              const costPrice = service.cost_price ?? 0;
              const sellingPrice = service.selling_price ?? service.price ?? 0;
              const hasPrices = costPrice > 0 || sellingPrice > 0;
              return (
                <Badge
                  key={service.id}
                  variant="secondary"
                  className="h-7 rounded-full px-3 text-xs"
                >
                  <span>
                    {service.name}
                    {hasPrices && (
                      <>
                        <span className="mx-1">·</span>
                        <span className="text-foreground/70">₺{costPrice}/₺{sellingPrice}</span>
                      </>
                    )}
                  </span>
                  <button
                    className="ml-2 inline-flex rounded-full p-0.5 hover:text-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(service.id);
                    }}
                    aria-label={`Remove ${service.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
