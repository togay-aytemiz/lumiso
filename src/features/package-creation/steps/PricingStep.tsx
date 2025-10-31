import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Badge } from "@/components/ui/badge";
import { ToggleSection } from "@/components/ui/toggle-section";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { usePackageCreationContext } from "../hooks/usePackageCreationContext";
import { usePackageCreationActions } from "../hooks/usePackageCreationActions";
import type { PackageCreationPricingState } from "../types";

const PERCENT_PRESETS = [5, 10, 25, 50];

export const PricingStep = () => {
  const { t } = useTranslation("packageCreation");
  const { state } = usePackageCreationContext();
  const { updatePricing } = usePackageCreationActions();

  const servicesTotal = useMemo(() => {
    return state.services.items.reduce((sum, item) => {
      const quantity = Math.max(1, item.quantity ?? 1);
      const unit = Number(item.unitPrice ?? 0);
      return sum + quantity * unit;
    }, 0);
  }, [state.services.items]);

  const basePrice = parseAmount(state.pricing.basePrice);
  const includeAddOns = state.pricing.includeAddOnsInPrice ?? true;
  const subtotal = basePrice + servicesTotal;
  const pricingMode = includeAddOns ? "inclusive" : "addOns";
  const clientTotal = includeAddOns ? basePrice : subtotal;
  const basePriceHelper = includeAddOns
    ? t("steps.pricing.basePrice.helperInclusive")
    : t("steps.pricing.basePrice.helperAddOns");

  const isPercentMode = state.pricing.depositMode !== "fixed";
  const percentTarget =
    state.pricing.depositMode === "percent_base" ? "base" : "subtotal";
  const depositEnabled = state.pricing.enableDeposit;

  const depositValue = parseAmount(state.pricing.depositValue);
  const percentCalculationTarget =
    percentTarget === "base"
      ? basePrice
      : includeAddOns
      ? clientTotal
      : subtotal;
  const depositAmount = isPercentMode
    ? calculatePercentDeposit(percentCalculationTarget, depositValue)
    : depositValue;

  const handleBasePriceChange = (value: string) => {
    updatePricing({ basePrice: sanitizeMoneyInput(value) });
  };

  const handleDepositModeChange = (value: string) => {
    if (value === "percent") {
      updatePricing({
        depositMode:
          percentTarget === "base" ? "percent_base" : "percent_subtotal",
      });
    } else {
      updatePricing({ depositMode: "fixed" });
    }
  };

  const handlePercentTargetChange = (value: string) => {
    if (value === "base") {
      updatePricing({ depositMode: "percent_base" });
    } else if (value === "subtotal") {
      updatePricing({ depositMode: "percent_subtotal" });
    }
  };

  const handleDepositValueChange = (value: string) => {
    updatePricing({ depositValue: sanitizeMoneyInput(value) });
  };

  const applyPercentPreset = (percent: number) => {
    updatePricing({ depositValue: String(percent) });
  };

  const handleDepositToggle = (enabled: boolean) => {
    if (enabled) {
      updatePricing({ enableDeposit: true });
      return;
    }
    updatePricing({
      enableDeposit: false,
      depositValue: "",
      depositMode: "percent_subtotal",
    });
  };

  const handlePricingModeChange = (mode: string) => {
    if (mode === "inclusive") {
      const next: Partial<PackageCreationPricingState> = {
        includeAddOnsInPrice: true,
      };
      if (state.pricing.depositMode === "percent_subtotal") {
        next.depositMode = "percent_base";
      }
      updatePricing(next);
      return;
    }

    updatePricing({ includeAddOnsInPrice: false });
  };

  const descriptionText = includeAddOns
    ? t("steps.pricing.descriptionInclusive", {
        amount: formatCurrency(clientTotal),
      })
    : t("steps.pricing.descriptionAddOns", {
        amount: formatCurrency(clientTotal),
      });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {t("steps.pricing.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{descriptionText}</p>
      </div>

      <div className="space-y-6">
        <section className="space-y-3">
          <Label htmlFor="package-base-price">
            {t("steps.pricing.basePrice.label")}
          </Label>
          <Input
            id="package-base-price"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={state.pricing.basePrice}
            onChange={(event) => handleBasePriceChange(event.target.value)}
            placeholder={t("steps.pricing.basePrice.placeholder")}
            className="w-full max-w-md"
          />
          <p className="text-xs text-muted-foreground">{basePriceHelper}</p>
        </section>

        <section className="space-y-3">
          <div className="grid gap-2 sm:max-w-md">
            <SummaryRow
              label={t("steps.pricing.summary.packagePrice")}
              value={formatCurrency(basePrice)}
            />
            <SummaryRow
              label={t("steps.pricing.summary.servicesTotal")}
              value={formatCurrency(servicesTotal)}
            />
            <SummaryRow
              label={t("steps.pricing.summary.addOnsClientTotal")}
              value={formatCurrency(subtotal)}
              emphasize
              collapsed={includeAddOns}
            />
          </div>
        </section>

        <section className="space-y-3">
          <Label>{t("steps.pricing.includeAddOns.title")}</Label>
          <RadioGroup
            value={pricingMode}
            onValueChange={handlePricingModeChange}
            className="grid gap-3 sm:grid-cols-2"
          >
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl border bg-white/95 p-4 shadow-sm transition-all duration-200 ease-out",
                pricingMode === "inclusive"
                  ? "border-primary/40 ring-2 ring-primary/10"
                  : "border-border hover:border-primary/40"
              )}
            >
              <RadioGroupItem value="inclusive" className="mt-1" />
              <div className="flex-1 space-y-1 text-sm leading-tight sm:max-w-[200px]">
                <p className="font-semibold text-slate-900 leading-snug">
                  {t("steps.pricing.includeAddOns.optionInclusive.title")}
                </p>
                <p className="text-xs text-muted-foreground leading-snug">
                  {t("steps.pricing.includeAddOns.optionInclusive.description")}
                </p>
              </div>
            </label>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl border bg-white/95 p-4 shadow-sm transition-all duration-200 ease-out",
                pricingMode === "addOns"
                  ? "border-primary/40 ring-2 ring-primary/10"
                  : "border-border hover:border-primary/40"
              )}
            >
              <RadioGroupItem value="addOns" className="mt-1" />
              <div className="flex-1 space-y-1 text-sm leading-tight sm:max-w-[220px]">
                <p className="font-semibold text-slate-900 leading-snug">
                  {t("steps.pricing.includeAddOns.optionAddOns.title")}
                </p>
                <p className="text-xs text-muted-foreground leading-snug">
                  {t("steps.pricing.includeAddOns.optionAddOns.description")}
                </p>
              </div>
            </label>
          </RadioGroup>
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
            <div className="space-y-1">
              <span className="font-medium text-slate-900">
                {t("steps.pricing.includeAddOns.clientTotalLabel")}
              </span>
              <p className="text-xs text-muted-foreground">
                {pricingMode === "addOns"
                  ? t("steps.pricing.includeAddOns.helperAddOns")
                  : t("steps.pricing.includeAddOns.helperInclusive")}
              </p>
            </div>
            <Badge variant="outline" className="text-base font-semibold">
              {formatCurrency(clientTotal)}
            </Badge>
          </div>
        </section>

        <ToggleSection
          title={t("steps.pricing.deposit.label")}
          description={t("steps.pricing.deposit.description", {
            defaultValue: "Collect an upfront payment to secure bookings.",
          })}
          enabled={depositEnabled}
          onToggle={handleDepositToggle}
          summary={
            depositEnabled
              ? `${formatCurrency(depositAmount)} · ${
                  state.pricing.depositMode === "fixed"
                    ? t("steps.pricing.deposit.fixedOption")
                    : t("steps.pricing.deposit.percentOption")
                }`
              : t("steps.pricing.deposit.disabled", {
                  defaultValue: "Not enabled",
                })
          }
        >
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("steps.pricing.deposit.modeTitle", {
                  defaultValue: "Deposit type",
                })}
              </p>
              <SegmentedControl
                value={isPercentMode ? "percent" : "fixed"}
                onValueChange={handleDepositModeChange}
                options={[
                  {
                    value: "percent",
                    label: t("steps.pricing.deposit.percentOption"),
                  },
                  {
                    value: "fixed",
                    label: t("steps.pricing.deposit.fixedOption"),
                  },
                ]}
              />
            </div>

            {isPercentMode ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("steps.pricing.deposit.percentTarget.label")}
                  </p>
                  <div className="space-y-2">
                    <div
                      className={cn(
                        "overflow-hidden transition-all duration-200 ease-out",
                        includeAddOns
                          ? "max-h-20 opacity-100 translate-y-0"
                          : "max-h-0 opacity-0 -translate-y-1"
                      )}
                    >
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-muted-foreground">
                        {t("steps.pricing.deposit.percentTarget.autoPackage")}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "overflow-hidden transition-all duration-200 ease-out",
                        includeAddOns
                          ? "max-h-0 opacity-0 -translate-y-1"
                          : "max-h-24 opacity-100 translate-y-0"
                      )}
                    >
                      <SegmentedControl
                        value={percentTarget}
                        onValueChange={handlePercentTargetChange}
                        options={[
                          {
                            value: "subtotal",
                            label: t(
                              "steps.pricing.deposit.percentTarget.subtotal"
                            ),
                          },
                          {
                            value: "base",
                            label: t(
                              "steps.pricing.deposit.percentTarget.base"
                            ),
                          },
                        ]}
                        className="max-w-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {PERCENT_PRESETS.map((percent) => (
                    <Button
                      key={percent}
                      variant={
                        state.pricing.depositValue === String(percent)
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => applyPercentPreset(percent)}
                    >
                      {percent}%
                    </Button>
                  ))}
                  <div className="flex items-center gap-1">
                    <Label htmlFor="deposit-custom-percent" className="sr-only">
                      {t("steps.pricing.deposit.customPercentLabel", {
                        defaultValue: "Custom percent",
                      })}
                    </Label>
                    <Input
                      id="deposit-custom-percent"
                      className="h-9 w-24 text-right"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={state.pricing.depositValue}
                      onChange={(event) =>
                        handleDepositValueChange(event.target.value)
                      }
                      placeholder={t(
                        "steps.pricing.deposit.customPercentPlaceholder"
                      )}
                    />
                    <span className="text-xs font-medium text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("steps.pricing.deposit.percentHelper")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label
                  htmlFor="deposit-fixed"
                  className="text-xs text-muted-foreground"
                >
                  {t("steps.pricing.deposit.fixedLabel")}
                </Label>
                <Input
                  id="deposit-fixed"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={state.pricing.depositValue}
                  onChange={(event) =>
                    handleDepositValueChange(event.target.value)
                  }
                  placeholder={t("steps.pricing.deposit.fixedPlaceholder")}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  {t("steps.pricing.deposit.fixedHelper")}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
              <span className="font-medium text-slate-900">
                {clientTotal > 0
                  ? t("steps.pricing.deposit.preview")
                  : t("steps.pricing.deposit.baseRequired", {
                      defaultValue: "Enter a base price to calculate deposit",
                    })}
              </span>
              <Badge variant="outline" className="text-base font-semibold">
                {formatCurrency(clientTotal > 0 ? depositAmount : 0)}
              </Badge>
            </div>
          </div>
        </ToggleSection>
      </div>
    </div>
  );
};

function parseAmount(value: string | number | null | undefined) {
  if (!value) return 0;
  const numeric =
    typeof value === "string"
      ? parseFloat(value.replace(/[^0-9.,-]/g, "").replace(",", "."))
      : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function sanitizeMoneyInput(value: string) {
  return value.replace(/[^0-9.,]/g, "");
}

function calculatePercentDeposit(base: number, percent: number) {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return (base * percent) / 100;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
  }).format(amount);
}

const SummaryRow = ({
  label,
  value,
  emphasize = false,
  collapsed = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  collapsed?: boolean;
}) => (
  <div
    className={cn(
      "overflow-hidden transition-all duration-200 ease-out",
      collapsed
        ? "max-h-0 opacity-0 -translate-y-1"
        : "max-h-24 opacity-100 translate-y-0"
    )}
  >
    <div
      className={cn(
        "flex w-full items-center justify-between rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-sm shadow-sm transition-colors duration-200",
        emphasize
          ? "border-primary/40 bg-primary/5 font-semibold text-slate-900"
          : "text-slate-700"
      )}
    >
      <span className={emphasize ? "text-slate-900" : "text-muted-foreground"}>
        {label}
      </span>
      <span
        className={
          emphasize
            ? "font-semibold text-slate-900"
            : "font-medium text-slate-900"
        }
      >
        {value}
      </span>
    </div>
  </div>
);
