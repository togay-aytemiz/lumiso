import { useEffect, useMemo, useState } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import DateTimePicker from "@/components/ui/date-time-picker";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

export interface ReminderEditorValues {
  content: string;
  reminderDateTime: string;
  reminderDate?: string | null;
  reminderTime?: string | null;
}

export interface ReminderEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialValues?: Partial<ReminderEditorValues>;
  onSubmit: (values: ReminderEditorValues) => Promise<void>;
  submitting?: boolean;
}

const sanitizeTime = (input?: string | null) => {
  if (!input) return undefined;
  const [hoursRaw, minutesRaw = "00"] = input.split(":");
  if (!hoursRaw) return undefined;
  const hours = hoursRaw.padStart(2, "0").slice(0, 2);
  const minutes = minutesRaw.padStart(2, "0").slice(0, 2);
  return `${hours}:${minutes}`;
};

const getDateOnly = (input?: string | null) => {
  if (!input) return "";
  return input.split("T")[0] ?? input;
};

const buildInitialDateTime = (values?: Partial<ReminderEditorValues>) => {
  if (!values) return "";

  const trimmed = values.reminderDateTime?.trim();
  const [dateFromValue = "", rawTimePart] = (trimmed ?? "").split("T");
  const fallbackDate = getDateOnly(values.reminderDate);
  const datePart = getDateOnly(dateFromValue || fallbackDate);

  if (!datePart) return "";

  const timeFromValue = sanitizeTime(rawTimePart);
  const fallbackTime = sanitizeTime(values.reminderTime);

  const resolvedTime = timeFromValue ?? fallbackTime;

  if (resolvedTime) {
    return `${datePart}T${resolvedTime}`;
  }

  // Date-only; DateTimePicker will apply its defaultTime
  return datePart;
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
      reminderDate: initialValues?.reminderDate,
      reminderTime: initialValues?.reminderTime,
    });
  };

  const defaultTime = useMemo(() => {
    if (!initialValues) return undefined;
    return (
      sanitizeTime(initialValues.reminderTime) ??
      sanitizeTime(initialValues.reminderDateTime?.split("T")[1])
    );
  }, [initialValues]);

  const pickerValue = useMemo(() => {
    if (!reminderDateTime) return "";
    const [, timePart] = reminderDateTime.split("T");
    if (timePart) return reminderDateTime;
    const fallback = defaultTime ?? "09:00";
    return `${reminderDateTime}T${fallback}`;
  }, [defaultTime, reminderDateTime]);

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
            value={pickerValue}
            onChange={setReminderDateTime}
            placeholder={t("dateTimePicker.placeholder")}
            timeLabel={t("dateTimePicker.time")}
            todayLabel={t("dateTimePicker.today")}
            clearLabel={t("dateTimePicker.clear")}
            doneLabel={t("dateTimePicker.done")}
            defaultTime={defaultTime}
          />
        </div>
      </div>
    </AppSheetModal>
  );
};

ReminderEditorSheet.displayName = "ReminderEditorSheet";
