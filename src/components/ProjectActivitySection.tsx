import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ActivityForm } from "@/components/shared/ActivityForm";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { toast } from "@/hooks/use-toast";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { formatLongDate } from "@/lib/utils";
import type { Database, Json } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type AuditLogRow = Database["public"]["Tables"]["audit_log"]["Row"];
type ProjectStatusRow = Database["public"]["Tables"]["project_statuses"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

type ProjectActivity = {
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

const mapActivityRow = (row: ActivityRow): ProjectActivity => ({
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

const jsonToRecord = (value: Json | null): AuditLogValues => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

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

const getNumberValue = (record: AuditLogValues, key: string): number | undefined =>
  getRecordValue(record, key, (value): value is number => typeof value === "number");

interface ProjectActivitySectionProps {
  projectId: string;
  leadId: string;
  leadName: string;
  projectName: string;
  onActivityUpdated?: () => void;
}

export function ProjectActivitySection({
  projectId,
  leadId,
  leadName,
  projectName,
  onActivityUpdated
}: ProjectActivitySectionProps) {
  const { t } = useFormsTranslation();
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [statusLookup, setStatusLookup] = useState<Record<string, string>>({});
  const [serviceLookup, setServiceLookup] = useState<Record<string, string>>({});
  const [selectedSegment, setSelectedSegment] = useState<"activity" | "history">("activity");

  const fetchProjectActivities = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from<ActivityRow>("activities")
        .select("*")
        .eq("lead_id", leadId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setActivities((data ?? []).map(mapActivityRow));
    } catch (error) {
      console.error("Error fetching project activities:", error);
      setActivities([]);
    }
  }, [leadId, projectId]);

  const fetchHistoryData = useCallback(async () => {
    try {
      const logMap = new Map<string, AuditLogEntry>();
      const statusIds = new Set<string>();
      const serviceIds = new Set<string>();
      const projectFilter = { project_id: projectId } as Json;

      const collect = (rows: AuditLogRow[] | null | undefined) => {
        (rows ?? []).forEach((row) => {
          const mapped = mapAuditLogRow(row);
          logMap.set(mapped.id, mapped);

          if (mapped.entity_type === "project") {
            const oldStatus = getStringValue(mapped.old_values, "status_id");
            const newStatus = getStringValue(mapped.new_values, "status_id");
            if (oldStatus) statusIds.add(oldStatus);
            if (newStatus) statusIds.add(newStatus);
          }

          if (mapped.entity_type === "project_service" || mapped.entity_type === "project_package") {
            const oldService = getStringValue(mapped.old_values, "service_id") ?? getStringValue(mapped.old_values, "package_id");
            const newService = getStringValue(mapped.new_values, "service_id") ?? getStringValue(mapped.new_values, "package_id");
            if (oldService) serviceIds.add(oldService);
            if (newService) serviceIds.add(newService);
          }
        });
      };

      const runQuery = async (
        query: Promise<{ data: AuditLogRow[] | null; error: PostgrestError | null }>
      ) => {
        const { data, error } = await query;
        if (error) {
          console.error("Error fetching project history logs:", error);
          return;
        }
        collect(data);
      };

      await runQuery(
        supabase
          .from<AuditLogRow>("audit_log")
          .select("*")
          .eq("entity_type", "project")
          .eq("entity_id", projectId)
          .order("created_at", { ascending: false })
      );

      const entityTypes: Array<AuditLogRow["entity_type"]> = [
        "session",
        "payment",
        "todo",
        "activity",
        "project_service",
        "project_package",
      ];

      for (const type of entityTypes) {
        await runQuery(
          supabase
            .from<AuditLogRow>("audit_log")
            .select("*")
            .eq("entity_type", type)
            .contains("new_values", projectFilter)
            .order("created_at", { ascending: false })
        );
        await runQuery(
          supabase
            .from<AuditLogRow>("audit_log")
            .select("*")
            .eq("entity_type", type)
            .contains("old_values", projectFilter)
            .order("created_at", { ascending: false })
        );
      }

      const logs = Array.from(logMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const lookupPromises: Promise<void>[] = [];

      if (statusIds.size > 0) {
        lookupPromises.push(
          supabase
            .from<ProjectStatusRow>("project_statuses")
            .select("id, name")
            .in("id", Array.from(statusIds))
            .then(({ data, error }) => {
              if (error || !data) {
                console.error("Error fetching project statuses for history:", error);
                setStatusLookup({});
                return;
              }
              setStatusLookup(
                data.reduce<Record<string, string>>((acc, row) => {
                  acc[row.id] = row.name;
                  return acc;
                }, {})
              );
            })
        );
      } else {
        setStatusLookup({});
      }

      if (serviceIds.size > 0) {
        lookupPromises.push(
          supabase
            .from<ServiceRow>("services")
            .select("id, name")
            .in("id", Array.from(serviceIds))
            .then(({ data, error }) => {
              if (error || !data) {
                console.error("Error fetching services for history:", error);
                setServiceLookup({});
                return;
              }
              setServiceLookup(
                data.reduce<Record<string, string>>((acc, row) => {
                  acc[row.id] = row.name ?? row.id;
                  return acc;
                }, {})
              );
            })
        );
      } else {
        setServiceLookup({});
      }

      if (lookupPromises.length > 0) {
        await Promise.all(lookupPromises);
      }

      setAuditLogs(logs);
    } catch (error) {
      console.error("Error fetching project history:", error);
      setAuditLogs([]);
      setStatusLookup({});
      setServiceLookup({});
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchProjectActivities(), fetchHistoryData()]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [fetchProjectActivities, fetchHistoryData]);

  const handleSaveActivity = async (
    content: string,
    isReminderMode: boolean,
    reminderDateTime?: string
  ) => {
    if (!content.trim()) {
      toast({
        title: t("validation.required_field"),
        description: t("validation.content_required"),
        variant: "destructive",
      });
      return;
    }
    if (isReminderMode && !reminderDateTime) {
      toast({
        title: t("validation.required_field"),
        description: t("validation.datetime_required_for_reminders"),
        variant: "destructive",
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

      const activityData: Partial<ActivityRow> & {
        user_id: string;
        lead_id: string;
        project_id: string;
        type: ActivityRow["type"];
        content: string;
        organization_id: string;
        reminder_date: string | null;
        reminder_time: string | null;
      } = {
        user_id: userData.user.id,
        lead_id,
        project_id: projectId,
        type: isReminderMode ? "reminder" : "note",
        content: content.trim(),
        reminder_date:
          isReminderMode && reminderDateTime ? reminderDateTime.split("T")[0] : null,
        reminder_time:
          isReminderMode && reminderDateTime ? reminderDateTime.split("T")[1] : null,
        organization_id: organizationId,
      };

      const { error } = await supabase
        .from('activities')
        .insert(activityData)
        .select('id')
        .single();

      if (error) throw error;

      toast({
        title: t("success.saved"),
        description: `${isReminderMode ? t("activity.reminder") : t("activity.note")} ${t("activity.added_to_project")}.`
      });

      // Refresh data
      await Promise.all([fetchProjectActivities(), fetchHistoryData()]);
      onActivityUpdated?.();
    } catch (error) {
      toast({
        title: t("error.generic"),
        description: getErrorMessage(error),
        variant: "destructive",
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
      
      setActivities(prev => prev.map(activity => 
        activity.id === activityId ? { ...activity, completed } : activity
      ));
      
      toast({
        title: completed ? t("activity.task_completed") : t("activity.task_incomplete"),
        description: t("activity.task_status_updated")
      });

      await fetchHistoryData();
      onActivityUpdated?.();
    } catch (error) {
      toast({
        title: t("activity.error_updating_task"),
        description: getErrorMessage(error),
        variant: "destructive"
      });
    }
  };

  const formatAmount = (value?: number) => {
    if (value === undefined || Number.isNaN(value)) {
      return undefined;
    }
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const toSentenceCase = (value?: string) => {
    if (!value) return undefined;
    return value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getStatusName = (statusId?: string) => {
    if (!statusId) return undefined;
    return statusLookup[statusId] ?? statusId;
  };

  const getServiceName = (serviceId?: string) => {
    if (!serviceId) return undefined;
    return serviceLookup[serviceId] ?? serviceId;
  };

  const getHistoryDescription = (log: AuditLogEntry): string => {
    if (log.entity_type === "project") {
      const name =
        getStringValue(log.new_values, "name") ??
        getStringValue(log.old_values, "name") ??
        projectName;

      if (log.action === "created") {
        return name ? `Project "${name}" created` : "Project created";
      }
      if (log.action === "archived") {
        return name ? `Project "${name}" archived` : "Project archived";
      }
      if (log.action === "restored") {
        return name ? `Project "${name}" restored` : "Project restored";
      }
      if (log.action === "updated") {
        const changes: string[] = [];
        const oldStatusId = getStringValue(log.old_values, "status_id");
        const newStatusId = getStringValue(log.new_values, "status_id");

        if (oldStatusId !== newStatusId) {
          const oldStatus = getStatusName(oldStatusId) ?? "Unspecified";
          const newStatus = getStatusName(newStatusId) ?? "Unspecified";
          changes.push(
            t("activityLogs.status_changed_from_to", {
              oldStatus,
              newStatus,
            })
          );
        }

        const oldName = getStringValue(log.old_values, "name");
        const newName = getStringValue(log.new_values, "name");
        if (oldName && newName && oldName !== newName) {
          changes.push(`Project renamed from "${oldName}" to "${newName}"`);
        }

        const oldPrice = getNumberValue(log.old_values, "base_price");
        const newPrice = getNumberValue(log.new_values, "base_price");
        if (
          oldPrice !== undefined &&
          newPrice !== undefined &&
          oldPrice !== newPrice
        ) {
          const formattedOld = formatAmount(oldPrice) ?? oldPrice.toString();
          const formattedNew = formatAmount(newPrice) ?? newPrice.toString();
          changes.push(
            `Base price changed from ${formattedOld} to ${formattedNew}`
          );
        }

        if (changes.length > 0) {
          return `Project updated: ${changes.join(", ")}`;
        }
        return "Project updated";
      }
    }

    if (log.entity_type === "session") {
      const sessionName =
        getStringValue(log.new_values, "session_name") ??
        getStringValue(log.old_values, "session_name") ??
        "Session";
      if (log.action === "created") {
        return `Session "${sessionName}" created`;
      }
      if (log.action === "updated") {
        return `Session "${sessionName}" updated`;
      }
      if (log.action === "deleted") {
        return `Session "${sessionName}" deleted`;
      }
    }

    if (log.entity_type === "payment") {
      const amount =
        getNumberValue(log.new_values, "amount") ??
        getNumberValue(log.old_values, "amount");
      const status =
        getStringValue(log.new_values, "status") ??
        getStringValue(log.old_values, "status");
      const description =
        getStringValue(log.new_values, "description") ??
        getStringValue(log.old_values, "description");
      const amountText =
        amount !== undefined ? formatAmount(amount) ?? `${amount}` : undefined;
      const statusText = toSentenceCase(status);

      if (log.action === "created") {
        return `Payment${
          amountText ? ` ${amountText}` : ""
        } recorded${description ? ` – ${description}` : ""}`;
      }
      if (log.action === "updated") {
        return `Payment${
          amountText ? ` ${amountText}` : ""
        } updated${statusText ? ` (Status: ${statusText})` : ""}`;
      }
      if (log.action === "deleted") {
        return `Payment${
          amountText ? ` ${amountText}` : ""
        } removed${description ? ` – ${description}` : ""}`;
      }
    }

    if (log.entity_type === "todo") {
      const content =
        getStringValue(log.new_values, "content") ??
        getStringValue(log.old_values, "content") ??
        "To-do item";
      if (log.action === "created") {
        return `To-do "${content}" added`;
      }
      if (log.action === "updated") {
        const completed = getRecordValue(
          log.new_values,
          "is_completed",
          (value): value is boolean => typeof value === "boolean"
        );
        if (completed !== undefined) {
          return `To-do "${content}" marked as ${
            completed ? "completed" : "incomplete"
          }`;
        }
        return `To-do "${content}" updated`;
      }
      if (log.action === "deleted") {
        return `To-do "${content}" removed`;
      }
    }

    if (log.entity_type === "activity") {
      const activityType =
        getStringValue(log.new_values, "type") ??
        getStringValue(log.old_values, "type") ??
        "note";
      const content =
        getStringValue(log.new_values, "content") ??
        getStringValue(log.old_values, "content") ??
        "";
      const label = toSentenceCase(activityType) ?? "Activity";

      if (log.action === "created") {
        return `${label} added${content ? `: ${content}` : ""}`;
      }
      if (log.action === "updated") {
        return `${label} updated${content ? `: ${content}` : ""}`;
      }
      if (log.action === "deleted") {
        return `${label} removed${content ? `: ${content}` : ""}`;
      }
    }

    if (
      log.entity_type === "project_service" ||
      log.entity_type === "project_package"
    ) {
      const identifier =
        getStringValue(log.new_values, "service_id") ??
        getStringValue(log.new_values, "package_id") ??
        getStringValue(log.old_values, "service_id") ??
        getStringValue(log.old_values, "package_id");
      const label =
        getServiceName(identifier) ??
        (identifier ? `Service ${identifier}` : "Service");

      if (log.action === "created") {
        return `${label} added to project`;
      }
      if (log.action === "updated") {
        return `${label} updated`;
      }
      if (log.action === "deleted") {
        return `${label} removed from project`;
      }
    }

    const fallbackLabel = toSentenceCase(log.entity_type) ?? log.entity_type;
    return `${fallbackLabel} ${log.action}`;
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
            {t("activitiesHistory.title")}
          </h3>
          <SegmentedControl
            size="sm"
            value={selectedSegment}
            onValueChange={(value) =>
              setSelectedSegment(value as typeof selectedSegment)
            }
            options={[
              { value: "activity", label: t("activitiesHistory.activity") },
              { value: "history", label: t("activitiesHistory.history") },
            ]}
          />
        </div>
      </CardHeader>
      <CardContent>
        {selectedSegment === "activity" ? (
          <div className="space-y-6">
            <ActivityForm
              onSubmit={handleSaveActivity}
              loading={saving}
              placeholder={t("projectDetails.activities.placeholder")}
            />

            <div className="space-y-4">
              {activities.length > 0 ? (
                <ActivityTimeline
                  activities={activities}
                  leadName={leadName}
                  onToggleCompletion={toggleCompletion}
                />
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  {t("activitiesHistory.noActivitiesYet")}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {auditLogs.length > 0 ? (
              <div className="space-y-1">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex justify-between items-start p-2 text-sm hover:bg-muted/30 rounded"
                  >
                    <p className="text-foreground break-words flex-1">
                      {getHistoryDescription(log)}
                    </p>
                    <div className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {formatLongDate(log.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">
                {t("activitiesHistory.noHistoryAvailable")}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
