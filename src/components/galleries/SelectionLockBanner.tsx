import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Download, LockOpen, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SelectionLockBannerProps = {
  note?: string | null;
  onExport: () => void;
  onUnlock: () => void;
  exportDisabled?: boolean;
  unlockDisabled?: boolean;
  className?: string;
};

export function SelectionLockBanner({
  note,
  onExport,
  onUnlock,
  exportDisabled,
  unlockDisabled,
  className,
}: SelectionLockBannerProps) {
  const { t } = useTranslation("pages");

  const resolvedNote = useMemo(() => {
    const value = typeof note === "string" ? note.trim() : "";
    return value.length > 0 ? value : null;
  }, [note]);

  return (
    <section className={cn("rounded-2xl border border-emerald-100 bg-emerald-50 p-4 md:p-6", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" strokeWidth={2.5} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-emerald-900 md:text-lg">
              {t("sessionDetail.gallery.selectionLock.banner.title")}
            </h3>
            <p className="text-sm text-emerald-900/80">
              {t("sessionDetail.gallery.selectionLock.banner.description")}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            onClick={onExport}
            disabled={exportDisabled}
            className="h-11 justify-center rounded-xl bg-emerald-600 px-5 font-bold text-white shadow-sm hover:bg-emerald-700 sm:min-w-[200px]"
          >
            <Download className="h-5 w-5" />
            {t("sessionDetail.gallery.selectionLock.actions.export")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onUnlock}
            disabled={unlockDisabled}
            className="h-11 justify-center rounded-xl border-emerald-200 bg-white px-5 font-bold text-emerald-800 hover:bg-emerald-50"
          >
            <LockOpen className="h-5 w-5" />
            {t("sessionDetail.gallery.selectionLock.actions.unlock")}
          </Button>
        </div>
      </div>

      {resolvedNote ? (
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">
                {t("sessionDetail.gallery.selectionLock.noteLabel")}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900/80">{resolvedNote}</p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

