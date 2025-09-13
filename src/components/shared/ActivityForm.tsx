import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import DateTimePicker from "@/components/ui/date-time-picker";

interface ActivityFormProps {
  onSubmit: (content: string, isReminder: boolean, reminderDateTime?: string) => Promise<void>;
  loading: boolean;
  placeholder?: string;
}

export function ActivityForm({ onSubmit, loading, placeholder = "Enter your note..." }: ActivityFormProps) {
  const [content, setContent] = useState('');
  const [isReminderMode, setIsReminderMode] = useState(false);
  const [reminderDateTime, setReminderDateTime] = useState('');

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
          <Label>Note</Label>
          <div className="flex items-center gap-2">
            <Label htmlFor="reminder-toggle" className="text-sm font-medium">
              Set Reminder?
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
          placeholder={placeholder}
          rows={1} 
          className="resize-none min-h-[40px] max-h-[120px]" 
        />
      </div>

      {isReminderMode && (
        <div className="space-y-2">
          <Label>Date & Time</Label>
          <DateTimePicker value={reminderDateTime} onChange={setReminderDateTime} />
        </div>
      )}

      <div className="flex justify-end">
        <Button 
          onClick={handleSubmit}
          disabled={loading || !content.trim() || (isReminderMode && !reminderDateTime)} 
          size="sm"
        >
          {loading ? "Saving..." : `Add ${isReminderMode ? 'Reminder' : 'Note'}`}
        </Button>
      </div>
    </div>
  );
}