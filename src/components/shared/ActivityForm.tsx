import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import DateTimePicker from "@/components/ui/date-time-picker";
import { useFormsTranslation } from '@/hooks/useTypedTranslation';

interface ActivityFormProps {
  onSubmit: (content: string, isReminder: boolean, reminderDateTime?: string) => Promise<void>;
  loading: boolean;
  placeholder?: string;
}

export function ActivityForm({ onSubmit, loading, placeholder }: ActivityFormProps) {
  const [content, setContent] = useState('');
  const [isReminderMode, setIsReminderMode] = useState(false);
  const [reminderDateTime, setReminderDateTime] = useState('');
  const { t } = useFormsTranslation();

  const handleSubmit = async () => {
    await onSubmit(content, isReminderMode, reminderDateTime);
    // Reset form
    setContent('');
    setReminderDateTime('');
    setIsReminderMode(false);
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t('activities.note_label')}</Label>
          <div className="flex items-center gap-2">
            <Label htmlFor="reminder-toggle" className="text-sm font-medium">
              {t('activities.set_reminder_label')}
            </Label>
            <Switch 
              id="reminder-toggle" 
              checked={isReminderMode} 
              onCheckedChange={setIsReminderMode}
            />
          </div>
        </div>
        <Textarea 
          value={content} 
          onChange={e => setContent(e.target.value)} 
          placeholder={placeholder || t('activities.enter_note_placeholder')}
          rows={1} 
          className="resize-none min-h-[40px] max-h-[120px]" 
        />
      </div>

      {isReminderMode && (
        <div className="space-y-2">
          <Label>{t('activities.date_time_label')}</Label>
          <DateTimePicker 
            value={reminderDateTime} 
            onChange={setReminderDateTime}
            placeholder={t('dateTimePicker.placeholder')}
            timeLabel={t('dateTimePicker.time')}
            todayLabel={t('dateTimePicker.today')}
            clearLabel={t('dateTimePicker.clear')}
            doneLabel={t('dateTimePicker.done')}
          />
        </div>
      )}

      <div className="flex justify-end">
        <Button 
          onClick={handleSubmit}
          disabled={loading || !content.trim() || (isReminderMode && !reminderDateTime)} 
          size="sm"
        >
          {loading ? t('activities.saving') : `${isReminderMode ? t('activities.add_reminder') : t('activities.add_note')}`}
        </Button>
      </div>
    </div>
  );
}