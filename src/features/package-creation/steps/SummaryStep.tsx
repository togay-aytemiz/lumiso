import { ReactNode, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useProjectTypes } from "@/hooks/useOrganizationData";
import { usePackageCreationSnapshot } from "../hooks/usePackageCreationSnapshot";
import { calculateLineItemPricing } from "../utils/lineItemPricing";
import type { PackageCreationLineItem } from "../types";
import { DEFAULT_SERVICE_UNIT, normalizeServiceUnit } from "@/lib/services/units";

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

  const visibilityLabel = snapshot.basics.isActive
    ? t("summaryView.cards.visibilityActive")
    : t("summaryView.cards.visibilityInactive");

  const typesLabel = snapshot.basics.applicableTypeIds.length
    ? selectedTypeNames.length
      ? selectedTypeNames.join(", ")
      : t("summaryView.notSet")
    : t("summaryView.cards.typesAll");

  const serviceCountLabel = snapshot.services.itemCount
    ? t("summaryView.cards.servicesCount", { count: snapshot.services.itemCount })
    : t("summaryView.none");

  const serviceQuantityLabel = snapshot.services.totalQuantity
    ? t("summaryView.cards.servicesQuantity", { count: snapshot.services.totalQuantity })
    : null;

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

  const depositHasValue = snapshot.pricing.depositAmount > 0;
  const depositSummary: ReactNode = depositHasValue ? (
    snapshot.pricing.depositMode === "fixed" ? (
      `${t("summaryView.pricing.deposit.fixed")} • ${formatCurrency(snapshot.pricing.depositValue)}`
    ) : (
      t("summaryView.pricing.deposit.percent", {
        percent: formatPercent(snapshot.pricing.depositValue),
        target: t(`summaryView.pricing.targets.${snapshot.pricing.depositTarget ?? "subtotal"}`),
      })
    )
  ) : (
    <span className="text-muted-foreground">{t("summaryView.pricing.deposit.none")}</span>
  );

  const depositHelper = depositHasValue
    ? `${t("summaryView.pricing.deposit.amountDue")}: ${formatCurrency(snapshot.pricing.depositAmount)}`
    : undefined;

  const clientTotalHelper = (
    <span className="flex flex-col gap-1">
      <span>
        {t("summaryView.pricing.clientTotalBreakdown", {
          net: formatCurrency(combinedNet),
          vat: formatCurrency(combinedVat),
        })}
      </span>
      <span>
        {includeAddOnsInPrice
          ? t("summaryView.pricing.clientTotalHelper.addOns")
          : t("summaryView.pricing.clientTotalHelper.inclusive")}
      </span>
    </span>
  );

  const getUnitLabel = useCallback(
    (unit?: string | null) =>
      t(`steps.services.units.short.${normalizeServiceUnit(unit)}`, {
        defaultValue: t(`steps.services.units.options.${normalizeServiceUnit(unit)}`),
      }),
    [t]
  );

  const serviceSummaries = snapshot.services.items.map((item) => {
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

    return {
      id: item.id,
      name: item.name,
      vendor: item.vendorName,
      isCustom: item.type === "custom",
      quantity,
      unitLabel: getUnitLabel(item.unit ?? DEFAULT_SERVICE_UNIT),
      lineTotal: roundToTwo(pricing.gross),
    };
  });

  const packageVatModeLabel = t(`steps.pricing.packageVat.mode.${snapshot.pricing.packageVatMode}`, {
    defaultValue: snapshot.pricing.packageVatMode === "inclusive" ? "Included in price" : "Add on top",
  });

  const pricingHighlights: Array<{
    key: string;
    label: string;
    value: ReactNode;
    helper?: ReactNode;
    tone?: "positive" | "negative";
  }> = [
    {
      key: "packagePrice",
      label: t("summaryView.pricing.packagePrice"),
      value: formatCurrency(snapshot.pricing.basePrice),
      helper: t("summaryView.pricing.packageVatSummary", {
        rate: formatPercent(snapshot.pricing.packageVatRate),
        mode: packageVatModeLabel,
        amount: formatCurrency(snapshot.pricing.basePriceVatPortion),
      }),
    },
    {
      key: "servicesGross",
      label: t("summaryView.pricing.servicesGrossTotal", { defaultValue: "Total (incl. VAT)" }),
      value: formatCurrency(snapshot.pricing.servicesGrossTotal),
      helper:
        snapshot.pricing.servicesVatTotal > 0
          ? `${t("summaryView.pricing.servicesVatTotal", { defaultValue: "VAT total" })}: ${formatCurrency(
              snapshot.pricing.servicesVatTotal
            )}`
          : undefined,
    },
    {
      key: "clientTotal",
      label: t("summaryView.pricing.clientTotal"),
      value: formatCurrency(clientTotal),
      helper: clientTotalHelper,
    },
    {
      key: "deposit",
      label: t("summaryView.pricing.deposit.label"),
      value: depositSummary,
      helper: depositHelper,
    },
    {
      key: "margin",
      label: t("summaryView.pricing.margin"),
      value: formatCurrency(snapshot.pricing.servicesMargin),
      tone: snapshot.pricing.servicesMargin >= 0 ? "positive" : "negative",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {t("summaryView.sectionTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("summaryView.intro")}</p>
      </header>

      <section className="space-y-3">
        <SummaryHeading>{t("summaryView.meta.title")}</SummaryHeading>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title={t("summaryView.cards.name")}
            primary={snapshot.basics.name || t("summaryView.notSet")}
            helper={
              snapshot.basics.description
                ? truncate(snapshot.basics.description, 80)
                : t("summaryView.cards.descriptionFallback")
            }
          />
          <SummaryCard
            title={t("summaryView.cards.visibility")}
            primary={
              <Badge
                variant={snapshot.basics.isActive ? "secondary" : "outline"}
                className={cn(
                  "inline-flex items-center whitespace-nowrap rounded-full px-4 py-1 text-xs font-semibold",
                  snapshot.basics.isActive
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "border-slate-300 bg-white text-slate-600"
                )}
              >
                {visibilityLabel}
              </Badge>
            }
          />
          <SummaryCard title={t("summaryView.cards.types")} primary={typesLabel} />
          <SummaryCard
            title={t("summaryView.cards.services")}
            primary={serviceCountLabel}
            helper={serviceQuantityLabel ?? undefined}
          />
        </div>
      </section>

      <section className="space-y-3">
        <SummaryHeading>{t("summaryView.services.title")}</SummaryHeading>
        <div className="space-y-2 rounded-xl border border-border/60 bg-white p-4">
          {serviceSummaries.length ? (
            serviceSummaries.map((service) => (
              <div
                key={service.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-slate-200/70 bg-white px-3 py-2"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{service.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {service.vendor ? (
                      <span>
                        {t("summaryView.services.columns.vendor")}: {service.vendor}
                      </span>
                    ) : null}
                    {service.isCustom ? (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        {t("summaryView.services.customTag")}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(service.lineTotal)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ×{service.quantity}
                    {service.unitLabel ? ` · ${service.unitLabel}` : ""}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{t("summaryView.services.empty")}</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <SummaryHeading>{t("summaryView.pricing.title")}</SummaryHeading>
        <div className="rounded-xl border border-border/60 bg-white p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {pricingHighlights.map((metric) => (
              <SummaryListItem
                key={metric.key}
                label={metric.label}
                value={metric.value}
                helper={metric.helper}
                tone={metric.tone}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SummaryHeading>{t("summaryView.delivery.title")}</SummaryHeading>
        <div className="rounded-xl border border-border/60 bg-white p-4">
          <SummaryListItem label={t("summaryView.delivery.estimateLabel")} value={photoEstimateLabel} />
          <SummaryListItem label={t("summaryView.delivery.leadTime.label")} value={leadTimeLabel} />
          <SummaryListItem
            label={t("summaryView.delivery.methods.label")}
            value={
              !snapshot.delivery.methodsEnabled ? (
                <span className="text-muted-foreground">
                  {t("summaryView.delivery.methods.disabled")}
                </span>
              ) : methods.length ? (
                <div className="flex flex-wrap gap-2">
                  {methods.map((method) => (
                    <Badge key={method} variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {method}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {t("summaryView.delivery.methods.empty")}
                </span>
              )
            }
          />
        </div>
      </section>

      <section className="space-y-3">
        <SummaryHeading>{t("summaryView.description.title")}</SummaryHeading>
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
    </div>
  );
};

const SummaryHeading = ({ children }: { children: string }) => (
  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>
);

const SummaryCard = ({
  title,
  primary,
  helper,
}: {
  title: string;
  primary: ReactNode;
  helper?: ReactNode;
}) => (
  <div className="rounded-2xl border border-border/70 bg-white/95 p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
    <div className="mt-2 text-sm font-semibold text-slate-900">{primary}</div>
    {helper ? <div className="mt-1 text-xs text-muted-foreground">{helper}</div> : null}
  </div>
);

const SummaryListItem = ({
  label,
  value,
  helper,
  tone,
  showDivider = true,
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  tone?: "positive" | "negative";
  showDivider?: boolean;
}) => (
  <div
    className={cn(
      "flex flex-col gap-1 py-2",
      showDivider ? "border-t border-slate-100 first:border-t-0 first:pt-0" : ""
    )}
  >
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    <div
      className={cn(
        "text-sm font-medium text-slate-900",
        tone === "positive" && "text-emerald-600",
        tone === "negative" && "text-rose-600"
      )}
    >
      {value}
    </div>
    {helper ? <div className="text-xs text-muted-foreground">{helper}</div> : null}
  </div>
);

const truncate = (value: string, limit: number) => {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
};

const roundToTwo = (value: number) => Math.round(value * 100) / 100;
