import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ReminderCard from "@/components/ReminderCard";
import { formatTime, formatLongDate } from "@/lib/utils";
import { useCalendarSync } from "@/hooks/useCalendarSync";
import DateTimePicker from "@/components/ui/date-time-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

interface LeadActivity {
  id: string;
  type: string;
  content: string;
  reminder_date?: string;
  reminder_time?: string;
  created_at: string;
  completed?: boolean;
  lead_id: string;
  user_id: string;
}

interface AuditLog {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values?: any;
  new_values?: any;
  created_at: string;
}

interface LeadActivitySectionProps {
  leadId: string;
  leadName: string;
  onActivityUpdated?: () => void;
}

export function LeadActivitySection({
  leadId,
  leadName,
  onActivityUpdated
}: LeadActivitySectionProps) {
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, {
    full_name: string;
    profile_photo_url?: string;
  }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [content, setContent] = useState('');
  const [isReminderMode, setIsReminderMode] = useState(false);
  const [reminderDateTime, setReminderDateTime] = useState('');
  const {
    createReminderEvent
  } = useCalendarSync();

  useEffect(() => {
    fetchData();
  }, [leadId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchLeadActivities(),
        fetchAuditLogs()
      ]);
    } catch (error) {
      console.error('Error fetching lead activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadActivities = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('activities').select('id, type, content, reminder_date, reminder_time, created_at, completed, lead_id, user_id').eq('lead_id', leadId).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      const activities = data || [];
      setActivities(activities);
    } catch (error: any) {
      console.error('Error fetching lead activities:', error);
      setActivities([]);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      // Fetch audit logs for the lead and all its related entities
      const { data: leadLogs, error: leadError } = await supabase
        .from('audit_log')
        .select('*')
        .eq('entity_id', leadId)
        .order('created_at', { ascending: false });

      if (leadError) throw leadError;

      // Fetch audit logs for projects related to this lead
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('lead_id', leadId);

      let projectLogs: any[] = [];
      if (projects && projects.length > 0) {
        const projectIds = projects.map(p => p.id);
        const { data, error } = await supabase
          .from('audit_log')
          .select('*')
          .in('entity_id', projectIds)
          .order('created_at', { ascending: false });
        
        if (!error) {
          projectLogs = data || [];
        }
      }

      // Fetch audit logs for sessions related to this lead
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('lead_id', leadId);

      let sessionLogs: any[] = [];
      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map(s => s.id);
        const { data, error } = await supabase
          .from('audit_log')
          .select('*')
          .in('entity_id', sessionIds)
          .order('created_at', { ascending: false });
        
        if (!error) {
          sessionLogs = data || [];
        }
      }

      const allLogs = [...(leadLogs || []), ...projectLogs, ...sessionLogs]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Collect all user IDs from the logs
      const allUserIds = new Set<string>();
      
      allLogs.forEach(log => {
        if (log.user_id) {
          allUserIds.add(log.user_id);
        }
      });
      
      setAuditLogs(allLogs);
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
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
      const {
        data: userData
      } = await supabase.auth.getUser();
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

      // Get user's active organization
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error("Organization required");
      }

      const activityDataWithOrg = {
        ...activityData,
        organization_id: organizationId
      };

      const {
        data: newActivity,
        error
      } = await supabase.from('activities').insert(activityDataWithOrg).select('id').single();
      if (error) throw error;

      // Sync reminder to Google Calendar
      if (isReminderMode && newActivity) {
        createReminderEvent({
          id: newActivity.id,
          lead_id: leadId,
          content: content.trim(),
          reminder_date: reminderDateTime.split('T')[0],
          reminder_time: reminderDateTime.split('T')[1]
        }, {
          name: leadName
        });
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
      await fetchLeadActivities();

      // Notify parent about activity change
      onActivityUpdated?.();
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
      const {
        error
      } = await supabase.from('activities').update({
        completed
      }).eq('id', activityId);
      if (error) throw error;
      setActivities(prev => prev.map(activity => activity.id === activityId ? {
        ...activity,
        completed
      } : activity));
      toast({
        title: completed ? "Task marked as completed" : "Task marked as incomplete",
        description: "Task status updated successfully."
      });

      // Notify parent about activity change
      onActivityUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error updating task",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const formatValue = (value: any, fieldType?: string): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toString();
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  };

  const getActivityDescription = (log: AuditLog): string => {
    if (log.entity_type === 'lead') {
      if (log.action === 'created') return 'Lead created';
      if (log.action === 'archived') return 'Lead archived';
      if (log.action === 'restored') return 'Lead restored';
      
      if (log.action === 'updated') {
        const changes: string[] = [];
        
        // Check for status changes
        const oldStatus = log.old_values?.status;
        const newStatus = log.new_values?.status;
        if (oldStatus !== newStatus) {
          changes.push(`status changed from "${oldStatus}" to "${newStatus}"`);
        }
        
        if (changes.length > 0) {
          return `Lead updated: ${changes.join(', ')}`;
        }
        
        return 'Lead updated';
      }
    } else if (log.entity_type === 'lead_field_value') {
      const fieldLabel = log.new_values?.field_label || log.old_values?.field_label || 'Field';
      const fieldType = log.new_values?.field_type || log.old_values?.field_type;
      
      if (log.action === 'created') {
        const value = formatValue(log.new_values?.value, fieldType);
        return `${fieldLabel} added: ${value}`;
      }
      
      if (log.action === 'updated') {
        const oldValue = formatValue(log.old_values?.value, fieldType);
        const newValue = formatValue(log.new_values?.value, fieldType);
        return `${fieldLabel} changed from "${oldValue}" to "${newValue}"`;
      }
      
      if (log.action === 'deleted') {
        const value = formatValue(log.old_values?.value, fieldType);
        return `${fieldLabel} removed: ${value}`;
      }
    } else if (log.entity_type === 'project') {
      const name = log.new_values?.name || log.old_values?.name;
      if (log.action === 'created') return name ? `Project "${name}" created` : 'Project created';
      if (log.action === 'updated') return name ? `Project "${name}" updated` : 'Project updated';
      if (log.action === 'archived') return name ? `Project "${name}" archived` : 'Project archived';
      if (log.action === 'restored') return name ? `Project "${name}" restored` : 'Project restored';
    } else if (log.entity_type === 'session') {
      const name = log.new_values?.session_name || log.old_values?.session_name;
      if (log.action === 'created') return name ? `Session "${name}" created` : 'Session created';
      if (log.action === 'updated') return name ? `Session "${name}" updated` : 'Session updated';
      if (log.action === 'archived') return name ? `Session "${name}" archived` : 'Session archived';
      if (log.action === 'restored') return name ? `Session "${name}" restored` : 'Session restored';
    }
    return `${log.entity_type} ${log.action}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">
          Activities & History
        </h3>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="activity" className="w-full">
          <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="activity" className="space-y-4">
            {/* Add Activity Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Note</Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="reminder-toggle" className="text-sm font-medium">
                      Set Reminder?
                    </Label>
                    <Switch id="reminder-toggle" checked={isReminderMode} onCheckedChange={handleReminderToggle} />
                  </div>
                </div>
                <Textarea 
                  value={content} 
                  onChange={e => setContent(e.target.value)} 
                  placeholder="Enter your note..." 
                  rows={1} 
                  className="resize-none min-h-[40px] max-h-[40px]" 
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
                  onClick={handleSaveActivity} 
                  disabled={saving || !content.trim() || (isReminderMode && !reminderDateTime)} 
                  size="sm"
                >
                  {saving ? "Saving..." : `Add ${isReminderMode ? 'Reminder' : 'Note'}`}
                </Button>
              </div>
            </div>

            {/* Activities List */}
            {activities.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm text-muted-foreground">Recent activities</Label>
                <div className="space-y-2">
                  {activities.map(activity => (
                    <Card key={activity.id}>
                      <CardContent className="py-6 px-4 flex items-center">
                        <div className="space-y-4 w-full pt-2 my-0 py-0 px-0 mx-0">
                           {/* Row 1: Type badge */}
                           <div className="flex items-center gap-3">
                             <Badge variant="outline" className="text-xs">
                               {activity.type}
                             </Badge>
                           </div>
                          
                          {/* Row 2: Main content */}
                          <div className="pl-1">
                            {activity.type === 'reminder' && activity.reminder_date ? (
                              <ReminderCard 
                                activity={activity} 
                                leadName={leadName} 
                                onToggleCompletion={toggleCompletion} 
                                showCompletedBadge={false} 
                                hideStatusBadge={activity.completed} 
                              />
                            ) : activity.type === 'reminder' ? (
                              // Reminder without date - show with completion button
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={e => {
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
                                  <p className={`text-sm break-words ${activity.completed ? 'line-through opacity-60' : ''}`}>
                                    {activity.content}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              // Regular note - no completion button
                              <div>
                                <p className="text-sm break-words">
                                  {activity.content}
                                </p>
                              </div>
                            )}
                          </div>
                          
                           {/* Row 3: Date and time */}
                           <div className="pl-1">
                             <div className="flex items-center gap-2 text-xs text-muted-foreground">
                               {formatLongDate(activity.created_at)} at {formatTime(new Date(activity.created_at).toTimeString().slice(0, 5))}
                             </div>
                           </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="history" className="space-y-4">
            {auditLogs.length > 0 ? (
              <div className="space-y-3">
                <Label className="text-sm text-muted-foreground">System history</Label>
                 <div className="space-y-1">
                   {auditLogs.map(log => (
                     <div key={log.id} className="flex items-center justify-between py-2 px-3 hover:bg-muted/50 rounded-md">
                       <span className="text-sm text-foreground">
                         {getActivityDescription(log)}
                       </span>
                       <span className="text-xs text-muted-foreground">
                         {formatLongDate(log.created_at)} at {formatTime(format(new Date(log.created_at), 'HH:mm'))}
                       </span>
                     </div>
                   ))}
                 </div>
              </div>
            ) : (
               <div className="text-center py-8 text-muted-foreground">
                 <p>No history available</p>
               </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}