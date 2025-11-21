import {
  type InputHTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { Upload, Loader2 } from "lucide-react";
import { SettingsActionPills } from "@/components/settings/SettingsActionPills";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type DeleteAction = {
  label: string;
  confirmationTitle: string;
  confirmationDescription: string;
  confirmationButtonLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
};

export interface SettingsImageUploadCardProps {
  title: string;
  description: string;
  helperText?: string;
  imageUrl?: string | null;
  previewAlt?: string;
  placeholder?: ReactNode;
  onPreview?: () => void;
  uploadLabel: string;
  uploadingLabel?: string;
  uploadBusy?: boolean;
  onUploadClick: () => void;
  inputRef?: RefObject<HTMLInputElement>;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  deleteAction?: DeleteAction;
  previewShape?: "circle" | "rounded";
  previewSize?: "md" | "lg";
  actionSlot?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SettingsImageUploadCard({
  title,
  description,
  helperText,
  imageUrl,
  previewAlt,
  placeholder,
  onPreview,
  uploadLabel,
  uploadingLabel,
  uploadBusy,
  onUploadClick,
  inputRef,
  inputProps,
  deleteAction,
  previewShape = "rounded",
  previewSize = "md",
  actionSlot,
  className,
  contentClassName,
}: SettingsImageUploadCardProps) {
  const sizeClasses =
    previewSize === "lg" ? "h-20 w-20 sm:h-24 sm:w-24" : "h-16 w-16";
  const shapeClasses = previewShape === "circle" ? "rounded-full" : "rounded-2xl";
  const previewContent = imageUrl ? (
    <img
      src={imageUrl}
      alt={previewAlt ?? title}
      className={cn(
        "h-full w-full object-cover",
        previewShape === "circle" ? "rounded-full" : "rounded-2xl"
      )}
    />
  ) : (
    placeholder ?? (
      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
        {title}
      </div>
    )
  );

  const PreviewWrapper = onPreview ? "button" : "div";
  const previewWrapperClasses = cn(
    "relative shrink-0 border border-dashed border-border/60 bg-background/60 p-1",
    shapeClasses,
    sizeClasses,
    previewShape === "circle" && "aspect-square"
  );
  const previewInnerClasses = cn(
    "h-full w-full overflow-hidden",
    shapeClasses
  );

  return (
    <div
      className={cn(
        "space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-4 md:flex-row md:items-center md:gap-6",
          contentClassName
        )}
      >
        <div className="flex items-center gap-4">
          <PreviewWrapper
            type={onPreview ? "button" : undefined}
            onClick={onPreview}
            className={cn(
              previewWrapperClasses,
              onPreview &&
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            )}
          >
            <div className={previewInnerClasses}>{previewContent}</div>
          </PreviewWrapper>
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <SettingsActionPills>
          <Button
            onClick={onUploadClick}
            disabled={uploadBusy}
            variant="pill"
            size="sm"
            className="flex items-center gap-2 text-sm"
            aria-label={uploadLabel}
          >
            {uploadBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="h-4 w-4" aria-hidden="true" />
            )}
            {uploadBusy ? uploadingLabel ?? uploadLabel : uploadLabel}
          </Button>
          {deleteAction && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="pillDanger" size="sm">
                  {deleteAction.label}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{deleteAction.confirmationTitle}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {deleteAction.confirmationDescription}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{deleteAction.cancelLabel}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={deleteAction.onConfirm}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteAction.confirmationButtonLabel}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {actionSlot}
        </SettingsActionPills>
        {helperText && (
          <p className="text-xs font-medium text-primary sm:ml-auto sm:text-right">
            {helperText}
          </p>
        )}
      </div>
      {inputProps && (
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          {...inputProps}
        />
      )}
    </div>
  );
}
