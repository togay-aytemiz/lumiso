import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, FileText, Plus, MessageSquare, Bell, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ReminderCard from "@/components/ReminderCard";
import { formatLongDate, formatTime } from "@/lib/utils";
import { useCalendarSync } from "@/hooks/useCalendarSync";

interface Activity {
  id: string;
  type: string;
  content: string;
  reminder_date?: string;
  reminder_time?: string;
  created_at: string;
  completed?: boolean;
  lead_id: string;
  project_id?: string;
  projects?: { name: string }; // Add projects relation for project name
}

interface AuditLog {
  id: string;
  entity_type: string;
  action: string;
  old_values?: any;
  new_values?: any;
  created_at: string;
  session_project_id?: string;
  project_name?: string;
}

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: string;
  created_at: string;
  project_id?: string;
  projects?: {
    name: string;
  };
}

interface ActivitySectionProps {
  leadId: string;
  leadName?: string;
}

const ActivitySection = ({ leadId, leadName }: ActivitySectionProps) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [content, setContent] = useState('');
  const [isReminderMode, setIsReminderMode] = useState(false);
  const [reminderDateTime, setReminderDateTime] = useState('');
  
  const { createReminderEvent } = useCalendarSync();

  useEffect(() => {
    fetchActivities();
    fetchAuditLogs();
    fetchSessions();
  }, [leadId]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          id, type, content, reminder_date, reminder_time, created_at, completed, lead_id, project_id,
          projects:project_id (name)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error: any) {
      console.error('Error fetching activities:', error);
    }
  };

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id, session_date, session_time, notes, status, created_at, project_id,
          projects:project_id (name)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error: any) {
      console.error('Error fetching sessions:', error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      // Get sessions for this lead to include session audit logs
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('id, project_id')
        .eq('lead_id', leadId);
      
      const sessionIds = sessionsData?.map(s => s.id) || [];
      
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .or(`entity_id.eq.${leadId},entity_id.in.(${sessionIds.join(',')})`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Get project names for session audit logs
      const projectIds = [...new Set(sessionsData?.map(s => s.project_id).filter(Boolean) || [])];
      let projectsData: any[] = [];
      
      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name')
          .in('id', projectIds);
        projectsData = projects || [];
      }
      
      // Enrich session audit logs with project information
      const enrichedLogs = data?.map(log => {
        if (log.entity_type === 'session') {
          const sessionData = log.new_values || log.old_values;
          const projectId = (sessionData as any)?.project_id;
          if (projectId) {
            const project = projectsData.find(p => p.id === projectId);
            return {
              ...log,
              session_project_id: projectId,
              project_name: project?.name
            };
          }
        }
        return log;
      }) || [];
      
      setAuditLogs(enrichedLogs);
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

      const { data: newActivity, error } = await supabase
        .from('activities')
        .insert(activityData)
        .select('id')
        .single();

      if (error) throw error;

      // Sync reminder to Google Calendar
      if (isReminderMode && newActivity && leadName) {
        createReminderEvent(
          {
            id: newActivity.id,
            lead_id: leadId,
            content: content.trim(),
            reminder_date: reminderDateTime.split('T')[0],
            reminder_time: reminderDateTime.split('T')[1]
          },
          { name: leadName }
        );
      }

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

  const toggleCompletion = async (activityId: string, completed: boolean) => {
    try {
      // Update the completion status in the database
      const { error } = await supabase
        .from('activities')
        .update({ completed })
        .eq('id', activityId);

      if (error) throw error;

      // Update local state to reflect the change immediately
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

  const shouldShowStatusBadge = (activity: Activity) => {
    // Never show overdue badge for completed reminders
    if (activity.completed) return false;
    return true;
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
    } else if (log.entity_type === 'session') {
      if (log.action === 'created') {
        return 'Session created';
      } else if (log.action === 'updated') {
        const oldStatus = log.old_values?.status;
        const newStatus = log.new_values?.status;
        if (oldStatus !== newStatus) {
          return `Session status: ${oldStatus} → ${newStatus}`;
        }
        return 'Session updated';
      } else if (log.action === 'deleted') {
        return 'Session deleted';
      }
    } else if (log.entity_type === 'activity') {
      const activityType = log.new_values?.type || log.old_values?.type;
      if (log.action === 'created') {
        return `${activityType === 'note' ? 'Note' : 'Reminder'} added`;
      }
    }
    return `${log.entity_type} ${log.action}`;
  };

  // Separate activities+sessions from audit logs for tabs
  const activitiesAndSessions = [
    ...activities.map(activity => ({
      type: 'activity' as const,
      data: activity,
      date: activity.created_at
    })),
    ...sessions.map(session => ({
      type: 'session' as const,
      data: session,
      date: session.created_at
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const auditLogsOnly = auditLogs.map(log => ({
    type: 'audit' as const,
    data: log,
    date: log.created_at
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Group activities and sessions by date
  const groupedActivities = activitiesAndSessions.reduce((groups, item) => {
    const date = new Date(item.date).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(item);
    return groups;
  }, {} as Record<string, typeof activitiesAndSessions>);

  // Group audit logs by date
  const groupedAuditLogs = auditLogsOnly.reduce((groups, item) => {
    const date = new Date(item.date).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(item);
    return groups;
  }, {} as Record<string, typeof auditLogsOnly>);

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
              <div className="flex items-center justify-between">
                <Label>Note</Label>
                <div className="flex items-center gap-2">
                  <Label htmlFor="reminder-toggle" className="text-sm font-medium">
                    Set Reminder?
                  </Label>
                  <Switch
                    id="reminder-toggle"
                    checked={isReminderMode}
                    onCheckedChange={handleReminderToggle}
                  />
                </div>
              </div>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter your note..."
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
                className="animate-fade-in"
              >
                {saving ? "Saving..." : `Add ${isReminderMode ? 'Reminder' : 'Note'}`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="activities" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="activities">Activities</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="activities" className="mt-4">
              {Object.keys(groupedActivities).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No activities yet</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedActivities).map(([date, items]) => (
                    <div key={date}>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3 sticky top-0 bg-background">
                        {formatLongDate(date)}
                      </h4>
                      <div className="space-y-3 pl-4 border-l-2 border-muted">
                        {items.map((item, index) => (
                          <div key={`${item.type}-${item.data.id}-${index}`} className="relative">
                            <div className="absolute -left-6 top-3 w-3 h-3 bg-background border-2 border-muted-foreground/40 rounded-full"></div>
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
                                    <Clock className="h-4 w-4 text-green-500" />
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {item.type === 'activity' ? item.data.type : 'session'}
                                  </Badge>
                                  {/* Show project/lead badge */}
                                  <Badge 
                                    variant="secondary" 
                                    className={`text-xs ${
                                      item.data.project_id 
                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' 
                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                     }`}
                                   >
                                     {item.data.project_id 
                                       ? item.data.projects?.name || 'Project' 
                                       : 'Lead'}
                                   </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(new Date(item.date).toTimeString().slice(0,5))}
                                </span>
                              </div>
                              
                              {item.type === 'activity' && (
                                <>
                                  {(item.data as Activity).type === 'reminder' ? (
                                    <div className="mt-2">
                                      <ReminderCard
                                        activity={item.data as Activity}
                                        leadName={leadName}
                                        onToggleCompletion={toggleCompletion}
                                        showCompletedBadge={false}
                                        hideStatusBadge={!shouldShowStatusBadge(item.data as Activity)}
                                      />
                                    </div>
                                  ) : (item.data as Activity).type === 'note' ? (
                                    // Regular note - no completion button
                                    <div className="mt-2">
                                      <p className="text-sm">
                                        {(item.data as Activity).content}
                                      </p>
                                    </div>
                                  ) : (
                                    // Other activity types that might need completion
                                    <div className="flex items-start gap-3">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleCompletion((item.data as Activity).id, !(item.data as Activity).completed);
                                        }}
                                        className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-muted-foreground/40 hover:border-primary transition-colors mt-0.5 flex-shrink-0"
                                      >
                                        {(item.data as Activity).completed ? (
                                          <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                                        ) : (
                                          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                                        )}
                                      </button>
                                      <div className="flex-1">
                                        <p className={`text-sm ${(item.data as Activity).completed ? 'line-through opacity-60' : ''}`}>
                                          {(item.data as Activity).content}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                              
                              {item.type === 'session' && (
                                <div className="mt-2">
                                  <p className="text-sm font-medium">
                                    Session scheduled for {formatLongDate((item.data as Session).session_date)} at {formatTime((item.data as Session).session_time)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Status: {(item.data as Session).status}
                                  </p>
                                  {(item.data as Session).notes && (
                                    <p className="text-sm text-muted-foreground mt-1 italic">
                                      "{(item.data as Session).notes}"
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="history" className="mt-4">
              {Object.keys(groupedAuditLogs).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No history yet</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedAuditLogs).map(([date, items]) => (
                    <div key={date}>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3 sticky top-0 bg-background">
                        {formatLongDate(date)}
                      </h4>
                      <div className="space-y-3 pl-4 border-l-2 border-muted">
                        {items.map((item, index) => (
                          <div key={`${item.type}-${item.data.id}-${index}`} className="relative">
                            <div className="absolute -left-6 top-3 w-3 h-3 bg-background border-2 border-muted-foreground/40 rounded-full"></div>
                            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-gray-500" />
                                  <Badge variant="outline" className="text-xs">
                                    {formatAuditAction(item.data as AuditLog)}
                                  </Badge>
                                  {/* Show project badge for session audit logs */}
                                  {(item.data as AuditLog).entity_type === 'session' && (item.data as AuditLog).project_name && (
                                    <Badge 
                                      variant="secondary" 
                                      className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                                    >
                                      {(item.data as AuditLog).project_name}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(new Date(item.date).toTimeString().slice(0,5))}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivitySection;