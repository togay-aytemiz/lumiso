import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type TrendTone = "positive" | "negative" | "neutral";

interface TrendConfig {
  /**
   * Textual representation of the trend such as "+12%" or "▼ 4 sessions".
   * Provide translations in the calling component.
   */
  label: React.ReactNode;
  /**
   * Visual tone that adjusts styling. Positive → success, Negative → destructive, Neutral → subtle.
   */
  tone?: TrendTone;
  /**
   * Optional custom icon. When omitted, the tone controls a default arrow icon.
   */
  icon?: React.ReactNode;
  /**
   * Accessible description for assistive technologies.
   */
  ariaLabel?: string;
}

interface ProgressConfig {
  /**
   * Percentage value from 0 to 100 controlling the determinate progress bar.
   */
  value: number;
  /**
   * Optional label rendered above the bar. Supply translated copy from the caller.
   */
  label?: React.ReactNode;
  /**
   * Optional helper text rendered below the bar.
   */
  helperText?: React.ReactNode;
  /**
   * Accessible fallback description for screen readers.
   */
  ariaLabel?: string;
  /**
   * Optional node rendered next to the progress block (e.g., action button).
   */
  action?: React.ReactNode;
  /**
   * Optional custom value label shown opposite the title. Defaults to the percentage value.
   */
  valueLabel?: React.ReactNode;
}

export interface KpiCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Lucide icon component rendered inside the pill.
   */
  icon?: LucideIcon | React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /**
   * Tailwind classes for the icon container background.
   */
  iconBackground?: string;
  /**
   * Tailwind classes for the icon itself.
   */
  iconForeground?: string;
  /**
   * Optional extra classes for the icon wrapper.
   */
  iconClassName?: string;
  /**
   * Optional extra classes for the icon.
   */
  iconSvgClassName?: string;
  /**
   * Optional text displayed above the title (e.g., timeframe).
   */
  subtitle?: React.ReactNode;
  /**
   * Primary heading content. Provide translated content via props.
   */
  title: React.ReactNode;
  /**
   * Heading level for the title.
   */
  headingLevel?: "h2" | "h3" | "h4" | "h5" | "h6";
  /**
   * KPI value – supports numbers, strings, or custom React nodes.
   */
  value: React.ReactNode;
  /**
   * Supporting description text.
   */
  description?: React.ReactNode;
  /**
   * Optional progress visual with label/helper text.
   */
  progress?: ProgressConfig;
  /**
   * Optional footer node (e.g., CTA, quick actions).
   */
  footer?: React.ReactNode;
  /**
   * Trend badge describing change over time.
   */
  trend?: TrendConfig;
  /**
   * Optional aria label when the surrounding context does not provide one.
   */
  ariaLabel?: string;
}

const trendToneStyles: Record<TrendTone, string> = {
  positive:
    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  negative:
    "bg-destructive/10 text-destructive border border-destructive/20",
  neutral:
    "bg-muted text-muted-foreground border border-border/60",
};

const fallbackTrendIcon: Record<TrendTone, React.ReactNode> = {
  positive: <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />,
  negative: <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />,
  neutral: <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />,
};

