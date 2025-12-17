import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CloudLightning } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn, formatBytes } from "@/lib/utils";

interface StorageWidgetProps {
  usedBytes: number | null | undefined;
  totalBytes: number;
  isLoading?: boolean;
  className?: string;
}

type StorageTone = "safe" | "attention" | "critical" | "urgent";

const splitUnit = (formatted: string) => {
  const parts = formatted.split(" ");
  if (parts.length < 2) {
    return { value: formatted, unit: "" };
  }
  const unit = parts.pop() ?? "";
  return { value: parts.join(" "), unit };
};

export function StorageWidget({ usedBytes, totalBytes, isLoading = false, className }: StorageWidgetProps) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n.resolvedLanguage ?? i18n.language ?? undefined;

  const normalizedUsedBytes =
    typeof usedBytes === "number" && Number.isFinite(usedBytes) ? Math.max(0, usedBytes) : null;
  const percentRaw =
    normalizedUsedBytes !== null && totalBytes > 0 ? (normalizedUsedBytes / totalBytes) * 100 : 0;
  const percentClamped = Math.max(0, Math.min(percentRaw, 100));
  const isOverLimit = percentRaw >= 100;
  const showAlert = percentRaw >= 75;

  const tone: StorageTone = useMemo(() => {
    if (percentRaw < 50) return "safe";
    if (percentRaw < 75) return "attention";
    if (percentRaw < 90) return "critical";
    return "urgent";
  }, [percentRaw]);

  const colorConfig = useMemo(() => {
    switch (tone) {
      case "safe":
        return {
          gradient: "from-emerald-500 to-teal-600",
          accent: "text-emerald-100",
        };
      case "attention":
        return {
          gradient: "from-amber-400 to-orange-500",
          accent: "text-amber-100",
        };
      case "critical":
        return {
          gradient: "from-orange-500 to-red-600",
          accent: "text-orange-100",
        };
      case "urgent":
      default:
        return {
          gradient: "from-red-600 to-rose-800",
          accent: "text-rose-100",
        };
    }
  }, [tone]);

  const statusLabel = useMemo(() => {
    if (tone === "safe") return t("storage.widget.status.safe");
    if (tone === "attention") return t("storage.widget.status.attention");
    if (tone === "critical") return t("storage.widget.status.critical");
    return isOverLimit ? t("storage.widget.status.limitExceeded") : t("storage.widget.status.nearLimit");
  }, [isOverLimit, t, tone]);

  const [animatedPercent, setAnimatedPercent] = useState(0);
  useEffect(() => {
    if (isLoading) {
      setAnimatedPercent(0);
      return;
    }
    setAnimatedPercent(percentClamped);
  }, [isLoading, percentClamped]);

  const formattedUsed = useMemo(() => {
    if (isLoading) return "";
    if (normalizedUsedBytes === null) return "—";
    return formatBytes(normalizedUsedBytes, locale);
  }, [isLoading, locale, normalizedUsedBytes]);

  const formattedTotal = useMemo(() => formatBytes(totalBytes, locale), [locale, totalBytes]);

  const usedParts = useMemo(() => splitUnit(formattedUsed), [formattedUsed]);

  const percentLabelValue = useMemo(() => Math.round(percentClamped), [percentClamped]);

  return (
    <Card
      className={cn(
        "group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border-0 bg-gradient-to-br p-6 text-white shadow-lg transition-all duration-700",
        colorConfig.gradient,
        className
      )}
    >
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl transition-transform duration-700 group-hover:scale-150" />

      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest opacity-80",
                colorConfig.accent
              )}
            >
              {t("storage.widget.kicker")}
            </span>
            <h4 className="text-lg font-bold">{t("storage.widget.title")}</h4>
          </div>

          <div className="relative rounded-xl border border-white/10 bg-white/20 p-2.5 backdrop-blur-md">
            <CloudLightning className="h-5 w-5" aria-hidden="true" />
            {showAlert && (
              <span className="absolute -right-1 -top-1 rounded-full border border-white/10 bg-white/20 p-1 backdrop-blur-md">
                <AlertTriangle className="h-3 w-3 animate-pulse" aria-hidden="true" />
              </span>
            )}
          </div>
        </div>

        <div className="mt-auto space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col">
              {isLoading ? (
                <div className="h-7 w-28 animate-pulse rounded bg-white/15" aria-hidden />
              ) : (
                <span className="text-2xl font-bold tabular-nums">
                  {usedParts.value}
                  {usedParts.unit ? (
                    <span className="ml-2 text-sm font-medium opacity-80">{usedParts.unit}</span>
                  ) : null}
                </span>
              )}
            </div>

            <span className="text-[11px] font-bold uppercase tracking-tighter opacity-80">
              {t("storage.widget.capacity", { total: formattedTotal })}
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full border border-white/5 bg-black/10">
            <div
              className={cn(
                "h-full bg-white transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                tone === "urgent"
                  ? "shadow-[0_0_18px_rgba(255,255,255,0.75)]"
                  : "shadow-[0_0_12px_rgba(255,255,255,0.6)]"
              )}
              style={{ width: `${animatedPercent}%` }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percentLabelValue}
              aria-label={t("storage.widget.aria.progress")}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className={cn("text-[10px] font-bold uppercase tracking-wide", colorConfig.accent)}>
              {isLoading ? (
                <span className="inline-block h-3 w-16 animate-pulse rounded bg-white/15 align-middle" aria-hidden />
              ) : (
                t("storage.widget.percentFull", { percent: percentLabelValue })
              )}
            </span>

            {showAlert && !isLoading && (
              <p className="flex items-center gap-1 text-[10px] font-bold animate-pulse">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {statusLabel}
              </p>
            )}
          </div>

          {isOverLimit && !isLoading && (
            <p className={cn("text-[11px] font-medium opacity-90", colorConfig.accent)}>
              {t("storage.widget.blocked")}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

