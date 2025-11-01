import { ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { ServicesTableCard, type ServicesTableRow } from "@/components/ServicesTableCard";
import { cn } from "@/lib/utils";
import { useProjectTypes } from "@/hooks/useOrganizationData";
import { usePackageCreationSnapshot } from "../hooks/usePackageCreationSnapshot";
import { calculateLineItemPricing } from "../utils/lineItemPricing";
import type { PackageCreationLineItem } from "../types";

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
      return <span className="text-muted-foreground">{t("summaryView.delivery.estimate.disabled", { defaultValue: "Not tracked" })}</span>;
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
      return <span className="text-muted-foreground">{t("summaryView.delivery.leadTime.disabled", { defaultValue: "Not tracked" })}</span>;
    }
    if (!snapshot.delivery.leadTimeValue) {
      return <span className="text-muted-foreground">{t("summaryView.delivery.leadTime.notSet")}</span>;
    }

    const unit = t(
      `summaryView.delivery.leadTime.unit.${snapshot.delivery.leadTimeUnit ?? "days"}`
    );
    return t("summaryView.delivery.leadTime.value", {
      value: snapshot.delivery.leadTimeValue,
      unit,
    });
  })();

  const methods = snapshot.delivery.methodsEnabled && snapshot.delivery.methods.length
    ? snapshot.delivery.methods.map((method) => method.name ?? t("summaryView.delivery.methods.unknown"))
    : [];

  const clientTotal = snapshot.pricing.clientTotal;
  const includeAddOnsInPrice = snapshot.pricing.includeAddOnsInPrice;

  const depositHasValue = snapshot.pricing.depositAmount > 0;
  const depositSummary: ReactNode = depositHasValue
    ? snapshot.pricing.depositMode === "fixed"
      ? `${t("summaryView.pricing.deposit.fixed")} • ${formatCurrency(snapshot.pricing.depositValue)}`
      : t("summaryView.pricing.deposit.percent", {
          percent: formatPercent(snapshot.pricing.depositValue),
          target: t(
            `summaryView.pricing.targets.${snapshot.pricing.depositTarget ?? "subtotal"}`
          ),
        })
    : <span className="text-muted-foreground">{t("summaryView.pricing.deposit.none")}</span>;

  const depositHelper = depositHasValue
    ? `${t("summaryView.pricing.deposit.amountDue")}: ${formatCurrency(snapshot.pricing.depositAmount)}`
    : undefined;

  const clientTotalHelper = includeAddOnsInPrice
    ? t("summaryView.pricing.clientTotalHelper.addOns")
    : t("summaryView.pricing.clientTotalHelper.inclusive");

  const servicesRows: ServicesTableRow[] = snapshot.services.items.map((item) => {
    const unitPrice = item.unitPrice ?? null;
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
      quantity: item.quantity,
      vendor: item.vendorName,
      isCustom: item.type === "custom",
      unitPrice,
      lineTotal: roundToTwo(pricing.gross),
    };
  });

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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title={t("summaryView.cards.name")}
            primary={snapshot.basics.name || t("summaryView.notSet")}
            helper={snapshot.basics.description ? truncate(snapshot.basics.description, 80) : t("summaryView.cards.descriptionFallback")}
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
        <ServicesTableCard
          rows={servicesRows}
          totals={{
            cost: snapshot.services.totals.cost,
            price: snapshot.services.totals.price,
            vat: snapshot.services.totals.vat,
            total: snapshot.services.totals.total,
            margin: snapshot.pricing.servicesMargin,
          }}
          labels={{
            columns: {
              name: t("summaryView.services.columns.name"),
              vendor: t("summaryView.services.columns.vendor"),
              quantity: t("summaryView.services.columns.quantity"),
              unitPrice: t("summaryView.services.columns.unitPrice"),
              lineTotal: t("summaryView.services.columns.lineTotal"),
            },
            totals: {
              cost: t("summaryView.services.totals.cost"),
              price: t("summaryView.services.totals.price"),
              margin: t("summaryView.services.totals.margin"),
            },
            customTag: t("summaryView.services.customTag"),
            customVendorFallback: t("summaryView.services.customVendorFallback"),
          }}
          emptyMessage={t("summaryView.services.empty")}
          formatCurrency={(value) => formatCurrency(value)}
        />
      </section>

      <section className="space-y-3">
        <SummaryHeading>{t("summaryView.delivery.title")}</SummaryHeading>
        <div className="rounded-2xl border border-border/70 bg-white/95 p-4 shadow-sm">
          <SummaryListItem label={t("summaryView.delivery.estimateLabel")} value={photoEstimateLabel} />
          <SummaryListItem label={t("summaryView.delivery.leadTime.label") } value={leadTimeLabel} />
          <SummaryListItem
            label={t("summaryView.delivery.methods.label")}
            value={
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

      <section className="space-y-3">
        <SummaryHeading>{t("summaryView.pricing.title")}</SummaryHeading>
        <div className="rounded-2xl border border-border/70 bg-white/95 p-4 shadow-sm">
          <SummaryListItem
            label={t("summaryView.pricing.packagePrice")}
            value={formatCurrency(snapshot.pricing.basePrice)}
          />
          <SummaryListItem
            label={t("summaryView.pricing.servicesTotal")}
            value={formatCurrency(snapshot.pricing.servicesPriceTotal)}
            helper={t("summaryView.pricing.servicesTotalHelper")}
          />
          <SummaryListItem
            label={t("summaryView.pricing.servicesVatTotal", { defaultValue: "VAT total" })}
            value={formatCurrency(snapshot.pricing.servicesVatTotal)}
          />
          <SummaryListItem
            label={t("summaryView.pricing.servicesGrossTotal", { defaultValue: "Total (incl. VAT)" })}
            value={formatCurrency(snapshot.pricing.servicesGrossTotal)}
          />
          {!includeAddOnsInPrice ? (
            <SummaryListItem
              label={t("summaryView.pricing.addOnsClientTotal")}
              value={formatCurrency(snapshot.pricing.subtotal)}
              helper={t("summaryView.pricing.addOnsClientTotalHelper")}
            />
          ) : null}
          <SummaryListItem label={t("summaryView.pricing.costTotal") } value={formatCurrency(snapshot.pricing.servicesCostTotal)} />
          <SummaryListItem
            label={t("summaryView.pricing.margin")}
            value={formatCurrency(snapshot.pricing.servicesMargin)}
            tone={snapshot.pricing.servicesMargin >= 0 ? "positive" : "negative"}
          />
          <SummaryListItem
            label={t("summaryView.pricing.clientTotal")}
            value={formatCurrency(clientTotal)}
            helper={clientTotalHelper}
          />
          <SummaryListItem label={t("summaryView.pricing.deposit.label") } value={depositSummary} helper={depositHelper} />
        </div>
      </section>

      <section className="space-y-3">
        <SummaryHeading>{t("summaryView.description.title")}</SummaryHeading>
        <div className="rounded-2xl border border-border/70 bg-white/95 p-4 shadow-sm">
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
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  tone?: "positive" | "negative";
}) => (
  <div className="flex flex-col gap-1 border-t border-slate-100 py-3 first:border-t-0 first:pt-0">
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
