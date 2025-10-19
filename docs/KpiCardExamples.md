# KpiCard Usage Examples

The `KpiCard` component is designed to be translation-friendly and reused across dashboards, list pages, and summary surfaces. Below are practical integrations you can copy into your pages or Storybook setups.

## Workflows Overview

```tsx
import { Zap, CheckCircle, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";

function WorkflowStats({ stats, onFilterChange }: Props) {
  const { t } = useTranslation("pages");
  const totalSummary = t("workflows.stats.summary", {
    active: stats.active,
    paused: stats.paused,
  });
  const actionButtonClass =
    "h-8 rounded-full border border-border/60 bg-background/85 px-4 text-sm font-medium text-foreground shadow-sm transition-colors duration-200 hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2";
  const activeCoverage = stats.total > 0 ? (stats.active / stats.total) * 100 : 0;
  const pausedShare = stats.total > 0 ? (stats.paused / stats.total) * 100 : 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <KpiCard
        icon={Zap}
        iconBackground="bg-primary/10"
        iconForeground="text-primary"
        title={t("workflows.stats.totalWorkflows")}
        value={stats.total}
        description={totalSummary}
        footer={
          <Button
            size="xs"
            variant="outline"
            className={actionButtonClass}
            onClick={() => onFilterChange("all")}
          >
            {t("workflows.stats.viewAll")}
          </Button>
        }
      />
      <KpiCard
        icon={CheckCircle}
        iconBackground="bg-emerald-500/10"
        iconForeground="text-emerald-600"
        title={t("workflows.stats.active")}
        value={stats.active}
        description={t("workflows.stats.activeDescription")}
        progress={{
          value: activeCoverage,
          label: t("workflows.stats.coverageLabel"),
          ariaLabel: t("workflows.stats.coverageAriaLabel"),
          action: (
            <Button
              size="xs"
              variant="outline"
              className={actionButtonClass}
              onClick={() => onFilterChange("active")}
            >
              {t("workflows.stats.quickFilterActive")}
            </Button>
          ),
        }}
        trend={{
          label: t("workflows.stats.activeTrendLabel"),
          tone: "positive",
        }}
      />
      <KpiCard
        icon={Clock}
        iconBackground="bg-amber-500/10"
        iconForeground="text-amber-600"
        title={t("workflows.stats.paused")}
        value={stats.paused}
        description={t("workflows.stats.pausedDescription")}
        progress={{
          value: pausedShare,
          label: t("workflows.stats.pausedShareLabel"),
          ariaLabel: t("workflows.stats.pausedShareAriaLabel"),
          action: (
            <Button
              size="xs"
              variant="outline"
              className={actionButtonClass}
              onClick={() => onFilterChange("paused")}
            >
              {t("workflows.stats.quickFilterPaused")}
            </Button>
          ),
        }}
      />
    </div>
  );
}
```

## Payment Metrics

```tsx
import { CreditCard, DollarSign, Receipt } from "lucide-react";
import { formatCurrency } from "@/utils/number";
import { KpiCard } from "@/components/ui/kpi-card";

export function PaymentKpis({ metrics, t }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <KpiCard
        icon={DollarSign}
        iconBackground="bg-emerald-500/10"
        iconForeground="text-emerald-600"
        title={t("payments.metrics.monthlyRevenue")}
        value={formatCurrency(metrics.monthlyRevenue)}
        trend={{
          label: t("payments.metrics.revenueTrendLabel", { value: "+18%" }),
          tone: "positive",
        }}
        description={t("payments.metrics.monthlyRevenueDescription")}
      />
      <KpiCard
        icon={CreditCard}
        iconBackground="bg-indigo-500/10"
        iconForeground="text-indigo-600"
        title={t("payments.metrics.pendingPayouts")}
        value={formatCurrency(metrics.pendingPayouts)}
        trend={{
          label: t("payments.metrics.pendingTrendLabel", { value: "−5%" }),
          tone: "negative",
        }}
        description={t("payments.metrics.pendingPayoutsDescription")}
      />
      <KpiCard
        icon={Receipt}
        iconBackground="bg-slate-500/10"
        iconForeground="text-slate-600"
        title={t("payments.metrics.averageInvoice")}
        value={formatCurrency(metrics.averageInvoice)}
        description={t("payments.metrics.averageInvoiceDescription")}
      />
    </div>
  );
}
```

## Executive Dashboard Snapshot

```tsx
import { Users, Sparkles, Activity } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";

export function DashboardHighlights({ data, t }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
      <KpiCard
        icon={Users}
        iconBackground="bg-blue-500/10"
        iconForeground="text-blue-600"
        subtitle={t("dashboard.sections.pipeline")}
        title={t("dashboard.metrics.newLeads")}
        value={data.newLeads}
        trend={{
          label: t("dashboard.metrics.newLeadsTrend"),
          tone: "positive",
        }}
        description={t("dashboard.metrics.newLeadsDescription")}
      />
      <KpiCard
        icon={Sparkles}
        iconBackground="bg-fuchsia-500/15"
        iconForeground="text-fuchsia-600"
        subtitle={t("dashboard.sections.automation")}
        title={t("dashboard.metrics.aiAssists")}
        value={data.aiAssists}
        description={
          <span className="text-muted-foreground">
            {t("dashboard.metrics.aiAssistsDescription", { percentage: data.aiAssistRate })}
          </span>
        }
      />
      <KpiCard
        icon={Activity}
        iconBackground="bg-amber-500/10"
        iconForeground="text-amber-600"
        subtitle={t("dashboard.sections.health")}
        title={t("dashboard.metrics.slaAchievement")}
        value={`${data.slaAchievement}%`}
        progress={{
          value: data.slaAchievement,
          label: t("dashboard.metrics.slaProgressLabel"),
          ariaLabel: t("dashboard.metrics.slaProgressAriaLabel"),
        }}
      />
      <KpiCard
        subtitle={t("dashboard.sections.custom")}
        title={t("dashboard.metrics.customSlotTitle")}
        value={data.customValue}
        description={data.customDescription}
        footer={data.customFooter}
      />
    </div>
  );
}
```

> **Tip:** For Storybook, treat each block above as a dedicated story that passes localized strings via args. This keeps the component itself free of hardcoded copy while showcasing real-world scenarios.
