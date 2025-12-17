import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type GalleryStatus = "draft" | "published" | "approved" | "archived";

type GalleryStatusChipSize = "sm" | "md";

const STATUS_CLASSES: Record<GalleryStatus, string> = {
  draft:
    "border-amber-200/70 bg-amber-50/90 text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-100",
  published:
    "border-sky-200/70 bg-sky-50/90 text-sky-900 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-100",
  approved:
    "border-emerald-200/70 bg-emerald-50/90 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-100",
  archived:
    "border-slate-200/70 bg-slate-50/90 text-slate-900 dark:border-slate-400/30 dark:bg-slate-500/15 dark:text-slate-100",
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
