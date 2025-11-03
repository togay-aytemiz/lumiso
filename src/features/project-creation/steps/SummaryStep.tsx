import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ServicesTableCard,
  SummaryTotalRow,
  SummaryTotalsCard,
  SummaryTotalsDivider,
  SummaryTotalsSection,
  type ServicesTableRow,
} from "@/components/services";
import { useProjectCreationContext } from "../hooks/useProjectCreationContext";
import { cn } from "@/lib/utils";
import { calculateLineItemPricing } from "@/features/package-creation/utils/lineItemPricing";
import { normalizeServiceUnit } from "@/lib/services/units";
import { usePackages } from "@/hooks/useOrganizationData";
import type { ProjectServiceLineItem } from "../types";

interface PackageRecord {
  id: string;
  name: string;
  price?: number | null;
  include_addons_in_price?: boolean | null;
  pricing_metadata?: Record<string, unknown> | null;
}

const formatCurrency = (amount: number) => {
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

const formatPercent = (value: number) => {
  try {
    return new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value}%`;
  }
};

const toPositiveNumber = (value: string | number | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }
  if (typeof value === "string") {
    const numeric = Number(value.replace(/,/g, "."));
    if (Number.isFinite(numeric)) {
      return Math.max(0, numeric);
    }
  }
  return 0;
};

export const SummaryStep = () => {
  const { t } = useTranslation("projectCreation");
  const { t: tPackages } = useTranslation("packageCreation");
  const { state } = useProjectCreationContext();
  const servicesSectionRef = useRef<HTMLDivElement | null>(null);

  const packagesQuery = usePackages();
  const packages = (packagesQuery.data as PackageRecord[]) ?? [];
  const selectedPackage = state.services.packageId
    ? packages.find((pkg) => pkg.id === state.services.packageId)
    : undefined;

  const existingItems = state.services.items;
  const hasServices = existingItems.length > 0;

  const totals = useMemo(() => {
    return existingItems.reduce(
      (acc, item) => {
        const quantity = Math.max(1, item.quantity ?? 1);
        const unitCost = Number(item.unitCost ?? 0);
        const pricing = calculateLineItemPricing(item as ProjectServiceLineItem);
        acc.cost += unitCost * quantity;
        acc.net += pricing.net;
        acc.vat += pricing.vat;
        acc.total += pricing.gross;
        return acc;
      },
      { cost: 0, net: 0, vat: 0, total: 0 }
    );
  }, [existingItems]);

  const servicesMargin = totals.net - totals.cost;

  const vatBreakdown = useMemo(() => {
    const buckets = new Map<number, number>();
    existingItems.forEach((item) => {
      const pricing = calculateLineItemPricing(item as ProjectServiceLineItem);
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
      .map(([rate, amount]) => ({ rate, amount }));
  }, [existingItems]);

  const basePriceValue = useMemo(() => {
    const parsed = parseFloat(state.details.basePrice ?? "");
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    if (selectedPackage && typeof selectedPackage.price === "number") {
      const price = Number(selectedPackage.price);
      return Number.isFinite(price) && price > 0 ? price : 0;
    }
    return 0;
  }, [state.details.basePrice, selectedPackage]);

  const includeAddOnsInPrice = selectedPackage?.include_addons_in_price ?? true;

  const packageDerived = useMemo(() => {
    const round = (value: number) => Math.round(value * 100) / 100;
    const singleVatRate =
      vatBreakdown.length === 1 && Number.isFinite(vatBreakdown[0].rate)
        ? vatBreakdown[0].rate
        : null;

    if (basePriceValue > 0) {
      if (singleVatRate != null) {
        const divisor = 1 + singleVatRate / 100;
        const net = round(basePriceValue / divisor);
        const vat = round(basePriceValue - net);
        return {
          packageNet: net,
          packageVat: vat,
          packageGross: round(basePriceValue),
          packageVatRate: singleVatRate,
        };
      }
      const vatPortion = Math.min(totals.vat, basePriceValue);
      const netPortion = round(Math.max(basePriceValue - vatPortion, 0));
      return {
        packageNet: netPortion,
        packageVat: round(vatPortion),
        packageGross: round(basePriceValue),
        packageVatRate: singleVatRate,
      };
    }

    return {
      packageNet: round(totals.net),
      packageVat: round(totals.vat),
      packageGross: round(totals.total),
      packageVatRate: singleVatRate,
    };
  }, [basePriceValue, totals, vatBreakdown]);

  const clientNet = packageDerived.packageNet;
  const clientTax = packageDerived.packageVat;
  const clientTotal = packageDerived.packageGross;

  const packageMetadata = selectedPackage?.pricing_metadata ?? null;
  const parsedPackageDeposit = useMemo(() => {
    if (!packageMetadata || typeof packageMetadata !== "object") {
      return null;
    }
    const data = packageMetadata as Record<string, unknown>;
    const mode = typeof data.depositMode === "string" ? (data.depositMode as string) : null;
    const value = toPositiveNumber(data.depositValue as string | number | null);
    const target = typeof data.depositTarget === "string" ? (data.depositTarget as string) : "subtotal";
    const amount = toPositiveNumber(data.depositAmount as string | number | null);
    return {
      enable: Boolean(data.enableDeposit),
      mode,
      value,
      target,
      amount,
    };
  }, [packageMetadata]);

  const depositAmountRaw = toPositiveNumber(state.details.depositAmount ?? null);
  const derivedDeposit = useMemo(() => {
    if (depositAmountRaw > 0) {
      return depositAmountRaw;
    }
    if (parsedPackageDeposit?.enable) {
      if (parsedPackageDeposit.mode === "fixed" && parsedPackageDeposit.amount > 0) {
        return parsedPackageDeposit.amount;
      }
      if (parsedPackageDeposit.mode !== "fixed" && parsedPackageDeposit.value > 0) {
        return parsedPackageDeposit.amount > 0 ? parsedPackageDeposit.amount : 0;
      }
    }
    return 0;
  }, [depositAmountRaw, parsedPackageDeposit]);

  const depositDisplay = formatCurrency(derivedDeposit);

  const depositHelper = useMemo(() => {
    if (!(derivedDeposit > 0)) {
      return t("steps.packages.summary.depositHelperNone");
    }
    if (parsedPackageDeposit?.mode === "fixed") {
      return tPackages("summaryView.pricing.deposit.fixed", {
        defaultValue: "Fixed upfront amount",
      });
    }
    if (parsedPackageDeposit?.mode && parsedPackageDeposit.value > 0) {
      return tPackages("summaryView.pricing.deposit.percent", {
        percent: formatPercent(parsedPackageDeposit.value),
        target: tPackages(`summaryView.pricing.targets.${parsedPackageDeposit.target ?? "subtotal"}`),
      });
    }
    return t("summary.cards.pricing.depositHelperDefault");
  }, [derivedDeposit, parsedPackageDeposit, t, tPackages]);

  const clientTotalHelper =
    basePriceValue > 0 ? t("steps.packages.summary.clientTotalHelperInclusive") : undefined;

  const getUnitLabel = useCallback(
    (unit?: string | null) =>
      t(`steps.packages.units.short.${normalizeServiceUnit(unit)}`, {
        defaultValue: t(`steps.packages.units.options.${normalizeServiceUnit(unit)}`),
      }),
    [t]
  );

  const servicesTableRows = useMemo<ServicesTableRow[]>(() => {
    return existingItems.map((item) => {
      const quantity = Math.max(1, item.quantity ?? 1);
      const pricing = calculateLineItemPricing(item as ProjectServiceLineItem);
      const hasUnitCost = typeof item.unitCost === "number" && Number.isFinite(item.unitCost);
      const lineCost = hasUnitCost ? Math.round(Number(item.unitCost ?? 0) * quantity * 100) / 100 : null;
      const unitPrice =
        typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice)
          ? item.unitPrice
          : null;
      return {
        id: item.id,
        name: item.name,
        vendor: item.vendorName ?? undefined,
        quantity,
        unitLabel: getUnitLabel(item.unit),
        lineCost,
        unitPrice,
        lineTotal: Math.round(pricing.gross * 100) / 100,
        isCustom: item.type === "custom",
      };
    });
  }, [existingItems, getUnitLabel]);

  const servicesSectionLabels = useMemo(() => {
    return {
      columns: {
        name: t("steps.packages.summary.table.name"),
        quantity: t("steps.packages.summary.table.quantity"),
        cost: t("steps.packages.summary.table.cost"),
        unitPrice: t("steps.packages.summary.table.unitPrice"),
        lineTotal: t("steps.packages.summary.table.lineTotal"),
      },
      totals: {
        cost: t("steps.packages.summary.totals.cost"),
        price: t("steps.packages.summary.totals.price"),
        vat: t("steps.packages.summary.totals.vat"),
        total: t("steps.packages.summary.totals.total"),
        margin: t("steps.packages.summary.totals.margin"),
      },
      customTag: t("steps.packages.summary.customTag"),
      customVendorFallback: t("steps.packages.summary.customVendorFallback"),
    };
  }, [t]);

  const handleViewDetails = useCallback(() => {
    servicesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const leadName = state.lead.name?.trim() ?? t("summary.values.notSet");
  const leadContact = [state.lead.email?.trim(), state.lead.phone?.trim()].filter(Boolean).join(" • ");

  const projectName = state.details.name?.trim() ?? t("summary.values.notSet");
  const projectType = state.details.projectTypeLabel?.trim();
  const projectStatus = state.details.statusLabel?.trim();

  const packageLabel =
    state.services.packageLabel?.trim() ??
    (state.services.packageId ? t("summary.values.packageSelected") : t("summary.values.none"));

  const description = state.details.description?.trim();

  const leadHelper = leadContact || t("summary.cards.lead.helperFallback");
  const projectHelper =
    projectType && projectStatus
      ? `${projectType} • ${projectStatus}`
      : projectType ?? projectStatus ?? t("summary.values.notSet");
  const packageHelperText = hasServices
    ? t("summary.cards.package.helperWithServices", { count: existingItems.length })
    : t("summary.cards.package.helperNoServices");
  const infoEntries = [
    {
      label: t("summary.cards.lead.title"),
      value: leadName,
      helper: leadHelper,
    },
    {
      label: t("summary.cards.project.title"),
      value: projectName,
      helper: projectHelper,
    },
    {
      label: t("summary.cards.package.title"),
      value: packageLabel,
      helper: packageHelperText,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {t("summary.sectionTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("steps.summary.description")}</p>
      </header>

      <section className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <SummaryPricingCard
            className="lg:col-span-2"
            title={t("summary.cards.pricing.title")}
            amount={formatCurrency(clientTotal)}
            depositLabel={t("summary.cards.pricing.depositLabel")}
            depositValue={derivedDeposit > 0 ? depositDisplay : undefined}
            depositHelper={depositHelper}
            helper={clientTotalHelper}
            onViewDetails={handleViewDetails}
            detailsLabel={t("summary.cards.pricing.detailsLink")}
          />
          <SummaryInfoStack className="lg:col-span-2" entries={infoEntries} />
        </div>
      </section>

      <section className="space-y-3">
        <SummarySectionHeading>{t("summary.description.heading")}</SummarySectionHeading>
        <SummaryDescriptionBlock
          content={description}
          fallback={t("summary.description.empty")}
        />
      </section>

      <section ref={servicesSectionRef} className="space-y-3">
        <SummarySectionHeading>{t("summary.services.heading")}</SummarySectionHeading>
        {hasServices ? (
          <ServicesTableCard
            rows={servicesTableRows}
            labels={servicesSectionLabels}
            emptyMessage={t("summary.services.empty")}
            formatCurrency={(value) => formatCurrency(value)}
            className="bg-white/95"
          />
        ) : (
          <div className="rounded-xl border border-border/60 bg-white p-4 text-sm text-muted-foreground">
            {t("summary.services.empty")}
          </div>
        )}
        <div className={cn("flex", hasServices ? "justify-end" : "justify-stretch")}>
          <SummaryTotalsCard
            className={cn(
              "bg-white/95",
              hasServices ? "sm:w-auto sm:min-w-[320px]" : "w-full max-w-none"
            )}
          >
            {hasServices ? (
              <>
                <SummaryTotalRow
                  label={t("steps.packages.summary.servicesCount")}
                  value={String(existingItems.length)}
                />
                <SummaryTotalsSection>
                  <SummaryTotalRow
                    label={t("steps.packages.summary.servicesCost")}
                    value={formatCurrency(totals.cost)}
                  />
                  <SummaryTotalRow
                    label={t("steps.packages.summary.servicesPrice")}
                    value={formatCurrency(totals.net)}
                  />
                </SummaryTotalsSection>
                {vatBreakdown.length ? (
                  <SummaryTotalsSection className="space-y-1">
                    {vatBreakdown.map((entry) => (
                      <SummaryTotalRow
                        key={entry.rate}
                        label={t("steps.packages.summary.vatBreakdown", {
                          rate: formatPercent(entry.rate),
                        })}
                        value={formatCurrency(entry.amount)}
                      />
                    ))}
                  </SummaryTotalsSection>
                ) : null}
                <SummaryTotalsDivider />
                <SummaryTotalsSection className="pt-3">
                  <SummaryTotalRow
                    label={t("steps.packages.summary.servicesGross")}
                    value={formatCurrency(totals.total)}
                    emphasizeLabel
                  />
                  <SummaryTotalRow
                    label={t("steps.packages.summary.servicesMargin")}
                    value={formatCurrency(servicesMargin)}
                    tone={servicesMargin >= 0 ? "positive" : "negative"}
                    emphasizeLabel
                  />
                </SummaryTotalsSection>
                <SummaryTotalsDivider />
              </>
            ) : null}
            <SummaryTotalsSection className={cn("space-y-3", hasServices ? "pt-3" : undefined)}>
              <SummaryTotalRow
                label={t("steps.packages.summary.packageNet")}
                value={formatCurrency(packageDerived.packageNet)}
                emphasizeLabel
              />
              <SummaryTotalRow
                label={
                  packageDerived.packageVatRate != null
                    ? t("steps.packages.summary.packageVatWithRate", {
                        rate: formatPercent(packageDerived.packageVatRate),
                      })
                    : t("steps.packages.summary.packageVat")
                }
                value={formatCurrency(packageDerived.packageVat)}
                helper={
                  packageDerived.packageVatRate != null
                    ? t("steps.packages.summary.packageVatHelperInclusive")
                    : undefined
                }
              />
              <SummaryTotalRow
                label={t("steps.packages.summary.packageGross")}
                value={formatCurrency(packageDerived.packageGross)}
                emphasizeLabel
              />
            </SummaryTotalsSection>
            <SummaryTotalsDivider />
            <SummaryTotalsSection className={cn("space-y-3", hasServices ? "pt-3" : undefined)}>
              <SummaryTotalRow
                label={t("steps.packages.summary.clientNet")}
                value={formatCurrency(clientNet)}
              />
              <SummaryTotalRow
                label={t("steps.packages.summary.clientTax")}
                value={formatCurrency(clientTax)}
              />
              <SummaryTotalRow
                label={t("steps.packages.summary.clientTotal")}
                value={formatCurrency(clientTotal)}
                emphasizeLabel
                tone="positive"
                helper={clientTotalHelper}
              />
            </SummaryTotalsSection>
            <SummaryTotalsDivider />
            <SummaryTotalsSection className={cn("space-y-3", hasServices ? "pt-3" : undefined)}>
              <SummaryTotalRow
                label={t("steps.packages.summary.deposit")}
                value={formatCurrency(derivedDeposit)}
                helper={depositHelper}
                emphasizeLabel={derivedDeposit > 0}
              />
            </SummaryTotalsSection>
          </SummaryTotalsCard>
        </div>
      </section>

      {hasServices ? (
        <section className="space-y-3">
          <SummarySectionHeading>{t("summary.services.badgeHeading")}</SummarySectionHeading>
          <div className="flex flex-wrap gap-2">
            {existingItems.map((item) => (
              <Badge key={item.id} variant="secondary" className="text-xs font-medium">
                {Math.max(1, item.quantity ?? 1) > 1
                  ? `${item.name} ×${Math.max(1, item.quantity ?? 1)}`
                  : item.name}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

const SummarySectionHeading = ({ children }: { children: string }) => (
  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    {children}
  </p>
);

const SummaryPricingCard = ({
  className,
  title,
  amount,
  depositLabel,
  depositValue,
  depositHelper,
  helper,
  onViewDetails,
  detailsLabel,
}: {
  className?: string;
  title: string;
  amount: string;
  depositLabel: string;
  depositValue?: string;
  depositHelper: string;
  helper?: string;
  onViewDetails: () => void;
  detailsLabel: string;
}) => (
  <div
    className={cn(
      "flex flex-col justify-between rounded-2xl border border-border/70 bg-white/95 p-5 shadow-sm",
      className
    )}
  >
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className="text-2xl font-semibold text-slate-900">{amount}</p>
      <div className="space-y-1 text-sm">
        <p
          className={cn(
            "font-medium text-muted-foreground",
            depositValue && "text-slate-900"
          )}
        >
          {depositLabel}
          {depositValue ? <span className="ml-2 font-semibold">{depositValue}</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">{depositHelper}</p>
      </div>
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
  </div>
  <Button variant="link" size="sm" className="h-auto w-fit px-0 text-xs font-semibold" onClick={onViewDetails}>
    {detailsLabel}
  </Button>
</div>
);

const SummaryInfoStack = ({
  className,
  entries,
}: {
  className?: string;
  entries: Array<{ label: string; value: string; helper?: string }>;
}) => (
  <div
    className={cn(
      "rounded-2xl border border-border/70 bg-white/95 p-5 shadow-sm",
      className
    )}
  >
    <div className="flex flex-col divide-y divide-border/60">
      {entries.map((entry, index) => (
        <div
          key={`${index}-${entry.label}`}
          className={cn("flex items-start justify-between gap-4", index > 0 && "pt-4")}
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {entry.label}
            </p>
            {entry.helper ? (
              <p className="text-xs text-muted-foreground">{entry.helper}</p>
            ) : null}
          </div>
          <p className="text-sm font-semibold text-slate-900 text-right">{entry.value}</p>
        </div>
      ))}
    </div>
  </div>
);

const SummaryDescriptionBlock = ({
  content,
  fallback,
}: {
  content?: string | null;
  fallback: string;
}) => (
  <div className="rounded-2xl border border-border/60 bg-white/95 p-4 shadow-sm">
    <p
      className={cn(
        "text-sm leading-relaxed",
        content ? "text-slate-900" : "text-muted-foreground"
      )}
    >
      {content && content.trim().length ? content : fallback}
    </p>
  </div>
);
