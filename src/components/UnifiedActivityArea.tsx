import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Plus, FileText, Bell, CheckSquare } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface UnifiedActivityAreaProps {
  projectId: string;
  leadId: string;
  leadName: string;
  projectName: string;
  onActivityUpdated?: () => void;
}

export function UnifiedActivityArea({ 
  projectId, 
  leadId, 
  leadName, 
  projectName, 
  onActivityUpdated 
}: UnifiedActivityAreaProps) {
  const [activeTab, setActiveTab] = useState("note");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Note form state
  const [noteContent, setNoteContent] = useState("");

  // Reminder form state
  const [reminderContent, setReminderContent] = useState("");
  const [reminderDate, setReminderDate] = useState<Date>();
  const [reminderTime, setReminderTime] = useState("");
  const [reminderType, setReminderType] = useState<"call" | "email" | "task" | "follow_up">("call");

  // Todo form state
  const [todoContent, setTodoContent] = useState("");

  const handleSubmitNote = async () => {
    if (!noteContent.trim()) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('activities')
        .insert({
          user_id: user.id,
          lead_id: leadId,
          project_id: projectId,
          type: 'note',
          content: noteContent.trim()
        });

      if (error) throw error;

      toast({
        title: t("messages.success.created"),
        description: t("forms.unified_activity.note_added")
      });

      setNoteContent("");
      onActivityUpdated?.();
    } catch (error: any) {
      toast({
        title: t("forms.unified_activity.error_adding_note"),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReminder = async () => {
    if (!reminderContent.trim() || !reminderDate || !reminderTime) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('activities')
        .insert({
          user_id: user.id,
          lead_id: leadId,
          project_id: projectId,
          type: reminderType,
          content: reminderContent.trim(),
          reminder_date: format(reminderDate, 'yyyy-MM-dd'),
          reminder_time: reminderTime
        });

      if (error) throw error;

      toast({
        title: t("messages.success.created"),
        description: t("forms.unified_activity.reminder_created")
      });

      setReminderContent("");
      setReminderDate(undefined);
      setReminderTime("");
      onActivityUpdated?.();
    } catch (error: any) {
      toast({
        title: t("forms.unified_activity.error_creating_reminder"),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitTodo = async () => {
    if (!todoContent.trim()) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('todos')
        .insert({
          user_id: user.id,
          project_id: projectId,
          content: todoContent.trim()
        });

      if (error) throw error;

      toast({
        title: t("messages.success.created"),
        description: t("forms.unified_activity.todo_added")
      });

      setTodoContent("");
      onActivityUpdated?.();
    } catch (error: any) {
      toast({
        title: t("forms.unified_activity.error_adding_todo"),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="note" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("forms.unified_activity.note")}
            </TabsTrigger>
            <TabsTrigger value="reminder" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              {t("forms.unified_activity.reminder")}
            </TabsTrigger>
            <TabsTrigger value="todo" className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              {t("forms.unified_activity.todo")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="note" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Input
                placeholder={t("forms.unified_activity.add_note_placeholder")}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitNote();
                  }
                }}
              />
              <Button 
                onClick={handleSubmitNote}
                disabled={!noteContent.trim() || isSubmitting}
                size="sm"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isSubmitting ? t("forms.unified_activity.adding") : t("forms.unified_activity.add_note")}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="reminder" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Input
                placeholder={t("forms.unified_activity.reminder_placeholder")}
                value={reminderContent}
                onChange={(e) => setReminderContent(e.target.value)}
              />
              
              <div className="grid grid-cols-2 gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !reminderDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {reminderDate ? format(reminderDate, "MMM d, yyyy") : t("forms.unified_activity.pick_date")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={reminderDate}
                      onSelect={setReminderDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                <Input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                />
              </div>

              <Select value={reminderType} onValueChange={(value: any) => setReminderType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">{t("forms.activity.types.call")}</SelectItem>
                  <SelectItem value="email">{t("forms.activity.types.email")}</SelectItem>
                  <SelectItem value="task">{t("forms.activity.types.task")}</SelectItem>
                  <SelectItem value="follow_up">{t("forms.activity.types.follow_up")}</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                onClick={handleSubmitReminder}
                disabled={!reminderContent.trim() || !reminderDate || !reminderTime || isSubmitting}
                size="sm"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isSubmitting ? t("forms.unified_activity.creating") : t("forms.unified_activity.create_reminder")}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="todo" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Input
                placeholder={t("forms.unified_activity.add_todo_placeholder")}
                value={todoContent}
                onChange={(e) => setTodoContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitTodo();
                  }
                }}
              />
              <Button 
                onClick={handleSubmitTodo}
                disabled={!todoContent.trim() || isSubmitting}
                size="sm"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isSubmitting ? t("forms.unified_activity.adding") : t("forms.unified_activity.add_todo")}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}