export const KpiCard = React.forwardRef<HTMLDivElement, KpiCardProps>(
  (
    {
      className,
      icon: Icon,
      iconBackground = "bg-primary/15",
      iconForeground = "text-primary",
      iconClassName,
      iconSvgClassName,
      subtitle,
      title,
      headingLevel = "h3",
      value,
      description,
      progress,
      footer,
      trend,
      onClick,
      ariaLabel,
      tabIndex,
      onKeyDown: onKeyDownProp,
      ...rest
    },
    ref,
  ) => {
    const titleId = React.useId();
    const subtitleId = React.useId();
    const descriptionId = React.useId();
    const progressId = React.useId();
    const progressHelperId = React.useId();
    const trendId = React.useId();

    const describedBy = React.useMemo(() => {
      const ids: string[] = [];
      if (subtitle) ids.push(subtitleId);
      if (description) ids.push(descriptionId);
      if (progress?.label || progress?.ariaLabel) ids.push(progressId);
      if (progress?.helperText) ids.push(progressHelperId);
      if (trend?.label || trend?.ariaLabel) ids.push(trendId);
      return ids.length > 0 ? ids.join(" ") : undefined;
    }, [
      subtitle,
      subtitleId,
      description,
      descriptionId,
      progress?.label,
      progress?.ariaLabel,
      progressId,
      progress?.helperText,
      progressHelperId,
      trend?.label,
      trend?.ariaLabel,
      trendId,
    ]);

    const HeadingTag = headingLevel;

    const tone = trend?.tone ?? "neutral";
    const trendIcon =
      trend?.icon ??
      (trend ? fallbackTrendIcon[tone] : null);

    return (
      <Card
        ref={ref}
        className={cn(
          "group relative isolate overflow-hidden border-border/60 bg-gradient-to-br from-muted/60 via-background to-background shadow-sm transition-all duration-300 ease-out",
          onClick
            ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:-translate-y-1 hover:shadow-xl"
            : "hover:-translate-y-0.5 hover:shadow-xl",
          className,
        )}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? tabIndex ?? 0 : tabIndex}
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        onClick={onClick}
        onKeyDown={
          onClick
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onClick(event as unknown as React.MouseEvent<HTMLDivElement, MouseEvent>);
                }
                if (onKeyDownProp) {
                  onKeyDownProp(event);
                }
              }
            : onKeyDownProp
        }
        {...rest}
      >
        <div className="flex flex-col gap-5 p-5 sm:gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-1 items-start gap-3">
              {Icon && (
                <span
                  className={cn(
                    "rounded-xl p-2.5 transition-colors duration-300",
                    iconBackground,
                    iconClassName,
                  )}
                >
                  <Icon
                    className={cn(
                      "h-6 w-6",
                      iconForeground,
                      iconSvgClassName,
                    )}
                    aria-hidden="true"
                  />
                </span>
              )}
              <div className="space-y-2">
                {subtitle && (
                  <p
                    id={subtitleId}
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {subtitle}
                  </p>
                )}
                <HeadingTag
                  id={titleId}
                  className="text-sm font-medium text-muted-foreground"
                >
                  {title}
                </HeadingTag>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-3xl font-semibold leading-none text-foreground">
                    {value}
                  </span>
                  {trend && (
                    <Badge
                      id={trendId}
                      variant="secondary"
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shadow-none transition-colors",
                        trendToneStyles[tone],
                      )}
                    >
                      {trendIcon}
                      <span>
                        {trend.label}
                      </span>
                      {trend.ariaLabel && (
                        <span className="sr-only">{trend.ariaLabel}</span>
                      )}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {description && (
            <p
              id={descriptionId}
              className="text-sm leading-relaxed text-muted-foreground"
            >
              {description}
            </p>
          )}

          {progress && (
            <div className="space-y-2">
              <div className="flex w-full flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  {(progress.label || progress.ariaLabel) && (
                    <div
                      id={progressId}
                      className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      <span className="truncate">{progress.label}</span>
                      <span>
                        {progress.valueLabel ?? `${Math.round(progress.value)}%`}
                      </span>
                    </div>
                  )}
                  <Progress
                    value={progress.value}
                    aria-hidden={!progress.ariaLabel}
                    aria-label={progress.ariaLabel}
                    className="h-2"
                  />
                </div>
                {progress.action && (
                  <div className="flex-shrink-0 sm:self-start">
                    {progress.action}
                  </div>
                )}
              </div>
              {progress.helperText && (
                <p
                  id={progressHelperId}
                  className="text-xs text-muted-foreground"
                >
                  {progress.helperText}
                </p>
              )}
            </div>
          )}

          {footer && (
            <div className="flex items-center justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      </Card>
    );
  },
);

KpiCard.displayName = "KpiCard";
