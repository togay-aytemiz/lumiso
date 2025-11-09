import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Plus, Minus, Trash2 } from "lucide-react";
import { HelperTooltip } from "./HelperTooltip";

export type VatModeOption = "inclusive" | "exclusive";

export interface CustomServiceFormState {
  name: string;
  cost: string;
  price: string;
  vatRate: string;
  vatMode: VatModeOption;
  vatFormOpen: boolean;
}

export interface CustomServiceItemView {
  id: string;
  name: string;
  quantity: number;
  unitCost?: number | null;
  unitPrice?: number | null;
  unitLabel?: string | null;
  vatRate?: number | null;
  vatMode?: VatModeOption | null;
  vatEditorOpen: boolean;
}

export interface CustomServicesSectionStrings {
  nameLabel: string;
  namePlaceholder?: string;
  costLabel: string;
  costPlaceholder?: string;
  priceLabel: string;
  pricePlaceholder?: string;
  listCostLabel: string;
  listPriceLabel: string;
  addButton: string;
  cancelButton: string;
  vatToggleOpen: string;
  vatToggleClose: string;
  vatRateLabel: string;
  vatRatePlaceholder?: string;
  vatModeLabel: string;
  vatHelper: string;
  vatHelperPerItem: string;
  quantityLabel: string;
  decreaseAriaLabel: string;
  increaseAriaLabel: string;
  removeAriaLabel: string;
  customBadgeLabel?: string;
  emptyState?: string;
}

export interface CustomServicesSectionProps {
  title: string;
  description: string;
  tooltipLabel: string;
  tooltipContent: string;
  toggleButtonLabels: { open: string; close: string };
  open: boolean;
  onToggle(): void;
  form: CustomServiceFormState;
  onFormChange(updates: Partial<CustomServiceFormState>): void;
  onSubmit(): void;
  onCancel(): void;
  error?: string | null;
  strings: CustomServicesSectionStrings;
  vatModeOptions: Array<{ value: VatModeOption; label: string }>;
  onQuickAddVatToggle(): void;
  items: CustomServiceItemView[];
  onItemNameChange(itemId: string, value: string): void;
  onItemCostChange(itemId: string, value: string): void;
  onItemPriceChange(itemId: string, value: string): void;
  onItemQuantityChange(itemId: string, value: string): void;
  onItemAdjustQuantity(itemId: string, delta: number): void;
  onItemRemove(itemId: string): void;
  onItemVatToggle(itemId: string): void;
  onItemVatRateChange(itemId: string, value: string): void;
  onItemVatModeChange(itemId: string, mode: VatModeOption): void;
  vatControlsEnabled?: boolean;
}

