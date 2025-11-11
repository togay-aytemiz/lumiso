import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

interface NoteEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContent?: string;
  onSubmit: (content: string) => void | Promise<void>;
  submitting?: boolean;
}

export function NoteEditorSheet({
  open,
  onOpenChange,
  initialContent = "",
  onSubmit,
  submitting = false,
}: NoteEditorSheetProps) {
  const { t } = useFormsTranslation();
  const { t: tCommon } = useTranslation("common");
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    if (open) {
      setContent(initialContent);
    }
  }, [initialContent, open]);

  const trimmedContent = useMemo(() => content.trim(), [content]);
  const initialTrimmedContent = useMemo(() => initialContent.trim(), [initialContent]);
  const hasChanges = trimmedContent !== initialTrimmedContent;

  const footerActions = useMemo(
    () => [
      {
        label: tCommon("buttons.cancel"),
        onClick: () => onOpenChange(false),
        variant: "outline" as const,
        disabled: submitting,
      },
      {
        label: submitting
          ? t("activities.update_note_loading")
          : t("activities.update_note"),
        onClick: () => onSubmit(trimmedContent),
        disabled: submitting || trimmedContent.length === 0 || !hasChanges,
        loading: submitting,
      },
    ],
    [hasChanges, onOpenChange, onSubmit, submitting, t, tCommon, trimmedContent],
  );

  return (
    <AppSheetModal
      title={t("activities.edit_note")}
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      footerActions={footerActions}
    >
      <div className="space-y-2 px-1">
        <Label htmlFor="note-editor-textarea">{t("activities.note_label")}</Label>
        <Textarea
          id="note-editor-textarea"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={t("activities.enter_note_placeholder")}
          rows={6}
          autoFocus
        />
      </div>
    </AppSheetModal>
  );
}
