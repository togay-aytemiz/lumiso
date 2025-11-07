import {
  type InputHTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { Upload, Loader2 } from "lucide-react";
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

  return (
    <div
      className={cn(
        "space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <PreviewWrapper
          type={onPreview ? "button" : undefined}
          onClick={onPreview}
          className={cn(
            "relative border border-dashed border-border/60 bg-background/60 p-1",
            shapeClasses,
            sizeClasses,
            onPreview &&
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          )}
        >
          <div className={cn("h-full w-full", shapeClasses)}>{previewContent}</div>
        </PreviewWrapper>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="pill"
            onClick={onUploadClick}
            disabled={uploadBusy}
            className="flex items-center gap-2"
          >
            {uploadBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploadBusy ? uploadingLabel ?? uploadLabel : uploadLabel}
          </Button>
          {deleteAction && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 text-destructive hover:text-destructive"
                >
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
        </div>
        {helperText && (
          <p className="text-xs text-muted-foreground">{helperText}</p>
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
