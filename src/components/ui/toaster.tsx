import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProgress,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

const DEFAULT_TOAST_DURATION = 5000

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
        duration,
        ...toastProps
      }) {
        const toastDuration =
          typeof duration === "number" && duration > 0
            ? duration
            : DEFAULT_TOAST_DURATION

        return (
          <Toast key={id} duration={toastDuration} {...toastProps}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
            <ToastProgress duration={toastDuration} />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
