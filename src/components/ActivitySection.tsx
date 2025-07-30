import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Clock, FileText, Plus, MessageSquare, Bell } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Activity {
  id: string;
  type: string;
  content: string;
  reminder_date?: string;
  reminder_time?: string;
  created_at: string;
}

interface AuditLog {
  id: string;
  entity_type: string;
  action: string;
  old_values?: any;
  new_values?: any;
  created_at: string;
}

interface ActivitySectionProps {
  leadId: string;
  leadName: string;
}

const ActivitySection = ({ leadId, leadName }: ActivitySectionProps) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [activityType, setActivityType] = useState<'note' | 'reminder'>('note');
  const [content, setContent] = useState('');
  const [reminderDate, setReminderDate] = useState<Date>();
  const [reminderTime, setReminderTime] = useState('');

  useEffect(() => {
    fetchActivities();
    fetchAuditLogs();
  }, [leadId]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error: any) {
      console.error('Error fetching activities:', error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('entity_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
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

    if (activityType === 'reminder' && (!reminderDate || !reminderTime)) {
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
        type: activityType,
        content: content.trim(),
        ...(activityType === 'reminder' && {
          reminder_date: reminderDate?.toISOString().split('T')[0],
          reminder_time: reminderTime
        })
      };

      const { error } = await supabase
        .from('activities')
        .insert(activityData);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${activityType === 'note' ? 'Note' : 'Reminder'} added successfully.`
      });

      // Reset form
      setContent('');
      setReminderDate(undefined);
      setReminderTime('');
      
      // Refresh data
      await fetchActivities();
      await fetchAuditLogs();
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

  const formatAuditAction = (log: AuditLog) => {
    if (log.entity_type === 'lead') {
      if (log.action === 'created') {
        return 'Lead created';
      } else if (log.action === 'updated') {
        const oldStatus = log.old_values?.status;
        const newStatus = log.new_values?.status;
        if (oldStatus !== newStatus) {
          return `Status changed from "${oldStatus}" to "${newStatus}"`;
        }
        return 'Lead updated';
      }
    } else if (log.entity_type === 'activity') {
      const activityType = log.new_values?.type || log.old_values?.type;
      if (log.action === 'created') {
        return `${activityType === 'note' ? 'Note' : 'Reminder'} added`;
      }
    }
    return `${log.entity_type} ${log.action}`;
  };

  // Combine and sort activities and audit logs by date
  const timelineItems = [
    ...activities.map(activity => ({
      type: 'activity' as const,
      data: activity,
      date: activity.created_at
    })),
    ...auditLogs.map(log => ({
      type: 'audit' as const,
      data: log,
      date: log.created_at
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Group by date
  const groupedItems = timelineItems.reduce((groups, item) => {
    const date = new Date(item.date).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(item);
    return groups;
  }, {} as Record<string, typeof timelineItems>);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Activity Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Activity Type</Label>
            <Select value={activityType} onValueChange={(value: 'note' | 'reminder') => setActivityType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="reminder">Reminder</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Enter ${activityType} content...`}
              rows={3}
            />
          </div>

          {activityType === 'reminder' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
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
                      {reminderDate ? format(reminderDate, "PPP") : "Pick a date"}
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
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                />
              </div>
            </div>
          )}

          <Button onClick={handleSaveActivity} disabled={saving || !content.trim()}>
            {saving ? "Saving..." : `Add ${activityType === 'note' ? 'Note' : 'Reminder'}`}
          </Button>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedItems).length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No activity yet</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedItems).map(([date, items]) => (
                <div key={date}>
                  <h4 className="font-medium text-sm text-muted-foreground mb-3 sticky top-0 bg-background">
                    {new Date(date).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </h4>
                  <div className="space-y-3 pl-4 border-l-2 border-muted">
                    {items.map((item, index) => (
                      <div key={`${item.type}-${item.data.id}-${index}`} className="relative">
                        <div className="absolute -left-6 top-2 w-3 h-3 bg-background border-2 border-primary rounded-full"></div>
                        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {item.type === 'activity' ? (
                                item.data.type === 'note' ? (
                                  <MessageSquare className="h-4 w-4 text-blue-500" />
                                ) : (
                                  <Bell className="h-4 w-4 text-orange-500" />
                                )
                              ) : (
                                <FileText className="h-4 w-4 text-gray-500" />
                              )}
                              <Badge variant="outline" className="text-xs">
                                {item.type === 'activity' 
                                  ? item.data.type 
                                  : formatAuditAction(item.data)
                                }
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.date).toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                          
                          {item.type === 'activity' && (
                            <>
                              <p className="text-sm">{item.data.content}</p>
                              {item.data.type === 'reminder' && item.data.reminder_date && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  Reminder set for {new Date(item.data.reminder_date).toLocaleDateString()} 
                                  {item.data.reminder_time && ` at ${item.data.reminder_time}`}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivitySection;