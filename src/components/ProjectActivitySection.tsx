import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityForm } from "@/components/shared/ActivityForm";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { toast } from "@/hooks/use-toast";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { formatLongDate, formatTime } from "@/lib/utils";
import type { Database, Json } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

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

const getBooleanValue = (record: AuditLogValues, key: string): boolean | undefined =>
  getRecordValue(record, key, (value): value is boolean => typeof value === "boolean");

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
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [statusLookup, setStatusLookup] = useState<Record<string, string>>({});
  const [serviceLookup, setServiceLookup] = useState<Record<string, string>>({});
  const [selectedSegment, setSelectedSegment] = useState<"activity" | "history">("activity");

  const handleReminderLeadNavigate = useCallback(
    (targetLeadId: string) => {
      if (!targetLeadId) return;
      navigate(`/leads/${targetLeadId}`);
    },
    [navigate]
  );

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

  const logReferencesProject = useCallback(
    (values: Json | null): boolean => {
      const record = jsonToRecord(values);
      if (!record) return false;
      const candidateKeys = ["project_id", "projectId", "project"];

      return candidateKeys.some((key) => {
        const value = record[key];
        if (typeof value === "string") {
          return value === projectId;
        }
        if (
          value &&
          typeof value === "object" &&
          "id" in (value as Record<string, unknown>)
        ) {
          const maybeId = (value as Record<string, unknown>).id;
          return typeof maybeId === "string" && maybeId === projectId;
        }
        return false;
      });
    },
    [projectId]
  );

  const isRelevantLog = useCallback(
    (row: AuditLogRow) =>
      (row.entity_type === "project" && row.entity_id === projectId) ||
      logReferencesProject(row.new_values) ||
      logReferencesProject(row.old_values),
    [projectId, logReferencesProject]
  );

  const fetchHistoryData = useCallback(async () => {
    try {
      const logMap = new Map<string, AuditLogEntry>();
      const statusIds = new Set<string>();
      const serviceIds = new Set<string>();

      const collect = (rows: AuditLogRow[] | null | undefined) => {
        (rows ?? []).forEach((row) => {
          if (!isRelevantLog(row)) {
            return;
          }
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
          .limit(200)
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
            .order("created_at", { ascending: false })
            .limit(200)
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
  }, [projectId, isRelevantLog]);

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

  useEffect(() => {
    const channel = supabase
      .channel(`project-history-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_log",
        },
        (payload) => {
          const row = payload.new as AuditLogRow | null;
          if (row && isRelevantLog(row)) {
            void fetchHistoryData();
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId, fetchHistoryData, isRelevantLog]);

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
        lead_id: leadId,
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
    const notSet = t("activitiesHistory.historyMessages.notSet");

    const formatChange = (
      label: string,
      oldValue?: string | null,
      newValue?: string | null
    ) => {
      const safeOld =
        oldValue && oldValue.length > 0 ? oldValue : notSet;
      const safeNew =
        newValue && newValue.length > 0 ? newValue : notSet;
      return t("activitiesHistory.historyMessages.changeTemplate", {
        label,
        oldValue: safeOld,
        newValue: safeNew,
      });
    };

    const joinChanges = (changes: string[]) => changes.join("; ");

    const formatSessionTimeValue = (value?: string | null) => {
      if (!value) return undefined;
      const timePart = value.slice(0, 5);
      try {
        return formatTime(timePart);
      } catch {
        return value;
      }
    };

    const formatSessionDateValue = (value?: string | null) =>
      value ? formatLongDate(value) : undefined;

    if (log.entity_type === "project") {
      const name =
        getStringValue(log.new_values, "name") ??
        getStringValue(log.old_values, "name") ??
        projectName ??
        t("activitiesHistory.historyMessages.projectUnnamed");

      if (log.action === "created") {
        return name
          ? t("activitiesHistory.historyMessages.projectCreated", { name })
          : t("activitiesHistory.historyMessages.projectCreatedUnnamed");
      }
      if (log.action === "archived") {
        return name
          ? t("activitiesHistory.historyMessages.projectArchived", { name })
          : t("activitiesHistory.historyMessages.projectArchivedUnnamed");
      }
      if (log.action === "restored") {
        return name
          ? t("activitiesHistory.historyMessages.projectRestored", { name })
          : t("activitiesHistory.historyMessages.projectRestoredUnnamed");
      }
      if (log.action === "updated") {
        const changes: string[] = [];
        const oldStatusId = getStringValue(log.old_values, "status_id");
        const newStatusId = getStringValue(log.new_values, "status_id");

        if (oldStatusId !== newStatusId) {
          const oldStatus = getStatusName(oldStatusId) ?? notSet;
          const newStatus = getStatusName(newStatusId) ?? notSet;
          changes.push(
            t("activitiesHistory.historyMessages.projectStageChanged", {
              oldStatus,
              newStatus,
            })
          );
        }

        const oldName = getStringValue(log.old_values, "name");
        const newName = getStringValue(log.new_values, "name");
        if (oldName && newName && oldName !== newName) {
          changes.push(
            t("activitiesHistory.historyMessages.projectRenamed", {
              oldName,
              newName,
            })
          );
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
            t("activitiesHistory.historyMessages.projectBasePriceChanged", {
              oldPrice: formattedOld,
              newPrice: formattedNew,
            })
          );
        }

        const oldDescription = getStringValue(log.old_values, "description");
        const newDescription = getStringValue(log.new_values, "description");
        if (oldDescription !== newDescription) {
          changes.push(
            t("activitiesHistory.historyMessages.projectDescriptionUpdated")
          );
        }

        const oldProjectType = getStringValue(log.old_values, "project_type_id");
        const newProjectType = getStringValue(log.new_values, "project_type_id");
        if (oldProjectType !== newProjectType) {
          changes.push(
            t("activitiesHistory.historyMessages.projectTypeChanged")
          );
        }

        if (changes.length > 0) {
          return t(
            "activitiesHistory.historyMessages.projectUpdatedWithChanges",
            {
              changes: joinChanges(changes),
            }
          );
        }
        return t("activitiesHistory.historyMessages.projectUpdated");
      }
    }

    if (log.entity_type === "session") {
      const sessionName =
        getStringValue(log.new_values, "session_name") ??
        getStringValue(log.old_values, "session_name") ??
        t("activitiesHistory.historyMessages.sessionUntitled");

      if (log.action === "created") {
        return t("activitiesHistory.historyMessages.sessionCreated", {
          name: sessionName,
        });
      }
      if (log.action === "deleted") {
        return t("activitiesHistory.historyMessages.sessionDeleted", {
          name: sessionName,
        });
      }
      if (log.action === "updated") {
        const sessionChanges: string[] = [];
        const sessionFieldLabels: Record<string, string> = {
          session_date: t(
            "activitiesHistory.historyMessages.sessionFieldLabels.session_date"
          ),
          session_time: t(
            "activitiesHistory.historyMessages.sessionFieldLabels.session_time"
          ),
          session_name: t(
            "activitiesHistory.historyMessages.sessionFieldLabels.session_name"
          ),
          location: t(
            "activitiesHistory.historyMessages.sessionFieldLabels.location"
          ),
          status: t(
            "activitiesHistory.historyMessages.sessionFieldLabels.status"
          ),
          notes: t(
            "activitiesHistory.historyMessages.sessionFieldLabels.notes"
          ),
        };

        const oldDate = getStringValue(log.old_values, "session_date");
        const newDate = getStringValue(log.new_values, "session_date");
        if (oldDate !== newDate) {
          sessionChanges.push(
            formatChange(
              sessionFieldLabels.session_date,
              formatSessionDateValue(oldDate),
              formatSessionDateValue(newDate)
            )
          );
        }

        const oldTime = getStringValue(log.old_values, "session_time");
        const newTime = getStringValue(log.new_values, "session_time");
        if (oldTime !== newTime) {
          sessionChanges.push(
            formatChange(
              sessionFieldLabels.session_time,
              formatSessionTimeValue(oldTime),
              formatSessionTimeValue(newTime)
            )
          );
        }

        const oldLocation = getStringValue(log.old_values, "location");
        const newLocation = getStringValue(log.new_values, "location");
        if (oldLocation !== newLocation) {
          sessionChanges.push(
            formatChange(
              sessionFieldLabels.location,
              oldLocation,
              newLocation
            )
          );
        }

        const oldStatus = getStringValue(log.old_values, "status");
        const newStatus = getStringValue(log.new_values, "status");
        if (oldStatus !== newStatus) {
          sessionChanges.push(
            formatChange(
              sessionFieldLabels.status,
              toSentenceCase(oldStatus),
              toSentenceCase(newStatus)
            )
          );
        }

        const oldSessionName = getStringValue(log.old_values, "session_name");
        const newSessionName = getStringValue(log.new_values, "session_name");
        if (oldSessionName && newSessionName && oldSessionName !== newSessionName) {
          sessionChanges.push(
            formatChange(
              sessionFieldLabels.session_name,
              oldSessionName,
              newSessionName
            )
          );
        }

        const oldNotes = getStringValue(log.old_values, "notes");
        const newNotes = getStringValue(log.new_values, "notes");
        if (oldNotes !== newNotes) {
          sessionChanges.push(
            t("activitiesHistory.historyMessages.sessionNotesUpdated")
          );
        }

        if (sessionChanges.length > 0) {
          return t("activitiesHistory.historyMessages.sessionUpdated", {
            name: sessionName,
            changes: joinChanges(sessionChanges),
          });
        }
        return t("activitiesHistory.historyMessages.sessionUpdatedSimple", {
          name: sessionName,
        });
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
        amount !== undefined
          ? formatAmount(amount) ?? `${amount}`
          : t("activitiesHistory.historyMessages.paymentUnknownAmount");

      const statusSuffix = status
        ? t("activitiesHistory.historyMessages.paymentStatusSuffix", {
            status: toSentenceCase(status) ?? status,
          })
        : "";

      const detailsSuffix = description
        ? t("activitiesHistory.historyMessages.paymentDetailsSuffix", {
            details: description,
          })
        : "";

      if (log.action === "created") {
        return t("activitiesHistory.historyMessages.paymentRecorded", {
          amount: amountText,
          detailsSuffix,
        });
      }
      if (log.action === "updated") {
        return t("activitiesHistory.historyMessages.paymentUpdated", {
          amount: amountText,
          statusSuffix,
          detailsSuffix,
        });
      }
      if (log.action === "deleted") {
        return t("activitiesHistory.historyMessages.paymentRemoved", {
          amount: amountText,
          detailsSuffix,
        });
      }
    }

    if (log.entity_type === "todo") {
      const content =
        getStringValue(log.new_values, "content") ??
        getStringValue(log.old_values, "content") ??
        t("activitiesHistory.historyMessages.todoUnnamed");

      if (log.action === "created") {
        return t("activitiesHistory.historyMessages.todoAdded", { content });
      }
      if (log.action === "deleted") {
        return t("activitiesHistory.historyMessages.todoRemoved", { content });
      }
      if (log.action === "updated") {
        const oldCompleted = getBooleanValue(log.old_values, "is_completed");
        const newCompleted = getBooleanValue(log.new_values, "is_completed");
        if (
          oldCompleted !== undefined &&
          newCompleted !== undefined &&
          oldCompleted !== newCompleted
        ) {
          return t("activitiesHistory.historyMessages.todoToggled", {
            content,
            state: t(
              newCompleted
                ? "activitiesHistory.historyMessages.todoStateCompleted"
                : "activitiesHistory.historyMessages.todoStateIncomplete"
            ),
          });
        }

        const oldTodoContent = getStringValue(log.old_values, "content");
        const newTodoContent = getStringValue(log.new_values, "content");
        if (
          oldTodoContent &&
          newTodoContent &&
          oldTodoContent !== newTodoContent
        ) {
          return t("activitiesHistory.historyMessages.todoContentUpdated", {
            oldContent: oldTodoContent,
            newContent: newTodoContent,
          });
        }

        return t("activitiesHistory.historyMessages.todoUpdated", { content });
      }
    }

    if (log.entity_type === "activity") {
      const activityType =
        getStringValue(log.new_values, "type") ??
        getStringValue(log.old_values, "type") ??
        "activity";
      const defaultLabel =
        toSentenceCase(activityType) ??
        t("activitiesHistory.historyMessages.activityLabels.activity");
      const label = t(
        `activitiesHistory.historyMessages.activityLabels.${activityType}`,
        { defaultValue: defaultLabel }
      );
      const content =
        getStringValue(log.new_values, "content") ??
        getStringValue(log.old_values, "content") ??
        "";
      const contentSuffix = content
        ? t("activitiesHistory.historyMessages.activityContentSuffix", {
            content,
          })
        : "";

      if (log.action === "created") {
        return t("activitiesHistory.historyMessages.activityAdded", {
          label,
          content: contentSuffix,
        });
      }
      if (log.action === "updated") {
        return t("activitiesHistory.historyMessages.activityUpdated", {
          label,
          content: contentSuffix,
        });
      }
      if (log.action === "deleted") {
        return t("activitiesHistory.historyMessages.activityRemoved", {
          label,
          content: contentSuffix,
        });
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
        t("activitiesHistory.historyMessages.serviceFallbackLabel");

      if (log.action === "created") {
        return t("activitiesHistory.historyMessages.serviceAdded", { label });
      }
      if (log.action === "updated") {
        return t("activitiesHistory.historyMessages.serviceUpdated", { label });
      }
      if (log.action === "deleted") {
        return t("activitiesHistory.historyMessages.serviceRemoved", { label });
      }
    }

    return t("activitiesHistory.historyMessages.genericChange", {
      entity: toSentenceCase(log.entity_type) ?? log.entity_type,
      action: log.action,
    });
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
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            {t("activitiesHistory.title")}
          </CardTitle>
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
                  onReminderLeadNavigate={handleReminderLeadNavigate}
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