export const CustomServicesSection = ({
  title,
  description,
  tooltipLabel,
  tooltipContent,
  toggleButtonLabels,
  open,
  onToggle,
  form,
  onFormChange,
  onSubmit,
  onCancel,
  error,
  strings,
  vatModeOptions,
  onQuickAddVatToggle,
  items,
  onItemNameChange,
  onItemCostChange,
  onItemPriceChange,
  onItemQuantityChange,
  onItemAdjustQuantity,
  onItemRemove,
  onItemVatToggle,
  onItemVatRateChange,
  onItemVatModeChange,
  vatControlsEnabled = true,
}: CustomServicesSectionProps) => {
  const showVatControls = vatControlsEnabled;

  return (
  <section className="space-y-4 rounded-2xl border border-border/70 bg-white/80 p-5 shadow-sm backdrop-blur">
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
          {open ? toggleButtonLabels.close : toggleButtonLabels.open}
        </Button>
      </div>
    </div>

    {open ? (
      <div className="space-y-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-4">
            <Label htmlFor="custom-service-name">{strings.nameLabel}</Label>
            <Input
              id="custom-service-name"
              value={form.name}
              onChange={(event) => onFormChange({ name: event.target.value })}
              placeholder={strings.namePlaceholder}
            />
          </div>
          <div className="sm:col-span-1">
            <Label htmlFor="custom-service-cost">{strings.costLabel}</Label>
            <Input
              id="custom-service-cost"
              type="number"
              min={0}
              step="0.01"
              value={form.cost}
              onChange={(event) => onFormChange({ cost: event.target.value })}
              placeholder={strings.costPlaceholder}
            />
          </div>
          <div className="sm:col-span-1">
            <Label htmlFor="custom-service-price">{strings.priceLabel}</Label>
            <Input
              id="custom-service-price"
              type="number"
              min={0}
              step="0.01"
              value={form.price}
              onChange={(event) => onFormChange({ price: event.target.value })}
              placeholder={strings.pricePlaceholder}
            />
          </div>
        </div>

        {showVatControls ? (
          <>
            <div className="pt-1">
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto px-0 text-xs font-semibold"
                onClick={onQuickAddVatToggle}
              >
                {form.vatFormOpen ? strings.vatToggleClose : strings.vatToggleOpen}
              </Button>
            </div>

            {form.vatFormOpen ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="custom-service-vat-rate">{strings.vatRateLabel}</Label>
                    <Input
                      id="custom-service-vat-rate"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={99.99}
                      step="0.01"
                      value={form.vatRate}
                      onChange={(event) =>
                        onFormChange({ vatRate: event.target.value.replace(/[^0-9.,]/g, "") })
                      }
                      placeholder={strings.vatRatePlaceholder}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{strings.vatModeLabel}</Label>
                    <Select
                      value={form.vatMode}
                      onValueChange={(value) => onFormChange({ vatMode: value as VatModeOption })}
                    >
                      <SelectTrigger className="h-10 w-full">
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
                </div>
                <p className="text-[11px] text-muted-foreground">{strings.vatHelper}</p>
              </>
            ) : null}
          </>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onSubmit}>
            {strings.addButton}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            {strings.cancelButton}
          </Button>
        </div>
      </div>
    ) : null}

    {items.length ? (
      <div className="space-y-3">
        {items.map((item) => {
          const quantityValue = Math.max(1, item.quantity);

          return (
            <div key={item.id} className="rounded-lg border bg-muted/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`custom-item-name-${item.id}`} className="text-xs text-muted-foreground">
                    {strings.nameLabel}
                  </Label>
                  <Input
                    id={`custom-item-name-${item.id}`}
                    value={item.name}
                    onChange={(event) => onItemNameChange(item.id, event.target.value)}
                    className="h-10 w-full"
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                  <div className="space-y-2 sm:w-40 sm:flex-none">
                    <Label className="text-xs text-muted-foreground">{strings.listCostLabel}</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitCost ?? ""}
                      onChange={(event) => onItemCostChange(item.id, event.target.value)}
                      className="h-10 w-full sm:w-40"
                    />
                  </div>
                  <div className="space-y-2 sm:w-40 sm:flex-none">
                    <Label className="text-xs text-muted-foreground">{strings.listPriceLabel}</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitPrice ?? ""}
                      onChange={(event) => onItemPriceChange(item.id, event.target.value)}
                      className="h-10 w-full sm:w-40"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    {strings.quantityLabel}
                  </span>
                  <div className="flex items-center gap-1 rounded-full border px-1 py-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => onItemAdjustQuantity(item.id, -1)}
                      aria-label={strings.decreaseAriaLabel}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={String(quantityValue)}
                      onChange={(event) => onItemQuantityChange(item.id, event.target.value)}
                      className="h-8 w-14 border-0 bg-transparent text-center text-sm font-medium focus-visible:ring-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => onItemAdjustQuantity(item.id, 1)}
                      aria-label={strings.increaseAriaLabel}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {showVatControls ? (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-xs font-semibold"
                    onClick={() => onItemVatToggle(item.id)}
                  >
                    {item.vatEditorOpen ? strings.vatToggleClose : strings.vatToggleOpen}
                  </Button>
                ) : null}

                <IconActionButton
                  onClick={() => onItemRemove(item.id)}
                  aria-label={strings.removeAriaLabel}
                  variant="danger"
                  className="h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </IconActionButton>
              </div>

              {showVatControls && item.vatEditorOpen ? (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {strings.vatRateLabel}
                      </Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={99.99}
                        step="0.01"
                        value={
                          typeof item.vatRate === "number" && Number.isFinite(item.vatRate)
                            ? String(item.vatRate)
                            : ""
                        }
                        onChange={(event) => onItemVatRateChange(item.id, event.target.value)}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {strings.vatModeLabel}
                      </Label>
                      <Select
                        value={item.vatMode ?? vatModeOptions[0]?.value ?? "exclusive"}
                        onValueChange={(value) => onItemVatModeChange(item.id, value as VatModeOption)}
                      >
                        <SelectTrigger className="h-10 w-full">
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
                  </div>
                  <p className="text-[11px] text-muted-foreground">{strings.vatHelperPerItem}</p>
                </div>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>×{quantityValue}</span>
                {item.unitLabel ? <span>· {item.unitLabel}</span> : null}
                {strings.customBadgeLabel ? (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    {strings.customBadgeLabel}
                  </Badge>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    ) : strings.emptyState ? (
      <p className="text-sm text-muted-foreground">{strings.emptyState}</p>
    ) : null}
  </section>
);
};
