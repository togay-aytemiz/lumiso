import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Clock, MessageSquare, Bell, CheckCircle, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ReminderCard from "@/components/ReminderCard";
import { formatTime } from "@/lib/utils";
import { useCalendarSync } from "@/hooks/useCalendarSync";

interface ProjectActivity {
  id: string;
  type: string;
  content: string;
  reminder_date?: string;
  reminder_time?: string;
  created_at: string;
  completed?: boolean;
  lead_id: string;
}

interface ProjectActivitySectionProps {
  projectId: string;
  leadId: string;
  leadName: string;
  projectName: string;
}

export function ProjectActivitySection({ projectId, leadId, leadName, projectName }: ProjectActivitySectionProps) {
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [content, setContent] = useState('');
  const [isReminderMode, setIsReminderMode] = useState(false);
  const [reminderDateTime, setReminderDateTime] = useState('');
  
  const { createReminderEvent } = useCalendarSync();

  useEffect(() => {
    fetchProjectActivities();
  }, [projectId]);

  const fetchProjectActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('id, type, content, reminder_date, reminder_time, created_at, completed, lead_id')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error: any) {
      console.error('Error fetching project activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveActivity = async () => {
    if (!content.trim()) {
      toast({
        title: "Validation error",
        description: "Content is required.",
        variant: "destructive"
      });
      return;
    }

    if (isReminderMode && !reminderDateTime) {
      toast({
        title: "Validation error",
        description: "Date and time are required for reminders.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const activityData = {
        user_id: userData.user.id,
        lead_id: leadId,
        type: isReminderMode ? 'reminder' : 'note',
        content: content.trim(),
        ...(isReminderMode && reminderDateTime && {
          reminder_date: reminderDateTime.split('T')[0],
          reminder_time: reminderDateTime.split('T')[1]
        })
      };

      const { data: newActivity, error } = await supabase
        .from('activities')
        .insert(activityData)
        .select('id')
        .single();

      if (error) throw error;

      // Sync reminder to Google Calendar with project context
      if (isReminderMode && newActivity) {
        createReminderEvent(
          {
            id: newActivity.id,
            lead_id: leadId,
            content: `${projectName}: ${content.trim()}`,
            reminder_date: reminderDateTime.split('T')[0],
            reminder_time: reminderDateTime.split('T')[1]
          },
          { name: leadName }
        );
      }

      toast({
        title: "Success",
        description: `${isReminderMode ? 'Reminder' : 'Note'} added to project successfully.`
      });

      // Reset form
      setContent('');
      setReminderDateTime('');
      setIsReminderMode(false);
      
      // Refresh data
      await fetchProjectActivities();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReminderToggle = (checked: boolean) => {
    setIsReminderMode(checked);
    if (!checked) {
      setReminderDateTime('');
    }
  };

  const toggleCompletion = async (activityId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('activities')
        .update({ completed })
        .eq('id', activityId);

      if (error) throw error;

      setActivities(prev => 
        prev.map(activity => 
          activity.id === activityId ? { ...activity, completed } : activity
        )
      );
      
      toast({
        title: completed ? "Task marked as completed" : "Task marked as incomplete",
        description: "Task status updated successfully."
      });
    } catch (error: any) {
      toast({
        title: "Error updating task",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Activity Section */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Add project-specific activity</Label>
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Note</Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="project-reminder-toggle" className="text-sm font-medium">
                      Set Reminder?
                    </Label>
                    <Switch
                      id="project-reminder-toggle"
                      checked={isReminderMode}
                      onCheckedChange={handleReminderToggle}
                    />
                  </div>
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter your project note..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              {isReminderMode && (
                <div className="space-y-2">
                  <Label>Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={reminderDateTime}
                    onChange={(e) => setReminderDateTime(e.target.value)}
                    className="w-full"
                  />
                </div>
              )}

              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveActivity} 
                  disabled={saving || !content.trim() || (isReminderMode && !reminderDateTime)}
                  size="sm"
                >
                  {saving ? "Saving..." : `Add ${isReminderMode ? 'Reminder' : 'Note'}`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Activities List */}
      {!loading && activities.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Project activities</Label>
          <div className="space-y-2">
            {activities.map((activity) => (
              <Card key={activity.id}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2 mt-0.5">
                      {activity.type === 'note' ? (
                        <MessageSquare className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Bell className="h-4 w-4 text-orange-500" />
                      )}
                      <Badge variant="outline" className="text-xs">
                        {activity.type}
                      </Badge>
                    </div>
                    <div className="flex-1 space-y-2">
                      {activity.type === 'reminder' && activity.reminder_date ? (
                        <ReminderCard
                          activity={activity}
                          leadName={leadName}
                          onToggleCompletion={toggleCompletion}
                          showCompletedBadge={false}
                          hideStatusBadge={activity.completed}
                        />
                      ) : (
                        <div className="flex items-start gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCompletion(activity.id, !activity.completed);
                            }}
                            className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-muted-foreground/40 hover:border-primary transition-colors mt-0.5 flex-shrink-0"
                          >
                            {activity.completed ? (
                              <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                            ) : (
                              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                            )}
                          </button>
                          <div className="flex-1">
                            <p className={`text-sm ${activity.completed ? 'line-through opacity-60' : ''}`}>
                              {activity.content}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(activity.created_at).toLocaleDateString()} at {formatTime(new Date(activity.created_at).toTimeString().slice(0,5))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}