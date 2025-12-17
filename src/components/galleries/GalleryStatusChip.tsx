import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type GalleryStatus = "draft" | "published" | "approved" | "archived";

type GalleryStatusChipSize = "sm" | "md";

const STATUS_CLASSES: Record<GalleryStatus, string> = {
  draft:
    "border-white/10 bg-zinc-900/85 text-white dark:border-white/10 dark:bg-white/10 dark:text-white",
  published:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-100",
  approved:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100",
  archived:
    "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-400/30 dark:bg-slate-500/10 dark:text-slate-100",
};

const SIZE_CLASSES: Record<GalleryStatusChipSize, string> = {
  sm: "px-3 py-1 text-xs",
  md: "px-3.5 py-1.5 text-sm",
};

export function GalleryStatusChip({
  status,
  className,
  size = "sm",
  uppercase = false,
}: {
  status: GalleryStatus;
  className?: string;
  size?: GalleryStatusChipSize;
  uppercase?: boolean;
}) {
  const { t, i18n } = useTranslation("pages");
  const isTurkish = (i18n.resolvedLanguage ?? i18n.language ?? "").startsWith("tr");
  const label = t(`sessionDetail.gallery.statuses.${status}`);
  const displayLabel = useMemo(() => {
    if (!uppercase) return label;
    return isTurkish ? label.toLocaleUpperCase("tr-TR") : label.toUpperCase();
  }, [isTurkish, label, uppercase]);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold tracking-wide shadow-sm backdrop-blur-md",
        SIZE_CLASSES[size],
        STATUS_CLASSES[status],
        className
      )}
    >
      {displayLabel}
    </span>
  );
}

