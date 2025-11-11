import { useEffect, useMemo, useState } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import DateTimePicker from "@/components/ui/date-time-picker";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

export interface ReminderEditorValues {
  content: string;
  reminderDateTime: string;
}

export interface ReminderEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialValues?: Partial<ReminderEditorValues>;
  onSubmit: (values: ReminderEditorValues) => Promise<void>;
  submitting?: boolean;
}

const buildInitialDateTime = (values?: Partial<ReminderEditorValues>) => {
  if (!values) return "";
  if (values.reminderDateTime) return values.reminderDateTime;
  if (values.reminderDateTime === "") return "";
  return "";
};

export const ReminderEditorSheet = ({
  open,
  onOpenChange,
  mode,
  initialValues,
  onSubmit,
  submitting = false,
}: ReminderEditorSheetProps) => {
  const { t } = useFormsTranslation();
  const [content, setContent] = useState(initialValues?.content ?? "");
  const [reminderDateTime, setReminderDateTime] = useState(
    buildInitialDateTime(initialValues)
  );

  useEffect(() => {
    if (open) {
      setContent(initialValues?.content ?? "");
      setReminderDateTime(buildInitialDateTime(initialValues));
    }
  }, [open, initialValues]);

  const isDisabled =
    submitting || !content.trim().length || !reminderDateTime.trim().length;

  const title = useMemo(
    () =>
      mode === "edit"
        ? t("reminders.editReminderTitle")
        : t("reminders.addReminderTitle"),
    [mode, t]
  );

  const primaryActionLabel = useMemo(
    () =>
      mode === "edit"
        ? t("reminders.updateReminder")
        : t("reminders.createReminder"),
    [mode, t]
  );

  const handleSubmit = async () => {
    if (isDisabled) return;
    await onSubmit({
      content: content.trim(),
      reminderDateTime,
    });
  };

  return (
    <AppSheetModal
      title={title}
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      footerActions={[
        {
          label: primaryActionLabel,
          onClick: handleSubmit,
          disabled: isDisabled,
          loading: submitting,
        },
      ]}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reminder-content">
            {t("reminders.reminderContentLabel")}
          </Label>
          <Textarea
            id="reminder-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={4}
            className="resize-none"
            placeholder={t("reminders.reminderContentPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reminder-date">
            {t("reminders.reminderDateLabel")}
          </Label>
          <DateTimePicker
            value={reminderDateTime}
            onChange={setReminderDateTime}
            placeholder={t("dateTimePicker.placeholder")}
            timeLabel={t("dateTimePicker.time")}
            todayLabel={t("dateTimePicker.today")}
            clearLabel={t("dateTimePicker.clear")}
            doneLabel={t("dateTimePicker.done")}
          />
        </div>
      </div>
    </AppSheetModal>
  );
};

ReminderEditorSheet.displayName = "ReminderEditorSheet";

