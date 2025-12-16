import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";

type ClientSelectionLockedBannerProps = {
  note?: string | null;
  className?: string;
};

export function ClientSelectionLockedBanner({ note, className }: ClientSelectionLockedBannerProps) {
  const { t } = useTranslation("pages");

  const resolvedNote = useMemo(() => {
    const value = typeof note === "string" ? note.trim() : "";
    return value.length > 0 ? value : null;
  }, [note]);

  return (
    <section className={cn("rounded-2xl border border-emerald-100 bg-emerald-50 p-4 md:p-6", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-6 w-6" strokeWidth={2.5} />
        </div>

        <div className="space-y-2">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-emerald-900 md:text-xl">
              {t("sessionDetail.gallery.clientPreview.lockedBanner.title")}
            </h3>
            <p className="text-sm font-semibold text-emerald-900/80 md:text-base">
              {t("sessionDetail.gallery.clientPreview.lockedBanner.subtitle")}
            </p>
          </div>

          <p className="whitespace-pre-line text-sm leading-relaxed text-emerald-900/70 md:text-base">
            {t("sessionDetail.gallery.clientPreview.lockedBanner.body")}
          </p>

          {resolvedNote ? (
            <div className="rounded-2xl border border-emerald-100 bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">
                    {t("sessionDetail.gallery.clientPreview.lockedBanner.noteLabel")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900/80">{resolvedNote}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
