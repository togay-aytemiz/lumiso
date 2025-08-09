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
      <Accordion
        type="multiple"
        value={openItems}
        onValueChange={(v) => setOpenItems(v as string[])}
        className="w-full"
      >
        {categories.map((cat) => {
          const items = grouped[cat] || [];
          const selectedCount = items.filter((s) => value.includes(s.id)).length;
          return (
            <AccordionItem key={cat} value={cat} className="border rounded-md">
              <AccordionTrigger className="px-3 py-2 text-sm">
                <div className="flex w-full items-center justify-between">
                  <span className="font-medium">{cat}</span>
                  <span className="text-xs text-muted-foreground">
                    {selectedCount}/{items.length}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="px-3 pb-3">
                  <div
                    className={cn(
                      "flex flex-wrap gap-2 sm:grid sm:grid-cols-2",
                      "[&>*]:h-8 [&>*]:rounded-full"
                    )}
                  >
                    {items.map((s) => {
                      const selected = value.includes(s.id);
                      const price = s.selling_price ?? s.price ?? 0;
                      return (
                        <Button
                          key={s.id}
                          type="button"
                          variant={selected ? "default" : "secondary"}
                          onClick={() => toggle(s.id)}
                          disabled={disabled || s.isActive === false}
                          className={cn(
                            "justify-start whitespace-nowrap",
                            "overflow-hidden text-ellipsis",
                            "px-3",
                            selected ? "" : "border",
                          )}
                          title={`${s.name} · ${formatCurrency(price, s.salesCurrency)}`}
                        >
                          <div className="flex items-center gap-2">
                            {selected && <Check className="h-4 w-4" aria-hidden />}
                            <span className="text-sm">
                              {s.name}
                              <span className="mx-1">·</span>
                              <span className="text-muted-foreground">
                                {formatCurrency(price, s.salesCurrency)}
                              </span>
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

      <div className="rounded-md border p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Selected</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={disabled || value.length === 0}
            className="h-7"
          >
            Clear all
          </Button>
        </div>
        {selectedServices.length === 0 ? (
          <div className="text-xs text-muted-foreground">No services selected</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedServices.map((s) => {
              const price = s.selling_price ?? s.price ?? 0;
              return (
                <Badge
                  key={s.id}
                  variant="secondary"
                  className="h-7 rounded-full px-3 text-xs"
                >
                  <span>
                    {s.name}
                    <span className="mx-1">·</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(price, s.salesCurrency)}
                    </span>
                  </span>
                  <button
                    className="ml-2 inline-flex rounded-full p-0.5 hover:text-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(s.id);
                    }}
                    aria-label={`Remove ${s.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
