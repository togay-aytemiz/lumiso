import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Clock, FileText, Plus, MessageSquare, Bell } from "lucide-react";
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
  const [content, setContent] = useState('');
  const [isReminderMode, setIsReminderMode] = useState(false);
  const [reminderDateTime, setReminderDateTime] = useState('');

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

      const { error } = await supabase
        .from('activities')
        .insert(activityData);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${isReminderMode ? 'Reminder' : 'Note'} added successfully.`
      });

      // Reset form
      setContent('');
      setReminderDateTime('');
      setIsReminderMode(false);
      
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

  const handleReminderToggle = (checked: boolean) => {
    setIsReminderMode(checked);
    if (!checked) {
      setReminderDateTime('');
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
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter your note..."
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="reminder-toggle" className="text-sm font-medium">
                Set Reminder?
              </Label>
              <Switch
                id="reminder-toggle"
                checked={isReminderMode}
                onCheckedChange={handleReminderToggle}
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

            <Button 
              onClick={handleSaveActivity} 
              disabled={saving || !content.trim() || (isReminderMode && !reminderDateTime)}
              className="w-full"
            >
              {saving ? "Saving..." : `Add ${isReminderMode ? 'Reminder' : 'Note'}`}
            </Button>
          </div>
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