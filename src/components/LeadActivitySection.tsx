import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { formatLongDate, formatTime } from "@/lib/utils";
import { useCalendarSync } from "@/hooks/useCalendarSync";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityForm } from "@/components/shared/ActivityForm";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";

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
  const [projectActivities, setProjectActivities] = useState<LeadActivity[]>([]);
  const [projects, setProjects] = useState<{id: string; name: string}[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { createReminderEvent } = useCalendarSync();

  useEffect(() => {
    fetchData();
  }, [leadId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchLeadActivities(),
        fetchProjectActivities(),
        fetchProjects(),
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
      const { data, error } = await supabase
        .from('activities')
        .select('id, type, content, reminder_date, reminder_time, created_at, completed, lead_id, user_id')
        .eq('lead_id', leadId)
        .is('project_id', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setActivities(data || []);
    } catch (error: any) {
      console.error('Error fetching lead activities:', error);
      setActivities([]);
    }
  };

  const fetchProjectActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('id, type, content, reminder_date, reminder_time, created_at, completed, lead_id, user_id, project_id')
        .eq('lead_id', leadId)
        .not('project_id', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProjectActivities(data || []);
    } catch (error: any) {
      console.error('Error fetching project activities:', error);
      setProjectActivities([]);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('lead_id', leadId);
      
      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      setProjects([]);
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

  const handleSaveActivity = async (content: string, isReminderMode: boolean, reminderDateTime?: string) => {
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

      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error("Organization required");
      }

      const activityDataWithOrg = {
        ...activityData,
        organization_id: organizationId
      };

      const { data: newActivity, error } = await supabase
        .from('activities')
        .insert(activityDataWithOrg)
        .select('id')
        .single();
      if (error) throw error;

      // Sync reminder to Google Calendar
      if (isReminderMode && newActivity) {
        createReminderEvent({
          id: newActivity.id,
          lead_id: leadId,
          content: content.trim(),
          reminder_date: reminderDateTime!.split('T')[0],
          reminder_time: reminderDateTime!.split('T')[1]
        }, {
          name: leadName
        });
      }

      toast({
        title: "Success",
        description: `${isReminderMode ? 'Reminder' : 'Note'} added successfully.`
      });

      // Refresh data
      await fetchLeadActivities();
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
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Activities & History
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="activity" className="w-full">
          <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground mb-6">
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="activity" className="space-y-6">
            <ActivityForm 
              onSubmit={handleSaveActivity}
              loading={saving}
              placeholder="Enter your note..."
            />

            <div className="space-y-4">
              {activities.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Lead Activities</h4>
                  <ActivityTimeline 
                    activities={activities}
                    leadName={leadName}
                    onToggleCompletion={toggleCompletion}
                  />
                </div>
              )}

              {projectActivities.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Project Activities</h4>
                  <ActivityTimeline 
                    activities={projectActivities}
                    projects={projects}
                    leadName={leadName}
                    onToggleCompletion={toggleCompletion}
                  />
                </div>
              )}

              {activities.length === 0 && projectActivities.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No activities yet
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="history" className="space-y-4">
            {auditLogs.length > 0 ? (
              <div className="space-y-1">
                {auditLogs.map(log => (
                  <div key={log.id} className="flex justify-between items-start p-2 text-sm hover:bg-muted/30 rounded">
                    <p className="text-foreground break-words flex-1">
                      {getActivityDescription(log)}
                    </p>
                    <div className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {formatLongDate(log.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">
                No history available
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}