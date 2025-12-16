import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, CircleDashed, Download, Lock, LockOpen, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type SelectionLockBannerStatus = "waiting" | "locked" | "reopened" | "unlockedForMe";

type SelectionLockBannerProps = {
  status: SelectionLockBannerStatus;
  note?: string | null;
  onExport?: () => void;
  onUnlockForClient?: () => void;
  onUnlockForMe?: () => void;
  onLockAgain?: () => void;
  exportDisabled?: boolean;
  unlockDisabled?: boolean;
  className?: string;
};

export function SelectionLockBanner({
  status,
  note,
  onExport,
  onUnlockForClient,
  onUnlockForMe,
  onLockAgain,
  exportDisabled,
  unlockDisabled,
  className,
}: SelectionLockBannerProps) {
  const { t } = useTranslation("pages");
  const [confirmUnlockOpen, setConfirmUnlockOpen] = useState(false);

  const resolvedNote = useMemo(() => {
    const value = typeof note === "string" ? note.trim() : "";
    return value.length > 0 ? value : null;
  }, [note]);

  const copy = useMemo(() => {
    const baseKey = `sessionDetail.gallery.selectionLock.status.${status}` as const;
    return {
      title: t(`${baseKey}.title`),
      description: t(`${baseKey}.description`),
    };
  }, [status, t]);

  const icon = useMemo(() => {
    switch (status) {
      case "waiting":
        return <CircleDashed className="h-6 w-6" strokeWidth={2.5} />;
      case "reopened":
        return <CircleDashed className="h-6 w-6" strokeWidth={2.5} />;
      case "unlockedForMe":
        return <LockOpen className="h-6 w-6" strokeWidth={2.5} />;
      case "locked":
      default:
        return <CheckCircle2 className="h-6 w-6" strokeWidth={2.5} />;
    }
  }, [status]);

  const actions = useMemo(() => {
    const showExport = status === "locked" && typeof onExport === "function";
    const showUnlock = status === "locked" && typeof onUnlockForClient === "function";
    const showLockAgain = status === "unlockedForMe" && typeof onLockAgain === "function";
    return { showExport, showUnlock, showLockAgain };
  }, [onExport, onLockAgain, onUnlockForClient, status]);

  return (
    <section className={cn("rounded-2xl border border-emerald-100 bg-emerald-50 p-4 md:p-6", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            {icon}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-emerald-900 md:text-lg">{copy.title}</h3>
            <p className="text-sm text-emerald-900/80">{copy.description}</p>
          </div>
        </div>

        {actions.showExport || actions.showUnlock || actions.showLockAgain ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {actions.showExport ? (
              <Button
                type="button"
                onClick={onExport}
                disabled={exportDisabled}
                className="h-11 justify-center rounded-xl bg-emerald-600 px-5 font-bold text-white shadow-sm hover:bg-emerald-700 sm:min-w-[200px]"
              >
                <Download className="h-5 w-5" />
                {t("sessionDetail.gallery.selectionLock.actions.export")}
              </Button>
            ) : null}
            {actions.showLockAgain ? (
              <Button
                type="button"
                variant="outline"
                onClick={onLockAgain}
                className="h-11 justify-center rounded-xl border-emerald-200 bg-white px-5 font-bold text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900"
              >
                <Lock className="h-5 w-5" />
                {t("sessionDetail.gallery.selectionLock.actions.lockAgain")}
              </Button>
            ) : null}
            {actions.showUnlock ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmUnlockOpen(true)}
                disabled={unlockDisabled}
                className="h-11 justify-center rounded-xl border-emerald-200 bg-white px-5 font-bold text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900"
              >
                <LockOpen className="h-5 w-5" />
                {t("sessionDetail.gallery.selectionLock.actions.unlock")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {actions.showUnlock ? (
        <AlertDialog open={confirmUnlockOpen} onOpenChange={setConfirmUnlockOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("sessionDetail.gallery.selectionLock.unlockConfirm.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("sessionDetail.gallery.selectionLock.unlockConfirm.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:flex-row sm:justify-end">
              <AlertDialogCancel disabled={unlockDisabled}>
                {t("sessionDetail.gallery.selectionLock.unlockConfirm.cancel")}
              </AlertDialogCancel>
              {typeof onUnlockForMe === "function" ? (
                <AlertDialogAction
                  onClick={() => {
                    setConfirmUnlockOpen(false);
                    onUnlockForMe();
                  }}
                  disabled={unlockDisabled}
                  className="border border-emerald-200 bg-white text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900"
                >
                  {t("sessionDetail.gallery.selectionLock.unlockConfirm.unlockForMe")}
                </AlertDialogAction>
              ) : null}
              <AlertDialogAction
                onClick={() => {
                  setConfirmUnlockOpen(false);
                  onUnlockForClient?.();
                }}
                disabled={unlockDisabled}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {t("sessionDetail.gallery.selectionLock.unlockConfirm.unlockForClient")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

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
