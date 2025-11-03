import { ReactNode, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useProjectTypes } from "@/hooks/useOrganizationData";
import { usePackageCreationSnapshot } from "../hooks/usePackageCreationSnapshot";
import { calculateLineItemPricing } from "../utils/lineItemPricing";
import type { PackageCreationLineItem } from "../types";
import { DEFAULT_SERVICE_UNIT, normalizeServiceUnit } from "@/lib/services/units";
import {
  ServicesTableCard,
  type ServicesTableRow,
  SummaryTotalRow,
  SummaryTotalsCard,
  SummaryTotalsDivider,
  SummaryTotalsSection,
} from "@/components/services";
import { usePackageCreationActions } from "../hooks/usePackageCreationActions";
import { SummaryCard, SummarySectionHeading } from "@/components/summary";
import { Sparkles } from "lucide-react";
import { Surface } from "@/components/layout-primitives";

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
    }).format(value);
  } catch {
    return `₺${value}`;
  }
};

const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "0";
  }
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value);
};

export const SummaryStep = () => {
  const { t } = useTranslation("packageCreation");
  const { snapshot } = usePackageCreationSnapshot();
  const { updateBasics, setCurrentStep } = usePackageCreationActions();
  const { data: projectTypes = [] } = useProjectTypes();

  const projectTypeMap = useMemo(
    () =>
      new Map(
        (projectTypes as { id: string; name: string }[]).map((type) => [type.id, type.name ?? type.id])
      ),
    [projectTypes]
  );

  const selectedTypeNames = useMemo(() => {
    if (!snapshot.basics.applicableTypeIds.length) return [];
    return snapshot.basics.applicableTypeIds
      .map((id) => projectTypeMap.get(id))
      .filter(Boolean) as string[];
  }, [projectTypeMap, snapshot.basics.applicableTypeIds]);

  const appliesToAllTypes =
    snapshot.basics.applicableTypeIds.length === 0 || selectedTypeNames.length === 0;

  const typesLabel = appliesToAllTypes
    ? t("summaryView.cards.typesAll")
    : selectedTypeNames.join(", ");

  const photoEstimateLabel: ReactNode = (() => {
    if (!snapshot.delivery.photosEnabled) {
      return (
        <span className="text-muted-foreground">
          {t("summaryView.delivery.estimate.disabled", { defaultValue: "Not tracked" })}
        </span>
      );
    }
    if (snapshot.delivery.estimateType === "range") {
      if (snapshot.delivery.photoCountMin && snapshot.delivery.photoCountMax) {
        return t("summaryView.delivery.estimate.range", {
          min: formatNumber(snapshot.delivery.photoCountMin),
          max: formatNumber(snapshot.delivery.photoCountMax),
        });
      }
      return <span className="text-muted-foreground">{t("summaryView.delivery.estimate.notSet")}</span>;
    }

    if (snapshot.delivery.photoCountMin) {
      return t("summaryView.delivery.estimate.single", {
        count: formatNumber(snapshot.delivery.photoCountMin),
      });
    }

    return <span className="text-muted-foreground">{t("summaryView.delivery.estimate.notSet")}</span>;
  })();

  const leadTimeLabel: ReactNode = (() => {
    if (!snapshot.delivery.leadTimeEnabled) {
      return (
        <span className="text-muted-foreground">
          {t("summaryView.delivery.leadTime.disabled", { defaultValue: "Not tracked" })}
        </span>
      );
    }
    if (!snapshot.delivery.leadTimeValue) {
      return <span className="text-muted-foreground">{t("summaryView.delivery.leadTime.notSet")}</span>;
    }

    const unit = t(`summaryView.delivery.leadTime.unit.${snapshot.delivery.leadTimeUnit ?? "days"}`);
    return t("summaryView.delivery.leadTime.value", {
      value: snapshot.delivery.leadTimeValue,
      unit,
    });
  })();

  const methods =
    snapshot.delivery.methodsEnabled && snapshot.delivery.methods.length
      ? snapshot.delivery.methods.map((method) => method.name ?? t("summaryView.delivery.methods.unknown"))
      : [];

  const clientTotal = snapshot.pricing.clientTotal;
  const includeAddOnsInPrice = snapshot.pricing.includeAddOnsInPrice;
  const combinedNet = snapshot.pricing.basePriceNet + (includeAddOnsInPrice ? 0 : snapshot.pricing.servicesPriceTotal);
  const combinedVat = snapshot.pricing.basePriceVatPortion + (includeAddOnsInPrice ? 0 : snapshot.pricing.servicesVatTotal);
  const clientTotalHelperText = includeAddOnsInPrice
    ? t("summaryView.pricing.clientTotalHelper.inclusive")
    : t("summaryView.pricing.clientTotalHelper.addOns");

  const depositHasValue = snapshot.pricing.depositAmount > 0;
  const depositDisplayValue = formatCurrency(snapshot.pricing.depositAmount);
  const depositHelper = depositHasValue
    ? snapshot.pricing.depositMode === "fixed"
      ? `${t("summaryView.pricing.deposit.fixed")} • ${formatCurrency(snapshot.pricing.depositValue)}`
      : t("summaryView.pricing.deposit.percent", {
          percent: formatPercent(snapshot.pricing.depositValue),
          target: t(`summaryView.pricing.targets.${snapshot.pricing.depositTarget ?? "subtotal"}`),
        })
    : t("summaryView.pricing.deposit.none");

  const getUnitLabel = useCallback(
    (unit?: string | null) =>
      t(`steps.services.units.short.${normalizeServiceUnit(unit)}`, {
        defaultValue: t(`steps.services.units.options.${normalizeServiceUnit(unit)}`),
      }),
    [t]
  );

  const servicesTableRows = useMemo<ServicesTableRow[]>(() => {
    return snapshot.services.items.map((item) => {
      const quantity = Math.max(1, item.quantity ?? 1);
      const pricing = calculateLineItemPricing({
        id: item.id,
        type: item.type,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        vatRate: item.vatRate ?? null,
        vatMode: item.vatMode ?? "exclusive",
        vendorName: item.vendorName ?? null,
      } as PackageCreationLineItem);

      const hasUnitCost = typeof item.unitCost === "number" && Number.isFinite(item.unitCost);
      const unitPriceValue =
        typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice)
          ? item.unitPrice
          : null;

      return {
        id: item.id,
        name: item.name,
        vendor: item.vendorName,
        quantity,
        unitLabel: getUnitLabel(item.unit ?? DEFAULT_SERVICE_UNIT),
        lineCost: hasUnitCost ? roundToTwo((item.unitCost ?? 0) * quantity) : null,
        unitPrice: unitPriceValue,
        lineTotal: roundToTwo(pricing.gross),
        isCustom: item.type === "custom",
      };
    });
  }, [getUnitLabel, snapshot.services.items]);

  const servicesTableLabels = useMemo(() => {
    return {
      columns: {
        name: t("summaryView.services.columns.name"),
        quantity: t("summaryView.services.columns.quantity"),
        cost: t("summaryView.services.columns.cost"),
        unitPrice: t("summaryView.services.columns.unitPrice"),
        lineTotal: t("summaryView.services.columns.lineTotal"),
      },
      totals: {
        cost: t("summaryView.services.totals.cost"),
        price: t("summaryView.services.totals.price"),
        vat: t("summaryView.services.totals.vat"),
        total: t("summaryView.services.totals.total"),
        margin: t("summaryView.services.totals.margin"),
      },
      customTag: t("summaryView.services.customTag"),
      customVendorFallback: t("summaryView.services.customVendorFallback"),
    };
  }, [t]);

  const vatBreakdown = useMemo(() => {
    const buckets = new Map<number, number>();

    snapshot.services.items.forEach((item) => {
      const pricing = calculateLineItemPricing({
        id: item.id,
        type: item.type,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        vatRate: item.vatRate ?? null,
        vatMode: item.vatMode ?? "exclusive",
        vendorName: item.vendorName ?? null,
      } as PackageCreationLineItem);

      if (!(pricing.vat > 0)) return;
      const rate =
        typeof item.vatRate === "number" && Number.isFinite(item.vatRate)
          ? item.vatRate
          : 0;
      const current = buckets.get(rate) ?? 0;
      buckets.set(rate, current + pricing.vat);
    });

    return Array.from(buckets.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([rate, amount]) => ({ rate, amount: roundToTwo(amount) }));
  }, [snapshot.services.items]);

  const packageVatModeLabel = t(`steps.pricing.packageVat.mode.${snapshot.pricing.packageVatMode}`, {
    defaultValue: snapshot.pricing.packageVatMode === "inclusive" ? "Included in price" : "Add on top",
  });
  const packageVatRateString = formatPercent(snapshot.pricing.packageVatRate);
  const packageVatLabel = t("summaryView.servicesTotals.packageVatLabel", {
    rate: packageVatRateString,
  });
  const packageVatAmount = snapshot.pricing.basePriceVatPortion;
  const packageNet = snapshot.pricing.basePriceNet;
  const packageGross = snapshot.pricing.basePrice;
  const totalTax = combinedVat;
  const servicesSectionRef = useRef<HTMLDivElement | null>(null);

  const handleScrollToServices = () => {
    servicesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleVisibilityToggle = (nextValue: boolean) => {
    updateBasics({ isActive: nextValue });
  };

  const basicsComplete = Boolean(snapshot.basics.name?.trim());
  const pricingComplete =
    typeof snapshot.pricing.basePrice === "number" && snapshot.pricing.basePrice > 0
      ? true
      : typeof snapshot.pricing.clientTotal === "number" && snapshot.pricing.clientTotal > 0;
  const canRenderSummary = basicsComplete && pricingComplete;
  const missingBasics = !basicsComplete;
  const missingPricing = !pricingComplete;

  if (!canRenderSummary) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            {t("summaryView.sectionTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("summaryView.intro")}</p>
        </header>

        <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">
            {t("summaryView.emptyState.title")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">{t("summaryView.emptyState.description")}</p>
          <ul className="mt-5 space-y-2 text-left text-sm text-muted-foreground">
            {missingBasics ? (
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>{t("summaryView.emptyState.checklist.basics")}</span>
              </li>
            ) : null}
            {missingPricing ? (
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>{t("summaryView.emptyState.checklist.pricing")}</span>
              </li>
            ) : null}
          </ul>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {missingBasics ? (
              <Button onClick={() => setCurrentStep("basics")} variant="default">
                {t("summaryView.emptyState.ctaBasics")}
              </Button>
            ) : null}
            {missingPricing ? (
              <Button onClick={() => setCurrentStep("pricing")} variant={missingBasics ? "outline" : "default"}>
                {t("summaryView.emptyState.ctaPricing")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {t("summaryView.sectionTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("summaryView.intro")}</p>
      </header>

      <section className="space-y-3">
        <SummarySectionHeading>{t("summaryView.meta.title")}</SummarySectionHeading>
        <div className="grid gap-3 lg:grid-cols-4">
          <SummaryCard
            title={t("summaryView.pricing.clientTotalTitle")}
            primary={<span className="text-2xl font-semibold text-slate-900">{formatCurrency(clientTotal)}</span>}
            helperClassName="mt-3 flex flex-col gap-2"
            helper={
              <>
                <div className="space-y-1">
                  <p
                    className={cn(
                      "text-sm font-semibold text-slate-900",
                      !depositHasValue && "font-medium text-muted-foreground"
                    )}
                  >
                    {t("summaryView.pricing.deposit.label")}
                    {depositHasValue ? <span className="ml-2 font-semibold">{depositDisplayValue}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{depositHelper}</p>
                </div>
                <p className="text-xs text-muted-foreground">{clientTotalHelperText}</p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto self-start px-0 text-xs font-semibold"
                  onClick={handleScrollToServices}
                >
                  {t("summaryView.actions.viewDetails")}
                </Button>
              </>
            }
            className="lg:col-span-2"
          />
          <SummaryCard
            title={t("summaryView.cards.name")}
            primary={snapshot.basics.name || t("summaryView.notSet")}
            helper={
              snapshot.basics.description
                ? truncate(snapshot.basics.description, 80)
                : t("summaryView.cards.descriptionFallback")
            }
            className="lg:col-span-1"
          />
          <SummaryCard
            title={t("summaryView.cards.types")}
            primary={typesLabel}
            helper={
              appliesToAllTypes ? t("summaryView.cards.typesAllHelper") : undefined
            }
            className="lg:col-span-1"
          />
        </div>
      </section>

      <Surface as="div" radius="lg" padding="sm" className="bg-white/95">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">{t("steps.basics.fields.visibility.label")}</p>
            <p className="text-xs text-muted-foreground">{t("steps.basics.fields.visibility.helper")}</p>
          </div>
          <Switch checked={snapshot.basics.isActive} onCheckedChange={handleVisibilityToggle} />
        </div>
      </Surface>

      <section className="space-y-3">
        <SummarySectionHeading>{t("summaryView.description.title")}</SummarySectionHeading>
        <div className="rounded-xl border border-border/60 bg-white p-4">
          <p
            className={cn(
              "whitespace-pre-wrap text-sm leading-relaxed",
              snapshot.basics.description ? "text-slate-900" : "text-muted-foreground"
            )}
          >
            {snapshot.basics.description || t("summaryView.description.empty")}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <SummarySectionHeading>{t("summaryView.delivery.title")}</SummarySectionHeading>
        <div className="grid gap-3 md:grid-cols-3">
          <SummaryCard
            title={t("summaryView.delivery.estimateLabel")}
            primary={photoEstimateLabel}
          />
          <SummaryCard
            title={t("summaryView.delivery.leadTime.label")}
            primary={leadTimeLabel}
          />
          <SummaryCard
            title={t("summaryView.delivery.methods.label")}
            primary={
              !snapshot.delivery.methodsEnabled ? (
                <span className="text-muted-foreground">{t("summaryView.delivery.methods.disabled")}</span>
              ) : methods.length ? (
                <div className="flex flex-wrap gap-2">
                  {methods.map((method) => (
                    <Badge key={method} variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {method}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">{t("summaryView.delivery.methods.empty")}</span>
              )
            }
          />
        </div>
      </section>

      <section ref={servicesSectionRef} className="space-y-3">
        <SummarySectionHeading>{t("summaryView.servicesAndPricingTitle")}</SummarySectionHeading>
        <ServicesTableCard
          rows={servicesTableRows}
          totals={undefined}
          labels={servicesTableLabels}
          emptyMessage={t("summaryView.services.empty")}
          formatCurrency={(value) => formatCurrency(value)}
          className="bg-white/90"
        />
        <div className="flex justify-end">
          <SummaryTotalsCard className="sm:w-auto sm:min-w-[320px]">
            <SummaryTotalRow
              label={t("steps.services.summary.countLabel")}
              value={formatNumber(snapshot.meta.selectedServiceCount)}
            />
            <SummaryTotalsSection>
              <SummaryTotalRow
                label={t("summaryView.servicesTotals.serviceCost")}
                value={formatCurrency(snapshot.services.totals.cost)}
              />
              <SummaryTotalRow
                label={t("summaryView.servicesTotals.servicePrice")}
                value={formatCurrency(snapshot.services.totals.price)}
              />
            </SummaryTotalsSection>
            {vatBreakdown.length ? (
              <SummaryTotalsSection className="space-y-1">
                {vatBreakdown.map((entry) => (
                  <SummaryTotalRow
                    key={entry.rate}
                    label={t("steps.services.summary.vatBreakdownItem", {
                      rate: formatPercent(entry.rate),
                    })}
                    value={formatCurrency(entry.amount)}
                  />
                ))}
              </SummaryTotalsSection>
            ) : null}
            {vatBreakdown.length !== 1 ? (
              <SummaryTotalsSection>
                <SummaryTotalRow
                  label={
                    vatBreakdown.length > 1
                      ? t("steps.services.summary.vatTotal", { defaultValue: "Total VAT" })
                      : t("steps.services.summary.vat", { defaultValue: "VAT" })
                  }
                  value={formatCurrency(snapshot.services.totals.vat)}
                />
              </SummaryTotalsSection>
            ) : null}
            <SummaryTotalsDivider />
            <SummaryTotalsSection className="pt-3">
              <SummaryTotalRow
                label={t("summaryView.servicesTotals.serviceGross")}
                value={formatCurrency(snapshot.services.totals.total)}
                emphasizeLabel
              />
              <SummaryTotalRow
                label={t("summaryView.servicesTotals.serviceMargin")}
                value={formatCurrency(snapshot.pricing.servicesMargin)}
                tone={snapshot.pricing.servicesMargin >= 0 ? "positive" : "negative"}
                emphasizeLabel
              />
            </SummaryTotalsSection>
            <SummaryTotalsDivider />
            <SummaryTotalsSection className="pt-3 space-y-3">
              <SummaryTotalRow
                label={t("summaryView.servicesTotals.packageNet")}
                value={formatCurrency(packageNet)}
                emphasizeLabel
              />
              <SummaryTotalRow
                label={packageVatLabel}
                value={formatCurrency(packageVatAmount)}
                helper={packageVatModeLabel}
              />
              <SummaryTotalRow
                label={t("summaryView.servicesTotals.packageGross")}
                value={formatCurrency(packageGross)}
                emphasizeLabel
              />
            </SummaryTotalsSection>
            <SummaryTotalsDivider />
            <SummaryTotalsSection className="pt-3 space-y-3">
              <SummaryTotalRow
                label={t("summaryView.servicesTotals.clientNet")}
                value={formatCurrency(combinedNet)}
              />
              <SummaryTotalRow
                label={t("summaryView.servicesTotals.totalTax")}
                value={formatCurrency(totalTax)}
                emphasizeLabel
              />
              <SummaryTotalRow
                label={t("summaryView.servicesTotals.grandTotal")}
                value={formatCurrency(clientTotal)}
                emphasizeLabel
                tone="positive"
              />
              <div className="text-right text-xs text-muted-foreground">
                {includeAddOnsInPrice
                  ? t("summaryView.pricing.clientTotalHelper.inclusive")
                  : t("summaryView.pricing.clientTotalHelper.addOns")}
              </div>
            </SummaryTotalsSection>
            <SummaryTotalsDivider />
            <SummaryTotalsSection className="pt-3 space-y-3">
              <SummaryTotalRow
                label={t("summaryView.pricing.deposit.label")}
                value={depositDisplayValue}
                helper={depositHelper}
                emphasizeLabel={depositHasValue}
              />
            </SummaryTotalsSection>
          </SummaryTotalsCard>
        </div>
      </section>

    </div>
  );
};
const truncate = (value: string, limit: number) => {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
};

const roundToTwo = (value: number) => Math.round(value * 100) / 100;
