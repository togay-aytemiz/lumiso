import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CloudLightning, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn, formatBytes } from "@/lib/utils";

interface StorageWidgetProps {
  usedBytes: number | null | undefined;
  totalBytes: number;
  isLoading?: boolean;
  className?: string;
}

type StorageTone = "safe" | "attention" | "critical" | "urgent";

export function StorageWidget({ usedBytes, totalBytes, isLoading = false, className }: StorageWidgetProps) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n.resolvedLanguage ?? i18n.language ?? undefined;

  const normalizedUsedBytes =
    typeof usedBytes === "number" && Number.isFinite(usedBytes) ? Math.max(0, usedBytes) : null;
  const percentRaw =
    normalizedUsedBytes !== null && totalBytes > 0 ? (normalizedUsedBytes / totalBytes) * 100 : 0;
  const percentClamped = Math.max(0, Math.min(percentRaw, 100));
  const isOverLimit = percentRaw >= 100;

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
          icon: ShieldCheck,
        };
      case "attention":
        return {
          gradient: "from-amber-400 to-orange-500",
          icon: CloudLightning,
        };
      case "critical":
        return {
          gradient: "from-orange-500 to-red-600",
          icon: AlertTriangle,
        };
      case "urgent":
      default:
        return {
          gradient: "from-red-600 to-rose-800",
          icon: AlertTriangle,
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

  const percentLabelValue = useMemo(() => Math.round(percentClamped), [percentClamped]);
  const StatusIcon = colorConfig.icon;

  return (
    <Card
      className={cn(
        "group relative isolate flex min-w-[280px] flex-1 flex-col justify-center overflow-hidden rounded-2xl border-0 bg-gradient-to-br p-5 text-white shadow-sm transition-all duration-500",
        colorConfig.gradient,
        className
      )}
    >
      <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10 blur-xl transition-transform duration-700 group-hover:scale-125" />

      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-white/10 bg-white/20 p-1.5 backdrop-blur-md">
              <StatusIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="mb-1 text-[10px] font-bold uppercase tracking-wider opacity-80 leading-none">
                {t("storage.widget.kicker")}
              </span>
              <span className="text-sm font-bold leading-none">{statusLabel}</span>
            </div>
          </div>

          <div className="text-right">
            {isLoading ? (
              <div className="h-7 w-14 animate-pulse rounded bg-white/15" aria-hidden />
            ) : (
              <span className="text-xl font-black leading-none tracking-tight">
                {t("storage.widget.percentFull", { percent: percentLabelValue })}
              </span>
            )}
          </div>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full border border-white/5 bg-black/15 p-[1px]">
          <div
            className={cn(
              "h-full rounded-full bg-white transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              tone === "urgent"
                ? "shadow-[0_0_10px_rgba(255,255,255,0.85)]"
                : "shadow-[0_0_8px_rgba(255,255,255,0.8)]"
            )}
            style={{ width: `${animatedPercent}%` }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentLabelValue}
            aria-label={t("storage.widget.aria.progress")}
          />
        </div>

        <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-tighter opacity-90">
          <span>
            {isLoading ? (
              <span className="inline-block h-3 w-24 animate-pulse rounded bg-white/15 align-middle" aria-hidden />
            ) : (
              t("storage.widget.used", { used: formattedUsed })
            )}
          </span>
          <span className="opacity-60">
            {isLoading ? (
              <span className="inline-block h-3 w-24 animate-pulse rounded bg-white/15 align-middle" aria-hidden />
            ) : (
              t("storage.widget.capacity", { total: formattedTotal })
            )}
          </span>
        </div>

        {isOverLimit && !isLoading && (
          <p className="text-[11px] font-medium opacity-90">
            {t("storage.widget.blocked")}
          </p>
        )}
      </div>
    </Card>
  );
}
