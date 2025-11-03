import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HelperTooltip } from "./HelperTooltip";

export type VatModeOption = "inclusive" | "exclusive";

export interface ServiceVatOverridesMeta {
  label: string;
  variant?: "text" | "badge";
}

export interface ServiceVatOverridesItem {
  id: string;
  name: string;
  vatRate: string;
  vatMode: VatModeOption;
  meta?: ServiceVatOverridesMeta[];
}

export interface ServiceVatOverridesSectionProps {
  title: string;
  description: string;
  tooltipLabel: string;
  tooltipContent: string;
  toggleButtonLabel: string;
  isOpen: boolean;
  onToggle(): void;
  items: ServiceVatOverridesItem[];
  rateLabel: string;
  modeLabel: string;
  modeOptions: Array<{ value: VatModeOption; label: string }>;
  onRateChange(itemId: string, value: string): void;
  onModeChange(itemId: string, mode: VatModeOption): void;
  emptyMessage?: string;
}

export const ServiceVatOverridesSection = ({
  title,
  description,
  tooltipLabel,
  tooltipContent,
  toggleButtonLabel,
  isOpen,
  onToggle,
  items,
  rateLabel,
  modeLabel,
  modeOptions,
  onRateChange,
  onModeChange,
  emptyMessage,
}: ServiceVatOverridesSectionProps) => (
  <section className="space-y-4 rounded-2xl border border-border/70 bg-white/80 p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1 max-w-xl">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <HelperTooltip label={tooltipLabel} content={tooltipContent} />
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-0 text-xs font-semibold"
          onClick={onToggle}
        >
          {toggleButtonLabel}
        </Button>
      </div>
    </div>
    {isOpen ? (
      items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border/60 bg-white/95 p-4 shadow-sm transition-shadow hover:shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-[220px] space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  {item.meta?.length ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {item.meta.map((meta, index) =>
                        meta.variant === "badge" ? (
                          <Badge
                            key={`${item.id}-meta-${index}`}
                            variant="outline"
                            className="text-[10px] uppercase tracking-wide"
                          >
                            {meta.label}
                          </Badge>
                        ) : (
                          <span key={`${item.id}-meta-${index}`}>{meta.label}</span>
                        )
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {rateLabel}
                  </Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={99.99}
                    step="0.01"
                    value={item.vatRate}
                    onChange={(event) => onRateChange(item.id, event.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {modeLabel}
                  </Label>
                  <Select
                    value={item.vatMode}
                    onValueChange={(value) => onModeChange(item.id, value as VatModeOption)}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : emptyMessage ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : null
    ) : null}
  </section>
);
