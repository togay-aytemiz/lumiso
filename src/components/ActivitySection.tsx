import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, FileText, Plus, MessageSquare, Bell, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ReminderCard from "@/components/ReminderCard";
import { formatLongDate, formatTime } from "@/lib/utils";
import { useCalendarSync } from "@/hooks/useCalendarSync";
import DateTimePicker from "@/components/ui/date-time-picker";
interface Activity {
  id: string;
  type: string;
  content: string;
  reminder_date?: string;
  reminder_time?: string;
  created_at: string;
  completed?: boolean;
  lead_id: string;
  user_id: string; // Add user_id field
  project_id?: string;
  projects?: {
    name: string;
  }; // Add projects relation for project name
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
  user_id?: string;
}
interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: string;
  created_at: string;
  user_id: string; // Add user_id field
  project_id?: string;
  projects?: {
    name: string;
  };
}
interface ActivitySectionProps {
  leadId: string;
  leadName?: string;
}
const ActivitySection = ({
  leadId,
  leadName
}: ActivitySectionProps) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, { full_name: string; profile_photo_url?: string }>>({});
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
    fetchActivities();
    fetchAuditLogs();
    fetchSessions();
  }, [leadId]);

  // Refresh audit logs when the component receives focus (useful for seeing real-time updates)
  useEffect(() => {
    const handleFocus = () => {
      fetchAuditLogs();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [leadId]);
  const fetchActivities = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('activities').select(`
          id, type, content, reminder_date, reminder_time, created_at, completed, lead_id, user_id, project_id,
          projects:project_id (name)
        `).eq('lead_id', leadId).order('created_at', {
        ascending: false
      });
      if (error) throw error;

      // Exclude reminders/notes belonging to archived projects
      const {
        data: userData
      } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Get user's active organization ID
      const { data: organizationId } = await supabase.rpc('get_user_active_organization_id');
      let filtered = data || [];
      if (organizationId) {
        // Get archived status
        const { data: archivedStatus } = await supabase
          .from('project_statuses')
          .select('id, name')
          .eq('organization_id', organizationId)
          .ilike('name', 'archived')
          .maybeSingle();
          
        if (archivedStatus?.id) {
          const {
            data: archivedProjects
          } = await supabase.from('projects').select('id').eq('lead_id', leadId).eq('status_id', archivedStatus.id);
          const archivedIds = new Set((archivedProjects || []).map(p => p.id));
          filtered = filtered.filter(a => !a.project_id || !archivedIds.has(a.project_id));
        }
      }
      setActivities(filtered);
      
      // Fetch user profiles for activities
      const userIds = [...new Set(filtered.map(a => a.user_id).filter(Boolean))];
      await fetchUserProfiles(userIds);
    } catch (error: any) {
      console.error('Error fetching activities:', error);
    }
  };
  const fetchSessions = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('sessions').select(`
          id, session_date, session_time, notes, status, created_at, user_id, project_id,
          projects:project_id (name)
        `).eq('lead_id', leadId).order('created_at', {
        ascending: false
      });
      if (error) throw error;

      // Exclude sessions belonging to archived projects
      const {
        data: userData
      } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      let filtered = data || [];
      if (userId) {
        // Get user's active organization
        const { data: userSettings } = await supabase
          .from('user_settings')
          .select('active_organization_id')
          .eq('user_id', userId)
          .single();

        // Skip archived project filtering for sessions too - will implement proper fix later
        // const {
        //   data: archivedStatus
        // } = await supabase.from('project_statuses').select('id, name').eq('organization_id', userSettings?.active_organization_id).ilike('name', 'archived').maybeSingle();
        // if (archivedStatus?.id) {
        //   const {
        //     data: archivedProjects
        //   } = await supabase.from('projects').select('id').eq('lead_id', leadId).eq('status_id', archivedStatus.id);
        //   const archivedIds = new Set((archivedProjects || []).map(p => p.id));
        //   filtered = filtered.filter(s => !s.project_id || !archivedIds.has(s.project_id));
        // }
      }
      setSessions(filtered || []);
      
      // Fetch user profiles for sessions
      const userIds = [...new Set((filtered || []).map(s => s.user_id).filter(Boolean))];
      await fetchUserProfiles(userIds);
    } catch (error: any) {
      console.error('Error fetching sessions:', error);
    }
  };
  const fetchUserProfiles = async (userIds: string[]) => {
    if (userIds.length === 0) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, profile_photo_url')
        .in('user_id', userIds);

      if (error) throw error;

      const profilesMap = data?.reduce((acc, profile) => {
        acc[profile.user_id] = {
          full_name: profile.full_name || 'Unknown User',
          profile_photo_url: profile.profile_photo_url
        };
        return acc;
      }, {} as Record<string, { full_name: string; profile_photo_url?: string }>) || {};

      setUserProfiles(prev => ({ ...prev, ...profilesMap }));
    } catch (error) {
      console.error('Error fetching user profiles:', error);
    }
  };
  
  const fetchAuditLogs = async () => {
    try {
      // Get sessions to help enrich with project names
      const {
        data: sessionsData
      } = await supabase.from('sessions').select('id, project_id').eq('lead_id', leadId);

      // Get projects for this lead for names and filtering project logs
      const {
        data: projectsForLead
      } = await supabase.from('projects').select('id, name').eq('lead_id', leadId);
      const projectIds = [...new Set((projectsForLead || []).map(p => p.id))];

      // Session audit logs for this lead (via session new/old values)
      const {
        data: allSessionAuditLogs
      } = await supabase.from('audit_log').select('*').eq('entity_type', 'session');
      const sessionAuditLogs = (allSessionAuditLogs || []).filter(log => {
        const sessionData = log.new_values || log.old_values;
        return sessionData && typeof sessionData === 'object' && sessionData !== null && 'lead_id' in sessionData && sessionData.lead_id === leadId;
      });

      // Lead audit logs (including lead_field_value)
      const {
        data: leadAuditLogs
      } = await supabase.from('audit_log').select('*').eq('entity_id', leadId);

      // Lead field value audit logs
      const {
        data: fieldValueAuditLogs
      } = await supabase.from('audit_log').select('*').eq('entity_type', 'lead_field_value').eq('entity_id', leadId);

      // Project audit logs (archived/restored)
      let projectAuditLogs: any[] = [];
      if (projectIds.length > 0) {
        const {
          data: projLogs
        } = await supabase.from('audit_log').select('*').eq('entity_type', 'project').in('entity_id', projectIds);
        projectAuditLogs = projLogs || [];
      }

      // Combine and sort
      const data = [...(leadAuditLogs || []), ...sessionAuditLogs, ...projectAuditLogs, ...(fieldValueAuditLogs || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Enrich logs with project names
      const projectsMap = new Map((projectsForLead || []).map(p => [p.id, p.name]));
      const enrichedLogs = (data || []).map(log => {
        if (log.entity_type === 'session') {
          const sessionData = log.new_values || log.old_values;
          const pid = (sessionData as any)?.project_id;
          return pid ? {
            ...log,
            session_project_id: pid,
            project_name: projectsMap.get(pid)
          } : log;
        }
        if (log.entity_type === 'project') {
          const pid = log.entity_id as string;
          return {
            ...log,
            project_name: projectsMap.get(pid)
          };
        }
        return log;
      });
      
      // Extract user IDs from all audit logs to fetch their profiles
      const allUserIds = new Set<string>();
      data.forEach(log => {
        // Add the user who made the change
        if (log.user_id) {
          allUserIds.add(log.user_id);
        }
        
        // Add assignees from lead changes
        if (log.entity_type === 'lead' && log.action === 'updated') {
          const oldAssignees = log.old_values?.assignees || [];
          const newAssignees = log.new_values?.assignees || [];
          [...oldAssignees, ...newAssignees].forEach(id => allUserIds.add(id));
        }
      });
      
      // Fetch user profiles for all users
      if (allUserIds.size > 0) {
        await fetchUserProfiles(Array.from(allUserIds));
      }
      
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
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!userSettings?.active_organization_id) {
        throw new Error("Organization required");
      }

      const activityDataWithOrg = {
        ...activityData,
        organization_id: userSettings.active_organization_id
      };

      const {
        data: newActivity,
        error
      } = await supabase.from('activities').insert(activityDataWithOrg).select('id').single();
      if (error) throw error;

      // Sync reminder to Google Calendar
      if (isReminderMode && newActivity && leadName) {
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
      const {
        error
      } = await supabase.from('activities').update({
        completed
      }).eq('id', activityId);
      if (error) throw error;

      // Update local state to reflect the change immediately
      setActivities(prev => prev.map(activity => activity.id === activityId ? {
        ...activity,
        completed
      } : activity));
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
  // Helper component for user avatar
  const UserAvatar = ({ userId, className = "" }: { userId?: string; className?: string }) => {
    if (!userId || !userProfiles[userId]) {
      return null;
    }

    const profile = userProfiles[userId];
    const initials = profile.full_name
      .split(' ')
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Avatar className="h-6 w-6">
          <AvatarImage src={profile.profile_photo_url} alt={profile.full_name} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
          {profile.full_name}
        </span>
      </div>
    );
  };

  const formatValue = (value: any, fieldType?: string) => {
    if (value === null || value === undefined || value === '') {
      return 'empty';
    }
    
    if (fieldType === 'date' && value) {
      return new Date(value).toLocaleDateString();
    }
    
    if (fieldType === 'checkbox') {
      return value === 'true' || value === true ? 'checked' : 'unchecked';
    }
    
    return `"${value}"`;
  };

  const formatAuditAction = (log: AuditLog) => {
    if (log.entity_type === 'lead') {
      if (log.action === 'created') {
        return 'Lead created';
      } else if (log.action === 'updated') {
        const changes = [];
        
        // Check for status changes
        const oldStatus = log.old_values?.status;
        const newStatus = log.new_values?.status;
        if (oldStatus !== newStatus) {
          changes.push(`status changed from "${oldStatus}" to "${newStatus}"`);
        }
        
        // Check for assignee changes
        const oldAssignees = log.old_values?.assignees || [];
        const newAssignees = log.new_values?.assignees || [];
        
        if (JSON.stringify(oldAssignees.sort()) !== JSON.stringify(newAssignees.sort())) {
          const added = newAssignees.filter(id => !oldAssignees.includes(id));
          const removed = oldAssignees.filter(id => !newAssignees.includes(id));
          
          if (added.length > 0 && removed.length > 0) {
            const addedNames = added.map(id => userProfiles[id]?.full_name || `User ${id.slice(0, 8)}`).join(', ');
            const removedNames = removed.map(id => userProfiles[id]?.full_name || `User ${id.slice(0, 8)}`).join(', ');
            changes.push(`assignees updated (added: ${addedNames}, removed: ${removedNames})`);
          } else if (added.length > 0) {
            const addedNames = added.map(id => userProfiles[id]?.full_name || `User ${id.slice(0, 8)}`).join(', ');
            changes.push(`${addedNames} assigned`);
          } else if (removed.length > 0) {
            const removedNames = removed.map(id => userProfiles[id]?.full_name || `User ${id.slice(0, 8)}`).join(', ');
            changes.push(`${removedNames} unassigned`);
          }
        }
        
        // Check for name changes
        const oldName = log.old_values?.name;
        const newName = log.new_values?.name;
        if (oldName !== newName) {
          changes.push(`name changed from ${formatValue(oldName)} to ${formatValue(newName)}`);
        }
        
        // Check for email changes
        const oldEmail = log.old_values?.email;
        const newEmail = log.new_values?.email;
        if (oldEmail !== newEmail) {
          changes.push(`email changed from ${formatValue(oldEmail)} to ${formatValue(newEmail)}`);
        }
        
        // Check for phone changes
        const oldPhone = log.old_values?.phone;
        const newPhone = log.new_values?.phone;
        if (oldPhone !== newPhone) {
          changes.push(`phone changed from ${formatValue(oldPhone)} to ${formatValue(newPhone)}`);
        }
        
        // Check for notes changes
        const oldNotes = log.old_values?.notes;
        const newNotes = log.new_values?.notes;
        if (oldNotes !== newNotes) {
          if (!oldNotes && newNotes) {
            changes.push('notes added');
          } else if (oldNotes && !newNotes) {
            changes.push('notes removed');
          } else if (oldNotes !== newNotes) {
            changes.push('notes updated');
          }
        }
        
        // Check for due date changes
        const oldDueDate = log.old_values?.due_date;
        const newDueDate = log.new_values?.due_date;
        if (oldDueDate !== newDueDate) {
          if (!oldDueDate && newDueDate) {
            changes.push(`due date set to ${new Date(newDueDate).toLocaleDateString()}`);
          } else if (oldDueDate && !newDueDate) {
            changes.push('due date removed');
          } else {
            changes.push(`due date changed from ${new Date(oldDueDate).toLocaleDateString()} to ${new Date(newDueDate).toLocaleDateString()}`);
          }
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
        return `${fieldLabel} set to ${value}`;
      } else if (log.action === 'updated') {
        const oldValue = formatValue(log.old_values?.value, fieldType);
        const newValue = formatValue(log.new_values?.value, fieldType);
        return `${fieldLabel} changed from ${oldValue} to ${newValue}`;
      } else if (log.action === 'deleted') {
        const value = formatValue(log.old_values?.value, fieldType);
        return `${fieldLabel} removed (was ${value})`;
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
    } else if (log.entity_type === 'project') {
      const name = (log as any).project_name || log.new_values?.name || log.old_values?.name;
      if (log.action === 'archived') return name ? `Project "${name}" archived` : 'Project archived';
      if (log.action === 'restored') return name ? `Project "${name}" restored` : 'Project restored';
    }
    return `${log.entity_type} ${log.action}`;
  };
  // Separate activities+sessions from audit logs for tabs
  const activitiesAndSessions = [...activities.map(activity => ({
    type: 'activity' as const,
    data: activity,
    date: activity.created_at
  })), ...sessions.map(session => ({
    type: 'session' as const,
    data: session,
    date: session.created_at
  }))].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const auditLogsOnly = auditLogs.map(log => ({
    type: 'audit' as const,
    data: log,
    date: log.created_at
  }))
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  .filter((item, index, array) => {
    // Simple deduplication: remove if identical to previous item
    if (index === 0) return true;
    const prev = array[index - 1];
    const current = item.data;
    const prevData = prev.data;
    return !(
      current.entity_type === prevData.entity_type &&
      current.action === prevData.action &&
      JSON.stringify(current.old_values || {}) === JSON.stringify(prevData.old_values || {}) &&
      JSON.stringify(current.new_values || {}) === JSON.stringify(prevData.new_values || {}) &&
      Math.abs(new Date(current.created_at).getTime() - new Date(prevData.created_at).getTime()) < 5000 // within 5 seconds
    );
  });

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
    return <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>;
  }
  return <div className="space-y-6">
      {/* Add Activity Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <Plus className="h-5 w-5" />
            Add Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <Label>Note</Label>
                <div className="flex items-center gap-2">
                  <Label htmlFor="reminder-toggle" className="text-sm font-medium">
                    Set Reminder?
                  </Label>
                  <Switch id="reminder-toggle" checked={isReminderMode} onCheckedChange={handleReminderToggle} />
                </div>
              </div>
              <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Enter your note..." rows={1} className="resize-none min-h-[40px] max-h-[40px] w-full" />
            </div>

            {isReminderMode && <div className="space-y-2">
                <Label>Date & Time</Label>
                <DateTimePicker value={reminderDateTime} onChange={setReminderDateTime} />
              </div>}

            <div className="flex justify-end">
              <Button onClick={handleSaveActivity} disabled={saving || !content.trim() || isReminderMode && !reminderDateTime} size="sm" className="animate-fade-in w-full sm:w-auto">
                {saving ? "Saving..." : `Add ${isReminderMode ? 'Reminder' : 'Note'}`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="activities" className="w-full">
            <TabsList className="bg-transparent border-b border-border p-0 h-auto w-full justify-start">
              <TabsTrigger value="activities" className="bg-transparent border-0 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-3 md:px-4 md:py-3 px-6 py-4 font-medium text-muted-foreground hover:text-foreground transition-colors flex-1 md:flex-initial">
                Activities
              </TabsTrigger>
              <TabsTrigger value="history" className="bg-transparent border-0 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-3 md:px-4 md:py-3 px-6 py-4 font-medium text-muted-foreground hover:text-foreground transition-colors flex-1 md:flex-initial">
                History
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="activities" className="mt-4">
              {Object.keys(groupedActivities).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No activities yet</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedActivities).map(([date, items]) => (
                    <div key={date}>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3 sticky top-0">
                        {formatLongDate(date)}
                      </h4>
                      <div className="space-y-3 pl-2 md:pl-4 border-l-2 border-muted">
                        {items.map((item, index) => (
                          <div key={`${item.type}-${item.data.id}-${index}`} className="relative">
                            <div className="absolute -left-4 md:-left-6 top-3 w-3 h-3 bg-background border-2 border-muted-foreground/40 rounded-full"></div>
                            <div className="bg-muted/50 rounded-lg py-6 px-4 flex items-center">
                              <div className="space-y-4 w-full pt-2">
                                {/* Row 1: Icon + Type chip + User attribution */}
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2">
                                    {item.type === 'activity' ? item.data.type === 'note' ? (
                                      <MessageSquare className="h-4 w-4 text-blue-500" />
                                    ) : (
                                      <Bell className="h-4 w-4 text-orange-500" />
                                    ) : (
                                      <Clock className="h-4 w-4 text-green-500" />
                                    )}
                                    <Badge variant="outline" className="text-xs">
                                      {item.type === 'activity' ? item.data.type : 'session'}
                                    </Badge>
                                  </div>
                                  <div className="flex-1" />
                                  <UserAvatar userId={item.data.user_id} />
                                </div>

                                {/* Row 2: Main content */}
                                <div className="pl-1">
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
                                          <p className="text-sm break-words">
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
                                            <p className={`text-sm break-words ${(item.data as Activity).completed ? 'line-through opacity-60' : ''}`}>
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

                                {/* Row 3: Project/Lead info */}
                                <div className="pl-1">
                                  <Badge variant="secondary" className={`text-xs max-w-[120px] md:max-w-[120px] max-w-full truncate ${item.data.project_id ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'}`}>
                                    {item.data.project_id ? item.data.projects?.name || 'Project' : 'Lead'}
                                  </Badge>
                                </div>

                                {/* Row 4: Date and time */}
                                <div className="pl-1">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {formatTime(new Date(item.date).toTimeString().slice(0, 5))}
                                  </div>
                                </div>
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
            
            <TabsContent value="history" className="mt-4">
              {Object.keys(groupedAuditLogs).length === 0 ? <p className="text-muted-foreground text-center py-8">No history yet</p> : <div className="space-y-6">
                  {Object.entries(groupedAuditLogs).map(([date, items]) => <div key={date}>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3 sticky top-0">
                        {formatLongDate(date)}
                      </h4>
                       <div className="space-y-3 pl-2 md:pl-4 border-l-2 border-muted">
                         {items.map((item, index) => <div key={`${item.type}-${item.data.id}-${index}`} className="relative">
                             <div className="absolute -left-4 md:-left-6 top-3 w-3 h-3 bg-background border-2 border-muted-foreground/40 rounded-full"></div>
                             <div className="bg-muted/50 rounded-lg p-2 md:p-3 space-y-1 md:space-y-2">
                                 <div className="flex flex-col gap-1 md:gap-2">
                                   <div className="flex items-start justify-between gap-2">
                                     <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                                       {/* Hide icon on mobile for compact view */}
                                       <div className="hidden md:block">
                                         <FileText className="h-4 w-4 text-gray-500" />
                                       </div>
                                       <span className="text-xs text-foreground font-medium break-words">
                                         {formatAuditAction(item.data as AuditLog)}
                                       </span>
                                       {/* Show project badge for session audit logs */}
                                       {(item.data as AuditLog).entity_type === 'session' && (item.data as AuditLog).project_name && <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 max-w-[120px] md:max-w-[120px] max-w-full truncate">
                                           {(item.data as AuditLog).project_name}
                                         </Badge>}
                                     </div>
                                     <div className="flex items-center gap-2 flex-shrink-0">
                                       <UserAvatar userId={(item.data as AuditLog).user_id} />
                                       <span className="text-xs text-muted-foreground">
                                         {formatTime(new Date(item.date).toTimeString().slice(0, 5))}
                                       </span>
                                     </div>
                                   </div>
                                 </div>
                            </div>
                          </div>)}
                      </div>
                    </div>)}
                </div>}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>;
};
export default ActivitySection;