import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useOrganizationTrialStatus } from "@/hooks/useOrganizationTrialStatus";

interface TrialStatusIndicatorProps {
  variant?: "sidebar" | "mobile";
  className?: string;
}

export function TrialStatusIndicator({
  variant = "sidebar",
  className,
}: TrialStatusIndicatorProps) {
  const { t } = useTranslation("navigation");
  const { isTrial, daysLeft, progress } = useOrganizationTrialStatus();

  if (!isTrial) {
    return null;
  }

  const isExpiringSoon = typeof daysLeft === "number" && daysLeft <= 3;
  const cappedProgress = Math.min(Math.max(progress ?? 0, 0), 1);
  const progressPercent = Math.round(cappedProgress * 100);
  const progressWidth = `${(cappedProgress * 100).toFixed(2)}%`;

  const daysLabel = (() => {
    if (daysLeft == null) return t("trialIndicator.expired");
    if (daysLeft === 0) return t("trialIndicator.endsToday");
    return t("trialIndicator.daysLeft", { count: daysLeft });
  })();

  const gradientClass = isExpiringSoon
    ? "from-amber-400 via-amber-500 to-amber-600"
    : "from-[#B067FF] via-[#8E63FF] to-[#6B4CFF]";

  const cardToneClass =
    variant === "mobile"
      ? isExpiringSoon
        ? "border-amber-200 bg-amber-50 text-amber-900 shadow-[0_12px_30px_rgba(245,158,11,0.25)]"
        : "border-border bg-white text-foreground shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
      : isExpiringSoon
        ? "border-amber-200 bg-amber-50/90 text-amber-900"
        : "border-[hsl(var(--sidebar-primary)_/_0.35)] bg-[hsl(var(--sidebar-primary)_/_0.12)] text-sidebar-foreground";

  const trackClass =
    variant === "mobile"
      ? isExpiringSoon
        ? "bg-amber-100"
        : "bg-muted/30"
      : isExpiringSoon
        ? "bg-amber-100/90"
        : "bg-[hsl(var(--sidebar-foreground)_/_0.16)]";

  const labelToneClass = isExpiringSoon
    ? "text-amber-800"
    : variant === "mobile"
      ? "text-muted-foreground"
      : "text-[hsl(var(--sidebar-foreground)_/_0.75)]";

  const titleToneClass =
    variant === "mobile" || isExpiringSoon
      ? ""
      : "text-sidebar-foreground";

  const ProgressIndicator = () => (
    <div className={cn("relative mt-3 h-2.5 w-full overflow-hidden rounded-full", trackClass)}>
      <div
        className={cn(
          "relative h-full rounded-full bg-gradient-to-r transition-all duration-300 ease-out",
          gradientClass,
          progressPercent === 0 && "opacity-30"
        )}
        style={{ width: progressWidth }}
      >
        {progressPercent > 0 && (
          <span className="absolute right-0 top-1/2 h-3 w-[3px] -translate-y-1/2 translate-x-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(79,70,229,0.35)]" />
        )}
      </div>
    </div>
  );

  const IndicatorBody = ({ stacked = false }: { stacked?: boolean }) => (
    <>
      <div
        className={cn(
          "w-full gap-2",
          stacked ? "flex flex-col items-start" : "flex items-center justify-between"
        )}
      >
        <span className={cn("text-sm font-semibold", titleToneClass)}>
          {t("trialIndicator.title")}
        </span>
        <span className={cn("text-xs font-medium", labelToneClass)}>{daysLabel}</span>
      </div>
      <ProgressIndicator />
    </>
  );

  if (variant === "mobile") {
    return (
      <div className={cn("w-full", className)}>
        <div className={cn("flex flex-col rounded-2xl border px-4 py-4", cardToneClass)}>
          <IndicatorBody />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "flex flex-col rounded-2xl border px-4 py-4 transition-colors group-data-[collapsible=icon]:hidden",
          cardToneClass
        )}
      >
        <IndicatorBody stacked />
      </div>

      <div className="hidden group-data-[collapsible=icon]:flex">
        <div
          className={cn(
            "mx-auto flex h-24 w-16 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 shadow-sm",
            isExpiringSoon
              ? "border-amber-300/80 bg-gradient-to-b from-amber-400/20 to-amber-500/10 text-amber-50 shadow-[0_8px_18px_rgba(245,158,11,0.35)]"
              : "border-white/10 bg-gradient-to-b from-white/10 to-white/5 text-white/80 shadow-[0_10px_24px_rgba(15,23,42,0.25)]"
          )}
        >
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border text-[11px]",
              isExpiringSoon
                ? "border-amber-200/60 bg-amber-400/20 text-amber-50"
                : "border-white/20 bg-white/10 text-white"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="flex flex-col items-center text-[10px] font-semibold uppercase tracking-wide leading-3">
            <span>{t("trialIndicator.short")}</span>
            <span className="text-base font-bold tracking-tight text-white">
              {daysLeft ?? "–"}
            </span>
          </div>
          <div className="h-0.5 w-10 rounded-full bg-white/20">
            <div
              className={cn(
                "h-full rounded-full",
                isExpiringSoon ? "bg-amber-200" : "bg-white"
              )}
              style={{ width: progressWidth }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
