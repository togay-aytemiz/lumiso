import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useProjectCreationContext } from "../hooks/useProjectCreationContext";
import { useProjectCreationActions } from "../hooks/useProjectCreationActions";
import { SummaryTotalRow, SummaryTotalsCard, SummaryTotalsDivider, SummaryTotalsSection } from "@/components/services";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { calculateLineItemPricing } from "@/features/package-creation/utils/lineItemPricing";
import { normalizeServiceUnit } from "@/lib/services/units";
import { usePackages, useOrganizationTaxProfile } from "@/hooks/useOrganizationData";
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
  const { setCurrentStep } = useProjectCreationActions();

  const packagesQuery = usePackages();
  const taxProfileQuery = useOrganizationTaxProfile();
  const vatExempt = Boolean(taxProfileQuery.data?.vatExempt);
  const vatUiEnabled = !vatExempt;
  const packages = (packagesQuery.data as PackageRecord[]) ?? [];
  const selectedPackage = state.services.packageId
    ? packages.find((pkg) => pkg.id === state.services.packageId)
    : undefined;

  const includedItems = state.services.includedItems;
  const addOnItems = state.services.extraItems;
  const existingItems = useMemo(
    () => [...includedItems, ...addOnItems],
    [includedItems, addOnItems]
  );
  const hasServices = existingItems.length > 0;

  const normalizeItemVat = useCallback(
    (item: ProjectServiceLineItem): ProjectServiceLineItem =>
      vatUiEnabled
        ? item
        : {
            ...item,
            vatRate: null,
            vatMode: "exclusive",
          },
    [vatUiEnabled]
  );

  const aggregateItems = useCallback(
    (items: ProjectServiceLineItem[]) =>
      items.reduce(
        (acc, item) => {
          const quantity = Math.max(1, item.quantity ?? 1);
          const unitCost = Number(item.unitCost ?? 0);
          const pricing = calculateLineItemPricing(
            normalizeItemVat(item as ProjectServiceLineItem)
          );
          acc.cost += unitCost * quantity;
          acc.net += pricing.net;
          acc.vat += pricing.vat;
          acc.total += pricing.gross;
          return acc;
        },
        { cost: 0, net: 0, vat: 0, total: 0 }
      ),
    [normalizeItemVat]
  );

  const addOnTotals = useMemo(
    () => aggregateItems(addOnItems),
    [aggregateItems, addOnItems]
  );

  const includedTotals = useMemo(
    () => aggregateItems(includedItems),
    [aggregateItems, includedItems]
  );

  const servicesMargin = addOnTotals.net - addOnTotals.cost;

  const vatBreakdown = useMemo(() => {
    if (!vatUiEnabled) {
      return [];
    }
    const buckets = new Map<number, number>();
    addOnItems.forEach((item) => {
      const pricing = calculateLineItemPricing(normalizeItemVat(item as ProjectServiceLineItem));
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
  }, [addOnItems, normalizeItemVat, vatUiEnabled]);

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
    if (!vatUiEnabled) {
      if (basePriceValue > 0) {
        const gross = round(basePriceValue);
        return {
          packageNet: gross,
          packageVat: 0,
          packageGross: gross,
          packageVatRate: null,
        };
      }
      const gross = round(addOnTotals.total);
      return {
        packageNet: gross,
        packageVat: 0,
        packageGross: gross,
        packageVatRate: null,
      };
    }
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
      const vatPortion = Math.min(addOnTotals.vat, basePriceValue);
      const netPortion = round(Math.max(basePriceValue - vatPortion, 0));
      return {
        packageNet: netPortion,
        packageVat: round(vatPortion),
        packageGross: round(basePriceValue),
        packageVatRate: singleVatRate,
      };
    }

    return {
      packageNet: round(addOnTotals.net),
      packageVat: round(addOnTotals.vat),
      packageGross: round(addOnTotals.total),
      packageVatRate: singleVatRate,
    };
  }, [addOnTotals, basePriceValue, vatBreakdown, vatUiEnabled]);

  const clientNet = includeAddOnsInPrice
    ? packageDerived.packageNet
    : packageDerived.packageNet + addOnTotals.net;
  const clientTax = includeAddOnsInPrice
    ? packageDerived.packageVat
    : packageDerived.packageVat + addOnTotals.vat;
  const clientTotal = includeAddOnsInPrice
    ? packageDerived.packageGross
    : packageDerived.packageGross + addOnTotals.total;

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

  const clientTotalHelper = includeAddOnsInPrice
    ? t("steps.packages.summary.clientTotalHelperInclusive")
    : addOnTotals.total > 0
    ? t("steps.packages.summary.clientTotalHelperExtras", {
        defaultValue: "Add-ons are billed on top of the package.",
      })
    : undefined;

  const getUnitLabel = useCallback(
    (unit?: string | null) =>
      t(`steps.packages.units.short.${normalizeServiceUnit(unit)}`, {
        defaultValue: t(`steps.packages.units.options.${normalizeServiceUnit(unit)}`),
      }),
    [t]
  );

  const includedItemIds = useMemo(
    () => new Set(state.services.includedItems.map((item) => item.id)),
    [state.services.includedItems]
  );

  const servicesTableRows = useMemo<ServicesTableRow[]>(() => {
    return existingItems.map((item) => {
      const quantity = Math.max(1, item.quantity ?? 1);
      const pricing = calculateLineItemPricing(item as ProjectServiceLineItem);
      const hasUnitCost = typeof item.unitCost === "number" && Number.isFinite(item.unitCost);
      const lineCost =
        hasUnitCost ? Math.round(Number(item.unitCost ?? 0) * quantity * 100) / 100 : null;
      const rawUnitPrice =
        typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice)
          ? item.unitPrice
          : null;
      const isIncluded = includedItemIds.has(item.id);
      const unitPrice = isIncluded ? null : rawUnitPrice;
      const lineTotal = isIncluded ? null : Math.round(pricing.gross * 100) / 100;
      return {
        id: item.id,
        name: item.name,
        vendor: item.vendorName ?? undefined,
        quantity,
        unitLabel: getUnitLabel(item.unit),
        lineCost,
        unitPrice,
        lineTotal,
        isCustom: item.type === "custom",
      };
    });
  }, [existingItems, getUnitLabel, includedItemIds]);

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
            detailsLabel={t("summary.cards.pricing.detailsLink")}
          />
          <SummaryInfoStack className="lg:col-span-2" entries={infoEntries} />
        </div>
      </section>

      {(servicesReferenceStrings.includedChip ||
        servicesReferenceStrings.addOnChip ||
        servicesReferenceStrings.addOnTotalChip) && (
        <section className="space-y-3">
          <SummaryServicesReference
            title={servicesReferenceStrings.title}
            helper={servicesReferenceStrings.helper}
            actionLabel={servicesReferenceStrings.action}
            includedChip={servicesReferenceStrings.includedChip}
            addOnChip={servicesReferenceStrings.addOnChip}
            addOnTotalChip={servicesReferenceStrings.addOnTotalChip}
            onOpenServices={openServices}
          />
        </section>
      )}

      <section className="space-y-3">
        <SummarySectionHeading>{t("summary.description.heading")}</SummarySectionHeading>
        <SummaryDescriptionBlock
          content={description}
          fallback={t("summary.description.empty")}
        />
      </section>

    </div>
  );
};

