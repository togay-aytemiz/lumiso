import { AdminUsersSummaryMetrics } from "../types";
import { useTranslation } from "react-i18next";
import { Users, Crown, Clock, AlertTriangle, Gift, ShieldX } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { getKpiIconPreset } from "@/components/ui/kpi-presets";
import { Skeleton } from "@/components/ui/skeleton";

interface UsersSummaryCardsProps {
  metrics: AdminUsersSummaryMetrics;
  isLoading?: boolean;
}

const cardIconMap = {
  total: Users,
  premium: Crown,
  trials: Clock,
  expiring: AlertTriangle,
  complimentary: Gift,
  suspended: ShieldX,
} as const;

const iconPresetMap = {
  total: "blue",
  premium: "emerald",
  trials: "violet",
  expiring: "amber",
  complimentary: "pink",
  suspended: "slate",
} as const;

const numberFormatter = new Intl.NumberFormat();

export function UsersSummaryCards({ metrics, isLoading }: UsersSummaryCardsProps) {
  const { t } = useTranslation("pages");
  const cards = [
    {
      key: "total",
      label: t("admin.users.summary.total"),
      description: t("admin.users.summary.totalHint"),
      value: metrics.totalUsers,
    },
    {
      key: "premium",
      label: t("admin.users.summary.premium"),
      description: t("admin.users.summary.premiumHint"),
      value: metrics.premiumUsers,
    },
    {
      key: "trials",
      label: t("admin.users.summary.trials"),
      description: t("admin.users.summary.trialsHint"),
      value: metrics.activeTrials,
    },
    {
      key: "expiring",
      label: t("admin.users.summary.expiring"),
      description: t("admin.users.summary.expiringHint"),
      value: metrics.expiringTrials,
    },
    {
      key: "complimentary",
      label: t("admin.users.summary.complimentary"),
      description: t("admin.users.summary.complimentaryHint"),
      value: metrics.complimentaryUsers,
    },
    {
      key: "suspended",
      label: t("admin.users.summary.suspended"),
      description: t("admin.users.summary.suspendedHint"),
      value: metrics.suspendedUsers,
    },
  ] as const;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.key}
            className="h-full rounded-2xl border border-border/60 bg-muted/40 p-4 sm:p-5"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="mt-6 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const Icon = cardIconMap[card.key];
        const iconProps = getKpiIconPreset(iconPresetMap[card.key]);
        return (
          <KpiCard
            key={card.key}
            className="h-full"
            density="compact"
            icon={Icon}
            {...iconProps}
            title={card.label}
            subtitle={card.description}
            value={numberFormatter.format(card.value)}
          />
        );
      })}
    </div>
  );
}
