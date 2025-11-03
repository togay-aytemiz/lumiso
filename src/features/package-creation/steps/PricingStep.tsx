import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Surface } from "@/components/layout-primitives";
import { SummaryMetric } from "@/components/summary";
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
import { usePackageCreationContext } from "../hooks/usePackageCreationContext";
import { usePackageCreationActions } from "../hooks/usePackageCreationActions";
import type { PackageCreationLineItem, PackageCreationPricingState, PackageVatMode } from "../types";
import { calculateLineItemPricing } from "../utils/lineItemPricing";
import { HelperTooltip } from "@/features/services/components/HelperTooltip";

const PERCENT_PRESETS = [5, 10, 25, 50];

export const PricingStep = () => {
  const { t } = useTranslation("packageCreation");
  const { state } = usePackageCreationContext();
  const { updatePricing, setCurrentStep } = usePackageCreationActions();
  const taxProfileQuery = useOrganizationTaxProfile();
  const taxProfile = taxProfileQuery.data;

  const defaultVatRate = useMemo(() => {
    if (typeof taxProfile?.defaultVatRate === "number" && Number.isFinite(taxProfile.defaultVatRate)) {
      return Number(taxProfile.defaultVatRate);
    }
    return 0;
  }, [taxProfile]);

  const defaultVatMode: PackageVatMode = useMemo(
    () => (taxProfile?.defaultVatMode === "inclusive" ? "inclusive" : "exclusive"),
    [taxProfile]
  );

  useEffect(() => {
    if (!taxProfile) return;
    if (state.pricing.packageVatInitialized) return;

    updatePricing(
      {
        packageVatInitialized: true,
        packageVatRate:
          typeof taxProfile.defaultVatRate === "number" && Number.isFinite(taxProfile.defaultVatRate)
            ? Number(taxProfile.defaultVatRate)
            : 0,
        packageVatMode: taxProfile.defaultVatMode === "inclusive" ? "inclusive" : "exclusive",
      },
      { markDirty: false }
    );
  }, [taxProfile, state.pricing.packageVatInitialized, updatePricing]);

  const servicesTotals = useMemo(() => {
    return state.services.items.reduce(
      (acc, item) => {
        const quantity = Math.max(1, item.quantity ?? 1);
        const unitCost = Number(item.unitCost ?? 0);
        const pricing = calculateLineItemPricing(item);
        acc.cost += unitCost * quantity;
        acc.net += pricing.net;
        acc.vat += pricing.vat;
        acc.gross += pricing.gross;
        return acc;
      },
      { cost: 0, net: 0, vat: 0, gross: 0 }
    );
  }, [state.services.items]);

  const servicesGrossTotal = servicesTotals.gross;
  const servicesNetTotal = servicesTotals.net;
  const servicesVatTotal = servicesTotals.vat;

  const packageVatRate =
    typeof state.pricing.packageVatRate === "number" && Number.isFinite(state.pricing.packageVatRate)
      ? state.pricing.packageVatRate
      : defaultVatRate;
  const packageVatMode: PackageVatMode =
    state.pricing.packageVatMode === "inclusive" || state.pricing.packageVatMode === "exclusive"
      ? state.pricing.packageVatMode
      : defaultVatMode;

  const basePriceInput = parseAmount(state.pricing.basePrice);
  const basePricePricing = useMemo(
    () =>
      calculateLineItemPricing({
        id: "package-base-price",
        type: "custom",
        name: "Package price",
        quantity: 1,
        unitPrice: basePriceInput,
        vatRate: packageVatRate,
        vatMode: packageVatMode,
      } as PackageCreationLineItem),
    [basePriceInput, packageVatMode, packageVatRate]
  );
  const basePriceNet = Math.round(basePricePricing.net * 100) / 100;
  const basePriceVatAmount = Math.round(basePricePricing.vat * 100) / 100;
  const basePriceGross = Math.round(basePricePricing.gross * 100) / 100;

  const includeAddOns = state.pricing.includeAddOnsInPrice ?? true;
  const subtotal = basePriceGross + servicesGrossTotal;
  const pricingMode = includeAddOns ? "inclusive" : "addOns";
  const clientTotal = includeAddOns ? basePriceGross : subtotal;
  const basePriceHelper = includeAddOns
    ? t("steps.pricing.basePrice.helperInclusive")
    : t("steps.pricing.basePrice.helperAddOns");
  const showVatAmount = basePriceVatAmount > 0.0001;
  const packageVatModeLabel = t(`steps.pricing.packageVat.mode.${packageVatMode}`, {
    defaultValue: packageVatMode === "inclusive" ? "Included in price" : "Add on top",
  });
  const packageVatRateInputValue =
    typeof state.pricing.packageVatRate === "number" && Number.isFinite(state.pricing.packageVatRate)
      ? String(state.pricing.packageVatRate)
      : "";
  const [showVatResetPrompt, setShowVatResetPrompt] = useState(false);

  const combinedNet = basePriceNet + (includeAddOns ? 0 : servicesNetTotal);
  const combinedVat = basePriceVatAmount + (includeAddOns ? 0 : servicesVatTotal);
  const combinedGross = basePriceGross + (includeAddOns ? 0 : servicesGrossTotal);
  const isPercentMode = state.pricing.depositMode !== "fixed";
  const percentTarget =
    state.pricing.depositMode === "percent_base" ? "base" : "subtotal";
  const depositEnabled = state.pricing.enableDeposit;

  const depositValue = parseAmount(state.pricing.depositValue);
  const percentCalculationTarget =
    percentTarget === "base"
      ? basePriceGross
      : includeAddOns
      ? clientTotal
      : subtotal;
  const depositAmount = isPercentMode
    ? calculatePercentDeposit(percentCalculationTarget, depositValue)
    : depositValue;

  const handleBasePriceChange = (value: string) => {
    updatePricing({ basePrice: sanitizeMoneyInput(value) });
  };

  const handlePackageVatToggle = (enabled: boolean) => {
    if (enabled) {
      updatePricing({
        packageVatOverrideEnabled: true,
        packageVatInitialized: true,
        packageVatRate:
          typeof state.pricing.packageVatRate === "number" && Number.isFinite(state.pricing.packageVatRate)
            ? state.pricing.packageVatRate
            : defaultVatRate,
        packageVatMode:
          state.pricing.packageVatMode === "inclusive" || state.pricing.packageVatMode === "exclusive"
            ? state.pricing.packageVatMode
            : defaultVatMode,
      });
      return;
    }

    if (hasCustomVatValues) {
      setShowVatResetPrompt(true);
      return;
    }

    updatePricing({
      packageVatOverrideEnabled: false,
      packageVatInitialized: true,
      packageVatRate: defaultVatRate,
      packageVatMode: defaultVatMode,
    });
  };

  const resetPackageVatOverrides = () => {
    updatePricing({
      packageVatOverrideEnabled: false,
      packageVatInitialized: true,
      packageVatRate: defaultVatRate,
      packageVatMode: defaultVatMode,
    });
    setShowVatResetPrompt(false);
  };

  const handlePackageVatRateChange = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      updatePricing({ packageVatRate: 0, packageVatInitialized: true });
      return;
    }

    const numeric = Number(trimmed.replace(/,/g, "."));
    if (Number.isNaN(numeric)) {
      return;
    }

    const clamped = Math.min(99.99, Math.max(0, numeric));
    updatePricing({ packageVatRate: clamped, packageVatInitialized: true });
  };

  const handlePackageVatModeChange = (mode: PackageVatMode) => {
    updatePricing({ packageVatMode: mode, packageVatInitialized: true });
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

  const hasCustomVatValues =
    (state.pricing.packageVatRate ?? defaultVatRate) !== defaultVatRate ||
    (state.pricing.packageVatMode ?? defaultVatMode) !== defaultVatMode;
  const hasVatOverrides = state.pricing.packageVatOverrideEnabled;
  const packageVatButtonLabel = hasVatOverrides
    ? t("steps.pricing.packageVat.buttonClose")
    : t("steps.pricing.packageVat.buttonOpen");

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
          <div className="flex items-center gap-2">
            <Label htmlFor="package-base-price" className="text-sm font-semibold text-slate-900">
              {t("steps.pricing.basePrice.label")}
            </Label>
            <HelperTooltip
              label={t("steps.pricing.basePrice.helperLabel")}
              content={basePriceHelper}
            />
          </div>
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
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {t("steps.pricing.packageVat.inputHint", {
                rate: formatPercent(packageVatRate),
                mode: packageVatModeLabel,
              })}
            </span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0 text-xs font-semibold"
              onClick={() => handlePackageVatToggle(!state.pricing.packageVatOverrideEnabled)}
            >
              {packageVatButtonLabel}
            </Button>
          </div>
          {state.pricing.packageVatOverrideEnabled ? (
            <div className="space-y-4 rounded-xl border border-border/70 bg-white/80 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label
                    htmlFor="package-vat-rate"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {t("steps.pricing.packageVat.rateLabel")}
                  </Label>
                  <Input
                    id="package-vat-rate"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={99.99}
                    step="0.01"
                    value={packageVatRateInputValue}
                    onChange={(event) => handlePackageVatRateChange(event.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("steps.pricing.packageVat.modeLabel")}
                  </Label>
                  <Select
                    value={packageVatMode}
                    onValueChange={(value) => handlePackageVatModeChange(value as PackageVatMode)}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inclusive">
                        {t("steps.pricing.packageVat.mode.inclusive")}
                      </SelectItem>
                      <SelectItem value="exclusive">
                        {t("steps.pricing.packageVat.mode.exclusive")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryMetric
                  label={t("steps.pricing.packageVat.netLabel")}
                  value={formatCurrency(basePriceNet)}
                />
                <SummaryMetric
                  label={t("steps.pricing.packageVat.vatLabel")}
                  value={formatCurrency(basePriceVatAmount)}
                />
                <SummaryMetric
                  label={t("steps.pricing.packageVat.grossLabel")}
                  value={formatCurrency(basePriceGross)}
                />
              </div>
            </div>
          ) : null}
        </section>

        <Surface padding="sm" className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              {t("steps.pricing.servicesReference.title")}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {t("steps.pricing.servicesReference.description")}
              </p>
              <Button
                variant="link"
                size="sm"
                onClick={() => setCurrentStep("services")}
                className="h-auto px-0 text-xs font-semibold"
              >
                {t("steps.pricing.servicesReference.action")}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {t("steps.pricing.servicesReference.count", { count: state.services.items.length })}
              </Badge>
              {servicesGrossTotal > 0 ? (
                <Badge variant="outline">
                  {t("steps.pricing.servicesReference.total", {
                    amount: formatCurrency(servicesGrossTotal),
                  })}
                </Badge>
              ) : null}
            </div>
          </div>
        </Surface>

        <Surface className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              {t("steps.pricing.includeAddOns.title")}
            </h3>
            <HelperTooltip
              label={t("steps.pricing.includeAddOns.title")}
              content={t("steps.pricing.includeAddOns.description")}
            />
          </div>
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
              <div className="flex-1 space-y-1 text-sm leading-tight">
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
              <div className="flex-1 space-y-1 text-sm leading-tight">
                <p className="font-semibold text-slate-900 leading-snug">
                  {t("steps.pricing.includeAddOns.optionAddOns.title")}
                </p>
                <p className="text-xs text-muted-foreground leading-snug">
                  {t("steps.pricing.includeAddOns.optionAddOns.description")}
                </p>
              </div>
            </label>
          </RadioGroup>
        </Surface>

        <Surface className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              {t("steps.pricing.finalSummary.title")}
            </h3>
            <HelperTooltip
              label={t("steps.pricing.finalSummary.title")}
              content={t("steps.pricing.finalSummary.tooltip")}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryMetric
              label={t("steps.pricing.finalSummary.net")}
              value={formatCurrency(combinedNet)}
            />
            <SummaryMetric
              label={t("steps.pricing.finalSummary.vat")}
              value={formatCurrency(combinedVat)}
            />
            <SummaryMetric
              label={t("steps.pricing.finalSummary.gross")}
              value={formatCurrency(combinedGross)}
            />
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              {pricingMode === "addOns"
                ? t("steps.pricing.finalSummary.addOnsHelper")
                : t("steps.pricing.finalSummary.inclusiveHelper")}
            </p>
            <p>
              {t("steps.pricing.finalSummary.servicesLine", {
                amount: formatCurrency(servicesGrossTotal),
              })}
            </p>
          </div>
        </Surface>

        <Surface className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">
                {t("steps.pricing.deposit.label")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("steps.pricing.deposit.description", {
                  defaultValue: "Collect an upfront payment to secure bookings.",
                })}
              </p>
            </div>
            <Switch
              id="package-deposit-toggle"
              checked={depositEnabled}
              onCheckedChange={handleDepositToggle}
              aria-label={t("steps.pricing.deposit.label")}
            />
          </div>

          {depositEnabled ? (
            <div className="space-y-4 border-t border-border/60 pt-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("steps.pricing.deposit.modeTitle")}
                  </p>
                  <HelperTooltip
                    label={t("steps.pricing.deposit.modeTitle")}
                    content={t("steps.pricing.deposit.percentHelper")}
                  />
                </div>
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
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t("steps.pricing.deposit.percentTarget.label")}
                      </p>
                      <HelperTooltip
                        label={t("steps.pricing.deposit.percentTarget.label")}
                        content={
                          includeAddOns
                            ? t("steps.pricing.deposit.percentTarget.autoPackage")
                            : t("steps.pricing.deposit.percentHelper")
                        }
                      />
                    </div>
                    {!includeAddOns ? (
                      <SegmentedControl
                        value={percentTarget}
                        onValueChange={handlePercentTargetChange}
                        options={[
                          {
                            value: "subtotal",
                            label: t("steps.pricing.deposit.percentTarget.subtotal"),
                          },
                          {
                            value: "base",
                            label: t("steps.pricing.deposit.percentTarget.base"),
                          },
                        ]}
                        className="max-w-sm"
                      />
                    ) : (
                      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-muted-foreground">
                        {t("steps.pricing.deposit.percentTarget.autoPackage")}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {PERCENT_PRESETS.map((percent) => (
                      <Button
                        key={percent}
                        variant={
                          state.pricing.depositValue === String(percent) ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => applyPercentPreset(percent)}
                      >
                        {percent}%
                      </Button>
                    ))}
                    <div className="flex items-center gap-1">
                      <Label htmlFor="deposit-custom-percent" className="sr-only">
                        {t("steps.pricing.deposit.customPercentLabel")}
                      </Label>
                      <Input
                        id="deposit-custom-percent"
                        className="h-9 w-24 text-right"
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        value={state.pricing.depositValue}
                        onChange={(event) => handleDepositValueChange(event.target.value)}
                        placeholder={t("steps.pricing.deposit.customPercentPlaceholder")}
                      />
                      <span className="text-xs font-medium text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="deposit-fixed"
                      className="text-xs text-muted-foreground"
                    >
                      {t("steps.pricing.deposit.fixedLabel")}
                    </Label>
                    <HelperTooltip
                      label={t("steps.pricing.deposit.fixedLabel")}
                      content={t("steps.pricing.deposit.fixedHelper")}
                    />
                  </div>
                  <Input
                    id="deposit-fixed"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={state.pricing.depositValue}
                    onChange={(event) => handleDepositValueChange(event.target.value)}
                    placeholder={t("steps.pricing.deposit.fixedPlaceholder")}
                    className="max-w-xs"
                  />
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
              ) : (
                <p className="border-t border-border/60 pt-4 text-xs text-muted-foreground">
                  {t("steps.pricing.deposit.disabled")}
                </p>
              )}
        </Surface>
      </div>
      <VatResetDialog
        open={showVatResetPrompt}
        onCancel={() => setShowVatResetPrompt(false)}
        onConfirm={resetPackageVatOverrides}
        t={t}
      />
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

function formatPercent(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
  }).format(amount);
}

const VatResetDialog = ({
  open,
  onCancel,
  onConfirm,
  t,
}: {
  open: boolean;
  onCancel(): void;
  onConfirm(): void;
  t: ReturnType<typeof useTranslation>["t"];
}) => (
  <AlertDialog open={open} onOpenChange={onCancel}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("steps.pricing.packageVat.resetTitle")}</AlertDialogTitle>
        <AlertDialogDescription>
          {t("steps.pricing.packageVat.resetDescription")}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel}>
          {t("steps.pricing.packageVat.resetCancel")}
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {t("steps.pricing.packageVat.resetConfirm")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
