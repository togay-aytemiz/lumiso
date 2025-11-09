import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ComposedChart, Line, CartesianGrid, XAxis, YAxis } from "recharts";
import type { TrendGrouping, PaymentTrendPoint } from "../types";
import { SegmentedControl } from "@/components/ui/segmented-control";

interface PaymentsTrendChartProps {
  hasTrendData: boolean;
  chartConfig: ChartConfig;
  paymentsTrend: PaymentTrendPoint[];
  trendGrouping: TrendGrouping;
  onTrendGroupingChange: (grouping: TrendGrouping) => void;
  rangeLabel: string;
  compactCurrencyFormatter: Intl.NumberFormat;
  formatCurrency: (value: number) => string;
}

export function PaymentsTrendChart({
  hasTrendData,
  chartConfig,
  paymentsTrend,
  trendGrouping,
  onTrendGroupingChange,
  rangeLabel,
  compactCurrencyFormatter,
  formatCurrency,
}: PaymentsTrendChartProps) {
  const { t } = useTranslation("pages");
  const resolveLegendLabel = (name: string) => {
    const normalized = name.toLowerCase();
    const configEntry = chartConfig[normalized];
    return configEntry?.label ?? name;
  };

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-medium">
            {t("payments.chart.title")}
          </CardTitle>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("payments.chart.groupingLabel")}
          </span>
          <SegmentedControl
            size="sm"
            value={trendGrouping}
            onValueChange={(value) => onTrendGroupingChange(value as TrendGrouping)}
            options={[
              { value: "day", label: t("payments.chart.grouping.day") },
              { value: "week", label: t("payments.chart.grouping.week") },
              { value: "month", label: t("payments.chart.grouping.month") },
            ]}
          />
        </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasTrendData ? (
          <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
            <ComposedChart data={paymentsTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => compactCurrencyFormatter.format(Number(value))}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex w-full items-center justify-between gap-6">
                        <span className="text-muted-foreground">
                          {typeof name === "string"
                            ? resolveLegendLabel(name)
                            : name}
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Line
                key={`paid-${trendGrouping}-${rangeLabel}`}
                type="monotone"
                dataKey="paid"
                stroke={chartConfig.paid.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
                isAnimationActive={paymentsTrend.length > 1}
                animationDuration={600}
              />
              <Line
                key={`refund-${trendGrouping}-${rangeLabel}`}
                type="monotone"
                dataKey="refund"
                stroke={chartConfig.refund.color}
                strokeWidth={2}
                dot={false}
                strokeDasharray="2 6"
                activeDot={{ r: 5 }}
                isAnimationActive={paymentsTrend.length > 1}
                animationDuration={600}
              />
            </ComposedChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-muted-foreground/20 bg-muted/10 text-sm text-muted-foreground">
            {t("payments.chart.empty")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
