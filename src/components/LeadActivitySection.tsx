import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { formatLongDate, formatTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityForm } from "@/components/shared/ActivityForm";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { useFormsTranslation } from '@/hooks/useTypedTranslation';
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useNavigate } from "react-router-dom";
import type { Database, Json } from "@/integrations/supabase/types";
type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type AuditLogRow = Database["public"]["Tables"]["audit_log"]["Row"];
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];

type TimelineActivity = {
  id: string;
  type: ActivityRow["type"];
  content: string;
  reminder_date: string | null;
  reminder_time: string | null;
  created_at: string;
  completed: boolean;
  lead_id: string;
  user_id: string;
  project_id?: string;
};

type ProjectSummary = Pick<ProjectRow, "id" | "name">;

type AuditLogValues = Record<string, unknown> | null;

interface AuditLogEntry {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values: AuditLogValues;
  new_values: AuditLogValues;
  created_at: string;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
};

const jsonToRecord = (value: Json | null): AuditLogValues => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

const mapActivityRow = (row: ActivityRow): TimelineActivity => ({
  id: row.id,
  type: row.type,
  content: row.content ?? "",
  reminder_date: row.reminder_date,
  reminder_time: row.reminder_time,
  created_at: row.created_at,
  completed: Boolean(row.completed),
  lead_id: row.lead_id,
  user_id: row.user_id,
  project_id: row.project_id ?? undefined,
});

const mapProjectRow = (row: ProjectRow): ProjectSummary => ({
  id: row.id,
  name: row.name ?? "Untitled Project",
});

const mapAuditLogRow = (row: AuditLogRow): AuditLogEntry => ({
  id: row.id,
  user_id: row.user_id,
  entity_type: row.entity_type,
  entity_id: row.entity_id,
  action: row.action,
  old_values: jsonToRecord(row.old_values),
  new_values: jsonToRecord(row.new_values),
  created_at: row.created_at,
});

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

const getValue = (record: AuditLogValues, key: string): unknown =>
  record ? record[key] : undefined;

const formatLogValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toString();
  if (Array.isArray(value)) {
    return value.map((item) => formatLogValue(item)).join(", ");
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};
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
  const { t } = useFormsTranslation();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<TimelineActivity[]>([]);
  const [projectActivities, setProjectActivities] = useState<TimelineActivity[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<"activity" | "history">("activity");

  const handleReminderProjectNavigate = useCallback(
    (projectId: string) => {
      if (!projectId) return;
      navigate(`/projects/${projectId}`);
    },
    [navigate]
  );
  
  const fetchLeadActivities = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from<ActivityRow>("activities")
        .select("*")
        .eq("lead_id", leadId)
        .is("project_id", null)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setActivities((data ?? []).map(mapActivityRow));
    } catch (error) {
      console.error("Error fetching lead activities:", error);
      setActivities([]);
    }
  }, [leadId]);

  const fetchProjectActivities = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from<ActivityRow>("activities")
        .select("*")
        .eq("lead_id", leadId)
        .not("project_id", "is", null)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setProjectActivities((data ?? []).map(mapActivityRow));
    } catch (error) {
      console.error("Error fetching project activities:", error);
      setProjectActivities([]);
    }
  }, [leadId]);

  const fetchProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from<ProjectRow>("projects")
        .select("id, name")
        .eq("lead_id", leadId);

      if (error) {
        throw error;
      }

      setProjects((data ?? []).map(mapProjectRow));
    } catch (error) {
      console.error("Error fetching projects:", error);
      setProjects([]);
    }
  }, [leadId]);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const allLogs: AuditLogEntry[] = [];

      const { data: leadLogRows, error: leadLogsError } = await supabase
        .from<AuditLogRow>("audit_log")
        .select("*")
        .eq("entity_id", leadId)
        .order("created_at", { ascending: false });

      if (leadLogsError) {
        throw leadLogsError;
      }

      allLogs.push(...(leadLogRows ?? []).map(mapAuditLogRow));

      const { data: projectRows, error: projectRowsError } = await supabase
        .from<ProjectRow>("projects")
        .select("id")
        .eq("lead_id", leadId);

      if (!projectRowsError && projectRows && projectRows.length > 0) {
        const projectIds = projectRows.map((row) => row.id);
        const { data: projectLogRows, error: projectLogsError } = await supabase
          .from<AuditLogRow>("audit_log")
          .select("*")
          .in("entity_id", projectIds)
          .order("created_at", { ascending: false });

        if (!projectLogsError) {
          allLogs.push(...(projectLogRows ?? []).map(mapAuditLogRow));
        }
      }

      const { data: sessionRows, error: sessionRowsError } = await supabase
        .from<SessionRow>("sessions")
        .select("id")
        .eq("lead_id", leadId);

      if (!sessionRowsError && sessionRows && sessionRows.length > 0) {
        const sessionIds = sessionRows.map((row) => row.id);
        const { data: sessionLogRows, error: sessionLogsError } = await supabase
          .from<AuditLogRow>("audit_log")
          .select("*")
          .in("entity_id", sessionIds)
          .order("created_at", { ascending: false });

        if (!sessionLogsError) {
          allLogs.push(...(sessionLogRows ?? []).map(mapAuditLogRow));
        }
      }

      allLogs.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setAuditLogs(allLogs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      setAuditLogs([]);
    }
  }, [leadId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchLeadActivities(),
        fetchProjectActivities(),
        fetchProjects(),
        fetchAuditLogs(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [fetchAuditLogs, fetchLeadActivities, fetchProjectActivities, fetchProjects]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);
  const handleSaveActivity = async (
    content: string,
    isReminderMode: boolean,
    reminderDateTime?: string
  ) => {
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

      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error("Organization required");
      }

      const activityData = {
        user_id: userData.user.id,
        lead_id: leadId,
        type: isReminderMode ? 'reminder' : 'note',
        content: content.trim(),
        reminder_date: isReminderMode && reminderDateTime ? reminderDateTime.split('T')[0] : null,
        reminder_time: isReminderMode && reminderDateTime ? reminderDateTime.split('T')[1] : null,
        organization_id: organizationId,
      };

      const { error } = await supabase
        .from('activities')
        .insert(activityData)
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: `${isReminderMode ? 'Reminder' : 'Note'} added successfully.`
      });

      // Refresh data
      await Promise.all([
        fetchLeadActivities(),
        fetchProjectActivities(),
        fetchAuditLogs(),
      ]);
      onActivityUpdated?.();
    } catch (error) {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };
  const toggleCompletion = async (activityId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('activities')
        .update({ completed })
        .eq('id', activityId);
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
    } catch (error) {
      toast({
        title: "Error updating task",
        description: getErrorMessage(error),
        variant: "destructive"
      });
    }
  };
  const getActivityDescription = (log: AuditLogEntry): string => {
    if (log.entity_type === 'lead') {
      if (log.action === 'created') return t('activityLogs.lead_created');
      if (log.action === 'archived') return t('activityLogs.lead_archived');
      if (log.action === 'restored') return t('activityLogs.lead_restored');
      if (log.action === 'updated') {
        const changes: string[] = [];

        // Check for status changes
        const oldStatus = getStringValue(log.old_values, "status");
        const newStatus = getStringValue(log.new_values, "status");
        if (oldStatus !== newStatus) {
          changes.push(t('activityLogs.status_changed_from_to', { oldStatus, newStatus }));
        }
        if (changes.length > 0) {
          return t('activityLogs.lead_updated_with_changes', { changes: changes.join(', ') });
        }
        return t('activityLogs.lead_updated');
      }
    } else if (log.entity_type === 'lead_field_value') {
      const fieldLabel =
        getStringValue(log.new_values, 'field_label') ??
        getStringValue(log.old_values, 'field_label') ??
        'Field';
      if (log.action === 'created') {
        const value = formatLogValue(getValue(log.new_values, 'value'));
        return t('activityLogs.field_added', { field: fieldLabel, value });
      }
      if (log.action === 'updated') {
        const oldValue = formatLogValue(getValue(log.old_values, 'value'));
        const newValue = formatLogValue(getValue(log.new_values, 'value'));
        return `${fieldLabel} changed from "${oldValue}" to "${newValue}"`;
      }
      if (log.action === 'deleted') {
        const value = formatLogValue(getValue(log.old_values, 'value'));
        return t('activityLogs.field_removed', { field: fieldLabel, value });
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
    } else if (log.entity_type === 'session') {
      const name =
        getStringValue(log.new_values, 'session_name') ??
        getStringValue(log.old_values, 'session_name') ??
        null;
      if (log.action === 'created') return name ? `Session "${name}" created` : 'Session created';
      if (log.action === 'updated') return name ? `Session "${name}" updated` : 'Session updated';
      if (log.action === 'archived') return name ? `Session "${name}" archived` : 'Session archived';
      if (log.action === 'restored') return name ? `Session "${name}" restored` : 'Session restored';
    }
    return `${log.entity_type} ${log.action}`;
  };
  if (loading) {
    return <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>;
  }
  return <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {t('activitiesHistory.title')}
          </h3>
          <SegmentedControl
            size="sm"
            value={selectedSegment}
            onValueChange={value => setSelectedSegment(value as typeof selectedSegment)}
            options={[
              { value: "activity", label: t('activitiesHistory.activity') },
              { value: "history", label: t('activitiesHistory.history') }
            ]}
          />
        </div>
      </CardHeader>
      <CardContent>
        {selectedSegment === "activity" ? <div className="space-y-6">
            <ActivityForm onSubmit={handleSaveActivity} loading={saving} placeholder={t('activitiesHistory.enterNote')} />

            <div className="space-y-4">
              {activities.length > 0 && <div>
                  <h4 className="text-sm mb-3 text-gray-900 font-semibold">{t('activitiesHistory.leadActivities')}</h4>
                  <ActivityTimeline
                    activities={activities}
                    leadName={leadName}
                    onToggleCompletion={toggleCompletion}
                    onReminderProjectNavigate={handleReminderProjectNavigate}
                  />
                </div>}

              {projectActivities.length > 0 && <div>
                  <h4 className="text-sm mb-3 font-bold text-gray-900">{t('activitiesHistory.projectActivities')}</h4>
                  <ActivityTimeline
                    activities={projectActivities}
                    projects={projects}
                    leadName={leadName}
                    onToggleCompletion={toggleCompletion}
                    onReminderProjectNavigate={handleReminderProjectNavigate}
                  />
                </div>}

              {activities.length === 0 && projectActivities.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">
                  {t('activitiesHistory.noActivitiesYet')}
                </div>}
            </div>
          </div> : <div className="space-y-4">
            {auditLogs.length > 0 ? <div className="space-y-1">
                {auditLogs.map(log => <div key={log.id} className="flex justify-between items-start p-2 text-sm hover:bg-muted/30 rounded">
                    <p className="text-foreground break-words flex-1">
                      {getActivityDescription(log)}
                    </p>
                    <div className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {formatLongDate(log.created_at)}
                    </div>
                  </div>)}
              </div> : <div className="text-sm text-muted-foreground text-center py-8">
                {t('activitiesHistory.noHistoryAvailable')}
              </div>}
          </div>}
      </CardContent>
    </Card>;
}