const SummarySectionHeading = ({ children }: { children: string }) => (
  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    {children}
  </p>
);

interface SummaryServicesReferenceProps {
  title: string;
  helper: string;
  actionLabel: string;
  includedChip?: ServiceChipProps | null;
  addOnChip?: ServiceChipProps | null;
  addOnTotalChip?: ServiceChipProps | null;
  onOpenServices: () => void;
}

const SummaryServicesReference = ({
  title,
  helper,
  actionLabel,
  includedChip,
  addOnChip,
  addOnTotalChip,
  onOpenServices,
}: SummaryServicesReferenceProps) => {
  return (
    <div className="rounded-2xl border border-border/70 bg-white/95 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-muted-foreground">{helper}</p>
        </div>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-0 text-xs font-semibold"
          onClick={onOpenServices}
        >
          {actionLabel}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {includedChip ? <ServiceChip {...includedChip} /> : null}
        {addOnChip ? <ServiceChip {...addOnChip} /> : null}
        {addOnTotalChip ? <ServiceChip {...addOnTotalChip} /> : null}
      </div>
    </div>
  );
};

interface ServiceChipProps {
  label: string;
  tooltip?: string | null;
}

const ServiceChip = ({ label, tooltip }: ServiceChipProps) => {
  const chip = (
    <span className="rounded-full border border-border/60 bg-white px-3 py-1 text-xs font-semibold text-slate-900">
      {label}
    </span>
  );

  if (!tooltip) return chip;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent className="text-xs font-medium text-slate-900">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
};

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
  onViewDetails?: () => void;
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
  {onViewDetails ? (
    <Button variant="link" size="sm" className="h-auto w-fit px-0 text-xs font-semibold" onClick={onViewDetails}>
      {detailsLabel}
    </Button>
  ) : null}
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
