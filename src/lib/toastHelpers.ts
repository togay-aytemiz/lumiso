import { useMemo } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ToastActionElement } from "@/components/ui/toast";
import { toast } from "@/hooks/use-toast";

type ToastOptions = {
  action?: ToastActionElement;
  duration?: number;
  className?: string;
};

const DEFAULT_DURATION = 5000;

const resolveDuration = (duration?: number) =>
  typeof duration === "number" && duration > 0 ? duration : DEFAULT_DURATION;

const scheduleFallbackDismiss = (toastRef: ReturnType<typeof toast>, duration: number) => {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    toastRef.dismiss();
  }, duration + 200);
};

const showToast = (
  payload: Parameters<typeof toast>[0],
  options?: ToastOptions
) => {
  const duration = resolveDuration(options?.duration);
  const toastRef = toast({
    ...payload,
    ...options,
    duration,
  });
  scheduleFallbackDismiss(toastRef, duration);
  return toastRef;
};

/**
 * Hook that provides internationalized toast notifications
 * Uses common.json translations for consistent toast titles
 */
export const useI18nToast = () => {
  const { t } = useTranslation("common");

  return useMemo(
    () => ({
      success: (description: ReactNode, options?: ToastOptions) =>
        showToast(
          {
            title: t("toast.success"),
            description,
          },
          options
        ),

      error: (description: ReactNode, options?: ToastOptions) =>
        showToast(
          {
            title: t("toast.error"),
            description,
            variant: "destructive",
          },
          options
        ),

      warning: (description: ReactNode, options?: ToastOptions) =>
        showToast(
          {
            title: t("toast.warning"),
            description,
          },
          options
        ),

      info: (description: ReactNode, options?: ToastOptions) =>
        showToast(
          {
            title: t("toast.info"),
            description,
          },
          options
        ),
    }),
    [t]
  );
};
