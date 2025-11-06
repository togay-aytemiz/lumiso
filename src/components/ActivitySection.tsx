import { useState, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimePicker } from "@/components/ui/time-picker";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, isAfter, isSameDay } from "date-fns";
import { Calendar as CalendarIcon, Clock, Plus, CheckCircle2, X, MessageSquare, MapPin, Trash2, Edit2, Filter, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useFormsTranslation, useCommonTranslation } from "@/hooks/useTypedTranslation";
import type { Database, Json } from "@/integrations/supabase/types";

interface Activity {
  id: string;
  type: string;
  content: string;
  reminder_date: string | null;
  reminder_time: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

interface Session {
  id: string;
  session_name: string | null;
  session_date: string;
  session_time: string;
  location: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

type AuditLogValues = Record<string, unknown> | null;

interface AuditLog {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values: AuditLogValues;
  new_values: AuditLogValues;
  created_at: string;
}

interface ActivitySectionProps {
  entityType: 'lead' | 'project';
  entityId: string;
  onUpdate?: () => void;
}

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type AuditLogRow = Database["public"]["Tables"]["audit_log"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const mapActivityRow = (row: ActivityRow): Activity => ({
  id: row.id,
  type: row.type,
  content: row.content,
  reminder_date: row.reminder_date,
  reminder_time: row.reminder_time,
  completed: Boolean(row.completed),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const mapSessionRow = (row: SessionRow): Session => ({
  id: row.id,
  session_name: row.session_name,
  session_date: row.session_date,
  session_time: row.session_time,
  location: row.location,
  notes: row.notes,
  status: row.status,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const jsonToRecord = (value: Json | null): AuditLogValues => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

const mapAuditLogRow = (row: AuditLogRow): AuditLog => ({
  id: row.id,
  user_id: row.user_id,
  entity_type: row.entity_type,
  entity_id: row.entity_id,
  action: row.action,
  old_values: jsonToRecord(row.old_values),
  new_values: jsonToRecord(row.new_values),
  created_at: row.created_at,
});

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
};

const getRecordValue = <T,>(
  record: AuditLogValues,
  key: string,
  predicate: (value: unknown) => value is T
): T | undefined => {
  const value = record?.[key];
  return predicate(value) ? value : undefined;
};

const getStringValue = (record: AuditLogValues, key: string): string | undefined =>
  getRecordValue(record, key, (value): value is string => typeof value === "string");

export default function ActivitySection({ entityType, entityId, onUpdate }: ActivitySectionProps) {
  const [content, setContent] = useState('');
  const [reminderDate, setReminderDate] = useState<Date | undefined>();
  const [reminderTime, setReminderTime] = useState<string>('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingActivity, setEditingActivity] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editReminderDate, setEditReminderDate] = useState<Date | undefined>();
  const [editReminderTime, setEditReminderTime] = useState<string>('');
  const [userProfiles, setUserProfiles] = useState<{ [key: string]: { full_name?: string; profile_photo_url?: string } }>({});
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("activities");
  const [openGroups, setOpenGroups] = useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();
  const { t: tForms } = useFormsTranslation();
  const { t: tCommon } = useCommonTranslation();

  const ACTIVITY_TYPES = [
    { value: "call", label: tForms('activities.types.call'), icon: "📞" },
    { value: "email", label: tForms('activities.types.email'), icon: "📧" },
    { value: "meeting", label: tForms('activities.types.meeting'), icon: "🤝" },
    { value: "note", label: tForms('activities.types.note'), icon: "📝" },
    { value: "task", label: tForms('activities.types.task'), icon: "✅" },
    { value: "follow_up", label: tForms('activities.types.follow_up'), icon: "🔄" },
  ];

  const [activityType, setActivityType] = useState('note');

  const fetchActivities = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from<ActivityRow>('activities')
        .select('*')
        .eq(entityType === 'lead' ? 'lead_id' : 'project_id', entityId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const normalized = (data ?? []).map(mapActivityRow);
      setActivities(normalized);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  }, [entityId, entityType]);

  const fetchSessions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from<SessionRow>('sessions')
        .select('*')
        .eq(entityType === 'lead' ? 'lead_id' : 'project_id', entityId)
        .order('session_date', { ascending: false });

      if (error) throw error;
      const normalized = (data ?? []).map(mapSessionRow);
      setSessions(normalized);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  }, [entityId, entityType]);

  const fetchUserProfiles = useCallback(async (userIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from<ProfileRow>('profiles')
        .select('user_id, full_name, profile_photo_url')
        .in('user_id', userIds);

      if (error) throw error;

      const profiles = (data ?? []).reduce((acc, profile) => {
        acc[profile.user_id] = {
          full_name: profile.full_name,
          profile_photo_url: profile.profile_photo_url
        };
        return acc;
      }, {} as { [key: string]: { full_name?: string; profile_photo_url?: string } });

      setUserProfiles(prev => ({ ...prev, ...profiles }));
    } catch (error) {
      console.error('Error fetching user profiles:', error);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from<AuditLogRow>('audit_log')
        .select('*')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const enrichedLogs = (data ?? []).map(mapAuditLogRow);
      
      // Collect all user IDs from the logs
      const allUserIds = new Set<string>();
      
      enrichedLogs.forEach(log => {
        if (log.user_id) {
          allUserIds.add(log.user_id);
        }
        // Assignee tracking removed - single user organization
      });
      
      // Fetch user profiles for all users
      if (allUserIds.size > 0) {
        await fetchUserProfiles(Array.from(allUserIds));
      }
      
      setAuditLogs(enrichedLogs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [entityId, fetchUserProfiles]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchActivities(),
        fetchSessions(),
        fetchAuditLogs()
      ]);
    } catch (error) {
      console.error('Error fetching activity data:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchActivities, fetchSessions, fetchAuditLogs]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSaveActivity = async () => {
    if (!content.trim()) {
      toast({
        title: tCommon('status.error'),
        description: tForms('validation.content_required'),
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) return;
      if (!organizationId) {
        throw new Error('No organization found');
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      let activityData;
      if (entityType === 'lead') {
        activityData = {
          type: activityType,
          content,
          reminder_date: reminderDate ? format(reminderDate, 'yyyy-MM-dd') : null,
          reminder_time: reminderTime || null,
          organization_id: organizationId,
          user_id: userData.user.id,
          lead_id: entityId,
          completed: false
        };
      } else {
        activityData = {
          type: activityType,
          content,
          reminder_date: reminderDate ? format(reminderDate, 'yyyy-MM-dd') : null,
          reminder_time: reminderTime || null,
          organization_id: organizationId,
          user_id: userData.user.id,
          project_id: entityId,
          completed: false
        };
      }

      const { error } = await supabase
        .from('activities')
        .insert(activityData);

      if (error) throw error;

      toast({
        title: tCommon('actions.success'),
        description: tCommon('messages.success.save')
      });

      // Reset form
      setContent('');
      setReminderDate(undefined);
      setReminderTime('');
      setActivityType('note');

      // Refresh data
      await fetchActivities();
      onUpdate?.();
    } catch (error) {
      toast({
        title: tCommon('status.error'),
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleComplete = async (activityId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('activities')
        .update({ completed })
        .eq('id', activityId);

      if (error) throw error;

      // Update local state
      setActivities(prev => prev.map(activity => 
        activity.id === activityId ? { ...activity, completed } : activity
      ));

      toast({
        title: tCommon('actions.success'),
        description: completed ? tCommon('status.completed') : tCommon('status.active')
      });
    } catch (error) {
      toast({
        title: tCommon('status.error'),
        description: getErrorMessage(error),
        variant: "destructive"
      });
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    try {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityId);

      if (error) throw error;

      // Update local state
      setActivities(prev => prev.filter(activity => activity.id !== activityId));

      toast({
        title: tCommon('actions.success'),
        description: tCommon('messages.success.delete')
      });
    } catch (error) {
      toast({
        title: tCommon('status.error'),
        description: getErrorMessage(error),
        variant: "destructive"
      });
    }
  };

  const handleEditActivity = (activity: Activity) => {
    setEditingActivity(activity.id);
    setEditContent(activity.content);
    setEditReminderDate(activity.reminder_date ? new Date(activity.reminder_date) : undefined);
    setEditReminderTime(activity.reminder_time || '');
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) {
      toast({
        title: tCommon('status.error'),
        description: tForms('validation.content_required'),
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('activities')
        .update({
          content: editContent,
          reminder_date: editReminderDate ? format(editReminderDate, 'yyyy-MM-dd') : null,
          reminder_time: editReminderTime || null,
        })
        .eq('id', editingActivity);

      if (error) throw error;

      // Update local state
      setActivities(prev => prev.map(activity => 
        activity.id === editingActivity ? {
          ...activity,
          content: editContent,
          reminder_date: editReminderDate ? format(editReminderDate, 'yyyy-MM-dd') : null,
          reminder_time: editReminderTime || null,
        } : activity
      ));

      setEditingActivity(null);
      setEditContent('');
      setEditReminderDate(undefined);
      setEditReminderTime('');

      toast({
        title: tCommon('actions.success'),
        description: tCommon('messages.success.update')
      });
    } catch (error) {
      toast({
        title: tCommon('status.error'),
        description: getErrorMessage(error),
        variant: "destructive"
      });
    }
  };

  const formatValue = (value: unknown, fieldType?: string): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toString();
    if (Array.isArray(value)) {
      return value.map((item) => formatValue(item, fieldType)).join(', ');
    }
    if (value instanceof Date) {
      return format(value, 'yyyy-MM-dd');
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (jsonError) {
        console.error('Unable to stringify value', jsonError);
        return '';
      }
    }
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
        const oldStatus = getStringValue(log.old_values, 'status');
        const newStatus = getStringValue(log.new_values, 'status');
        if (oldStatus || newStatus) {
          const fromStatus = oldStatus ?? 'unknown';
          const toStatus = newStatus ?? 'unknown';
          if (fromStatus !== toStatus) {
            changes.push(`status changed from "${fromStatus}" to "${toStatus}"`);
          }
        }
        
        // Assignee tracking removed - single user organization
        
        if (changes.length > 0) {
          return `Lead updated: ${changes.join(', ')}`;
        }
        
        return 'Lead updated';
      }
    } else if (log.entity_type === 'lead_field_value') {
      const fieldLabel =
        getStringValue(log.new_values, 'field_label') ??
        getStringValue(log.old_values, 'field_label') ??
        'Field';
      const fieldType =
        getStringValue(log.new_values, 'field_type') ??
        getStringValue(log.old_values, 'field_type') ??
        undefined;
      
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
      const name =
        getStringValue(log.new_values, 'name') ??
        getStringValue(log.old_values, 'name') ??
        null;
      if (log.action === 'created') return name ? `Project "${name}" created` : 'Project created';
      if (log.action === 'updated') return name ? `Project "${name}" updated` : 'Project updated';
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
  }))];

  // Filter logic
  const getFilteredItems = (items: typeof activitiesAndSessions) => {
    if (selectedFilter === "all") return items;
    if (selectedFilter === "completed") return items.filter(item => 
      item.type === 'activity' && item.data.completed
    );
    if (selectedFilter === "pending") return items.filter(item => 
      item.type === 'activity' && !item.data.completed
    );
    if (selectedFilter === "sessions") return items.filter(item => item.type === 'session');
    return items.filter(item => 
      item.type === 'activity' && item.data.type === selectedFilter
    );
  };

  const filteredActivitiesAndSessions = getFilteredItems(activitiesAndSessions);

  // Group by date
  const groupByDate = (items: typeof filteredActivitiesAndSessions) => {
    const groups = items.reduce((acc, item) => {
      const date = format(new Date(item.date), 'yyyy-MM-dd');
      if (!acc[date]) acc[date] = [];
      acc[date].push(item);
      return acc;
    }, {} as { [key: string]: typeof filteredActivitiesAndSessions });

    // Sort groups by date (newest first)
    return Object.entries(groups)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .reduce((acc, [date, items]) => {
        acc[date] = items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return acc;
      }, {} as { [key: string]: typeof filteredActivitiesAndSessions });
  };

  const groupedItems = groupByDate(filteredActivitiesAndSessions);

  const toggleGroup = (date: string) => {
    setOpenGroups(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (isSameDay(date, today)) return 'Today';
    if (isSameDay(date, yesterday)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  const getUserName = (userId: string) => {
    return userProfiles[userId]?.full_name || 'Unknown User';
  };

  const getUserAvatar = (userId: string) => {
    return userProfiles[userId]?.profile_photo_url || '';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>tForms('activities.activities_sessions_tab')</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {tForms('activities.activities_sessions_tab')}
          <div className="flex items-center gap-2">
            <Select value={selectedFilter} onValueChange={setSelectedFilter}>
              <SelectTrigger className="w-40 h-8">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tForms('activities.filter_all')}</SelectItem>
                <SelectItem value="pending">{tForms('activities.filter_pending')}</SelectItem>
                <SelectItem value="completed">{tForms('activities.filter_completed')}</SelectItem>
                <SelectItem value="sessions">{tForms('activities.filter_sessions')}</SelectItem>
                <Separator />
                {ACTIVITY_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="activities">{tForms('activities.activities_sessions_tab')}</TabsTrigger>
            <TabsTrigger value="history">{tForms('activities.system_history_tab')}</TabsTrigger>
          </TabsList>

          <TabsContent value="activities" className="space-y-4">
            {/* Add Activity Form */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <Select value={activityType} onValueChange={setActivityType}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Textarea 
                placeholder={tForms('placeholders.enter_activity_content')}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[80px]"
              />
              
              <div className="flex items-center gap-2 flex-wrap">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {reminderDate ? format(reminderDate, 'MMM d, yyyy') : tForms('labels.reminder_date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={reminderDate}
                      onSelect={setReminderDate}
                      disabled={(date) => isAfter(addDays(new Date(), -1), date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {reminderDate && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <TimePicker 
                      value={reminderTime}
                      onChange={setReminderTime}
                    />
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setReminderDate(undefined);
                        setReminderTime('');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              <Button onClick={handleSaveActivity} disabled={saving} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                {saving ? tCommon('actions.saving') : tForms('activities.add_activity')}
              </Button>
            </div>

            {/* Activities and Sessions List */}
            <div className="space-y-4">
              {Object.keys(groupedItems).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">{tCommon('messages.info.no_data')}</p>
                  <p className="text-sm">{tCommon('messages.info.select_item')}</p>
                </div>
              ) : (
                Object.entries(groupedItems).map(([date, items]) => (
                  <Collapsible 
                    key={date} 
                    open={openGroups[date] !== false}
                    onOpenChange={() => toggleGroup(date)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-between p-2 h-auto font-medium text-left"
                      >
                        <span className="text-sm text-muted-foreground">
                          {formatDateHeader(date)} ({items.length})
                        </span>
                        {openGroups[date] !== false ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {items.map((item) => (
                        <div 
                          key={`${item.type}-${item.data.id}`} 
                          className={cn(
                            "p-3 border rounded-lg transition-colors",
                            item.type === 'activity' && item.data.completed && "bg-muted/50",
                            item.type === 'session' && "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                          )}
                        >
                          {item.type === 'activity' ? (
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  {editingActivity === item.data.id ? (
                                    <div className="space-y-2">
                                      <Textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="min-h-[60px]"
                                      />
                                      <div className="flex items-center gap-2">
                                       <Button size="sm" onClick={handleSaveEdit}>
                                          {tCommon('buttons.save')}
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="outline" 
                                          onClick={() => setEditingActivity(null)}
                                        >
                                          {tCommon('buttons.cancel')}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="secondary" className="text-xs">
                                          {ACTIVITY_TYPES.find(t => t.value === item.data.type)?.icon || '📝'} 
                                          {ACTIVITY_TYPES.find(t => t.value === item.data.type)?.label || 'Note'}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {format(new Date(item.data.created_at), 'h:mm a')}
                                        </span>
                                      </div>
                                      <p className={cn(
                                        "text-sm whitespace-pre-wrap",
                                        item.data.completed && "line-through text-muted-foreground"
                                      )}>
                                        {item.data.content}
                                      </p>
                                      {(item.data.reminder_date || item.data.reminder_time) && (
                                         <div className="flex items-center gap-2 mt-2 text-xs text-orange-600 dark:text-orange-400">
                                           <Clock className="h-3 w-3" />
                                           {tForms('labels.reminder_date')}: {item.data.reminder_date && format(new Date(item.data.reminder_date), 'MMM d, yyyy')}
                                           {item.data.reminder_time && ` ${tCommon('labels.at')} ${item.data.reminder_time}`}
                                         </div>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleToggleComplete(item.data.id, !item.data.completed)}
                                    className={cn(
                                      "h-6 w-6 p-0",
                                      item.data.completed ? "text-green-600" : "text-muted-foreground"
                                    )}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditActivity(item.data)}
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteActivity(item.data.id)}
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            // Session display
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300">
                                  📸 Session
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(item.data.session_date), 'MMM d, yyyy')} at {item.data.session_time}
                                </span>
                              </div>
                              <p className="text-sm font-medium">
                                {item.data.session_name || 'Photography Session'}
                              </p>
                              {item.data.location && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  {item.data.location}
                                </div>
                              )}
                              {item.data.notes && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {item.data.notes}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="space-y-2">
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RotateCcw className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">{tCommon('messages.info.no_data')}</p>
                  <p className="text-sm">{tCommon('messages.info.loading')}</p>
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg bg-muted/20">
                    <Avatar className="h-6 w-6 mt-0.5">
                      <AvatarImage src={getUserAvatar(log.user_id)} />
                      <AvatarFallback className="text-xs">
                        {getInitials(getUserName(log.user_id))}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{getActivityDescription(log)}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{getUserName(log.user_id)}</span>
                        <span>•</span>
                        <span>{format(new Date(log.created_at), 'MMM d, yyyy at h:mm a')}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
