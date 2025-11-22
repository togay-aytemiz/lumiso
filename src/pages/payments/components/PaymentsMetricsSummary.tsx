import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PAYMENT_COLORS } from "@/lib/paymentColors";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { PaymentMetrics } from "../types";

interface PaymentsMetricsSummaryProps {
  metrics: PaymentMetrics;
  formatCurrency: (value: number) => string;
  formatPercent: (value: number) => string;
}

export function PaymentsMetricsSummary({
  metrics,
  formatCurrency,
  formatPercent,
}: PaymentsMetricsSummaryProps) {
  const { t } = useTranslation("pages");

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-medium">{t("payments.metrics.overviewTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">{t("payments.metrics.netCollected")}</span>
            <div className={cn("text-2xl font-semibold", PAYMENT_COLORS.paid.textClass)}>
              {formatCurrency(metrics.netCollected)}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {t("payments.metrics.netBreakdown", {
              paid: formatCurrency(metrics.totalPaid),
              refunded: formatCurrency(metrics.totalRefunded),
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">{t("payments.metrics.totalInvoiced")}</span>
            <div className="text-lg font-semibold">{formatCurrency(metrics.totalInvoiced)}</div>
          </div>
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">{t("payments.metrics.remainingBalance")}</span>
            <div className={cn("text-lg font-semibold", PAYMENT_COLORS.due.textClass)}>
              {formatCurrency(metrics.remainingBalance)}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">{t("payments.metrics.totalPaid")}</span>
            <div className="text-lg font-semibold text-foreground">
              {formatCurrency(metrics.totalPaid)}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">{t("payments.metrics.totalRefunded")}</span>
            <div className={cn("text-lg font-semibold", PAYMENT_COLORS.refund.textClass)}>
              {formatCurrency(metrics.totalRefunded)}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{t("payments.metrics.collectionRate")}</span>
            <span className="font-medium text-foreground">{formatPercent(metrics.collectionRate)}</span>
          </div>
          <Progress className="h-2" value={metrics.collectionRate * 100} />
          <div className="text-xs text-muted-foreground">
            {t("payments.metrics.collectionRateHint", {
              net: formatCurrency(metrics.netCollected),
              invoiced: formatCurrency(metrics.totalInvoiced),
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
