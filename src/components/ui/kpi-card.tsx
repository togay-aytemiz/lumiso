import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  HelpCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type TrendTone = "positive" | "negative" | "neutral";
type TrendDirection = "up" | "down" | "flat";

interface TrendConfig {
  /**
   * Textual representation of the trend such as "+12%" or "▼ 4 sessions".
   * Provide translations in the calling component.
   */
  label?: React.ReactNode;
  /**
   * Visual tone that adjusts styling. Positive → success, Negative → destructive, Neutral → subtle.
   */
  tone?: TrendTone;
  /**
   * Optional custom icon. When omitted, the direction controls a default arrow icon.
   */
  icon?: React.ReactNode;
  /**
   * Accessible description for assistive technologies.
   */
  ariaLabel?: string;
  /**
   * Direction of change to control the default arrow glyph when no custom icon is provided.
   * If omitted and a numeric value is given, it is derived from the sign of `value`.
   */
  direction?: TrendDirection;
  /**
   * Optional numeric change value used to generate a label when `label` is not provided.
   * Example: 12 (percent) or -4 (absolute count).
   */
  value?: number;
  /**
   * Controls how a numeric value is formatted when `label` is omitted.
   * "percent" appends a % sign; a custom formatter can return a React node.
   */
  valueFormat?: "percent" | "number" | ((n: number) => React.ReactNode);
  /**
   * Number of fraction digits for numeric formatting when using the built-in formatter.
   */
  decimals?: number;
  /**
   * Show a leading plus sign for positive numbers when the label is generated.
   */
  showSign?: boolean;
  /**
   * Invert the good/bad tone semantics for automatic tone inference from `value`.
   * Useful when a decrease is positive (e.g., response time).
   */
  invert?: boolean;
}

type KpiDensity = "default" | "compact";

interface InfoConfig {
  /**
   * Tooltip content describing how the KPI is calculated.
   */
  content: React.ReactNode;
  /**
   * Accessible label for the information trigger button.
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
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
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
   * Controls title wrapping behavior. Defaults to truncating to a single line.
   */
  titleWrap?: "truncate" | "wrap";
  /**
   * Heading level for the title.
   */
  headingLevel?: "h2" | "h3" | "h4" | "h5" | "h6";
  /**
   * KPI value – supports numbers, strings, or custom React nodes.
   */
  value: React.ReactNode;
  /**
   * Optional inline action placed next to the KPI value (e.g., quick filter button).
   */
  action?: React.ReactNode;
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
   * Optional tooltip trigger that explains how the KPI is calculated.
   */
  info?: InfoConfig;
  /**
   * Controls padding and typography density.
   */
  density?: KpiDensity;
  /**
   * Optional aria label when the surrounding context does not provide one.
   */
  ariaLabel?: string;
  /**
   * Show a subtle click arrow icon in the bottom-right.
   */
  showClickArrow?: boolean;
}

const trendToneStyles: Record<TrendTone, string> = {
  positive:
    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  negative:
    "bg-destructive/10 text-destructive border border-destructive/20",
  neutral:
    "bg-muted text-muted-foreground border border-border/60",
};

const fallbackDirectionIcon: Record<TrendDirection, React.ReactNode> = {
  up: <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />,
  down: <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />,
  flat: <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />,
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
      titleWrap = "truncate",
      headingLevel = "h3",
      value,
      action,
      description,
      progress,
      footer,
      trend,
      info,
      density = "default",
      onClick,
      showClickArrow,
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

    const containerSpacing =
      density === "compact"
        ? "flex flex-col gap-4 p-4 sm:gap-5 sm:p-5"
        : "flex flex-col gap-5 p-5 sm:gap-6";

    const valueClassName =
      density === "compact"
        ? "text-2xl font-semibold leading-none text-foreground sm:text-3xl"
        : "text-3xl font-semibold leading-none text-foreground";

    const infoAriaLabel = info?.ariaLabel ?? "More information";

    // Compute trend display pieces when provided
    const tone: TrendTone = React.useMemo(() => {
      if (!trend) return "neutral";
      if (trend.tone) return trend.tone;
      if (typeof trend.value === "number") {
        const v = trend.value;
        const positiveIsGood = !(trend.invert ?? false);
        const isGood = positiveIsGood ? v > 0 : v < 0;
        if (v === 0) return "neutral";
        return isGood ? "positive" : "negative";
      }
      return "neutral";
    }, [trend]);

    const direction: TrendDirection | null = React.useMemo(() => {
      if (!trend) return null;
      if (trend.direction) return trend.direction;
      if (typeof trend.value === "number") {
        if (trend.value > 0) return "up";
        if (trend.value < 0) return "down";
        return "flat";
      }
      return "flat";
    }, [trend]);

    const autoTrendLabel: React.ReactNode | null = React.useMemo(() => {
      if (!trend) return null;
      if (trend.label != null) return null;
      if (typeof trend.value !== "number") return null;
      const decimals = trend.decimals ?? (trend.valueFormat === "percent" ? 1 : 0);
      const showSign = trend.showSign ?? true;
      const v = trend.value;
      const abs = Math.abs(v);
      if (typeof trend.valueFormat === "function") {
        return trend.valueFormat(v);
      }
      const formatted = abs.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      const sign = v < 0 ? "-" : v > 0 && showSign ? "+" : "";
      if (trend.valueFormat === "percent") {
        return `${sign}${formatted}%`;
      }
      return `${sign}${formatted}`;
    }, [trend]);

    const autoAriaLabel: string | undefined = React.useMemo(() => {
      if (!trend) return undefined;
      if (trend.ariaLabel) return trend.ariaLabel;
      if (autoTrendLabel == null) return undefined;
      const dirLabel = direction === "up" ? "up" : direction === "down" ? "down" : "no change";
      return typeof autoTrendLabel === "string" ? `${dirLabel} ${autoTrendLabel}` : undefined;
    }, [trend, autoTrendLabel, direction]);

    const trendIcon = trend
      ? trend.icon ?? (direction ? fallbackDirectionIcon[direction] : null)
      : null;

    return (
      <Card
        ref={ref}
        className={cn(
          "group relative isolate overflow-hidden border-border/60 bg-white dark:bg-slate-950 shadow-sm transition-all duration-300 ease-out",
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
        <div className={containerSpacing}>
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
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "min-w-0",
                        titleWrap === "wrap" ? "whitespace-normal break-words leading-snug" : "truncate",
                      )}
                    >
                      {title}
                    </span>
                    {info && (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                              data-touch-target="compact"
                              aria-label={infoAriaLabel}
                            >
                              <HelpCircle className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            align="start"
                            side="top"
                            className="max-w-xs text-sm leading-relaxed"
                          >
                            {info.content}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </span>
                </HeadingTag>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={valueClassName}>
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
                        {trend.label ?? autoTrendLabel}
                      </span>
                      {(trend.ariaLabel || autoAriaLabel) && (
                        <span className="sr-only">{trend.ariaLabel ?? autoAriaLabel}</span>
                      )}
                    </Badge>
                  )}
                  {action && <div className="flex-shrink-0">{action}</div>}
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

          {showClickArrow && (
            <div className="absolute bottom-3 right-3">
              <ArrowUpRight className="h-4 w-4 text-muted-foreground/30" />
            </div>
          )}
        </div>
      </Card>
    );
  },
);

KpiCard.displayName = "KpiCard";
