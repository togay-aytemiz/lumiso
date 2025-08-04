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
        title: "Success",
        description: "Note added successfully."
      });

      setNoteContent("");
      onActivityUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error adding note",
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
        title: "Success",
        description: "Reminder created successfully."
      });

      setReminderContent("");
      setReminderDate(undefined);
      setReminderTime("");
      onActivityUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error creating reminder",
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
        title: "Success",
        description: "Todo added successfully."
      });

      setTodoContent("");
      onActivityUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error adding todo",
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
              Note
            </TabsTrigger>
            <TabsTrigger value="reminder" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Reminder
            </TabsTrigger>
            <TabsTrigger value="todo" className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Todo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="note" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Input
                placeholder="Add a note about this project..."
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
                {isSubmitting ? "Adding..." : "Add Note"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="reminder" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Input
                placeholder="What would you like to be reminded about?"
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
                      {reminderDate ? format(reminderDate, "MMM d, yyyy") : "Pick date"}
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
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                onClick={handleSubmitReminder}
                disabled={!reminderContent.trim() || !reminderDate || !reminderTime || isSubmitting}
                size="sm"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isSubmitting ? "Creating..." : "Create Reminder"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="todo" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Input
                placeholder="Add a todo item for this project..."
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
                {isSubmitting ? "Adding..." : "Add Todo"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}