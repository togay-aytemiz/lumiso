import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, BellRing, Mail } from "lucide-react";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useTranslation } from "react-i18next";
import { TFunction } from "i18next";
import { sanitizeNotesInput } from "../utils/sanitizeNotes";
import { useSessionWorkflowCatalog, type WorkflowSummary } from "../context/SessionWorkflowProvider";
import type { SessionPlanningNotifications } from "../types";
import { Link } from "react-router-dom";

export const SummaryStep = () => {
  const { state } = useSessionPlanningContext();
  const { updateNotifications } = useSessionPlanningActions();
  const { t } = useTranslation("sessionPlanning");

  const sanitizedNotes = useMemo(
    () => sanitizeNotesInput(state.notes ?? ""),
    [state.notes]
  );
  const warningLabel = t("summary.warnings.missing");

  const handleNotificationToggle = useCallback(
    (key: keyof SessionPlanningNotifications, value: boolean) => {
      updateNotifications({ [key]: value });
    },
    [updateNotifications]
  );

  const leadValue = state.lead.name?.trim();
  const leadMissing = !leadValue;
  const leadDisplay: ReactNode = leadMissing
    ? <span className="text-muted-foreground">{t("summary.values.notSet")}</span>
    : leadValue!;

  const projectValue = state.project.name?.trim();
  const projectMissing = !projectValue;
  const projectDisplay: ReactNode = projectMissing
    ? <span className="text-muted-foreground">{t("summary.values.notLinked")}</span>
    : projectValue!;

  const sessionTypeValue = state.sessionTypeLabel?.trim();
  const sessionTypeMissing = !sessionTypeValue;
  const sessionTypeDisplay: ReactNode = sessionTypeMissing
    ? <span className="text-muted-foreground">{t("summary.values.notSet")}</span>
    : sessionTypeValue!;

  const locationValue =
    state.location?.trim() ||
    state.meetingUrl?.trim() ||
    state.locationLabel?.trim();
  const locationMissing = !locationValue;
  const locationDisplay: ReactNode = locationMissing
    ? <span className="text-muted-foreground">{t("summary.values.notSet")}</span>
    : locationValue!;

  const scheduleMissing = !state.schedule.date || !state.schedule.time;
  const scheduleDisplay: ReactNode = scheduleMissing
    ? <span className="text-muted-foreground">{t("summary.values.notScheduled")}</span>
    : renderSchedule(state.schedule, t);

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-slate-900">
        {t("summary.sectionTitle")}
      </h3>
      <p className="text-sm text-muted-foreground">{t("steps.summary.description")}</p>

      <Card>
        <CardContent className="space-y-3 text-sm">
          <SummaryRow
            label={t("summary.labels.lead")}
            value={leadDisplay}
            warning={leadMissing}
            warningLabel={warningLabel}
          />
          <SummaryRow
            label={t("summary.labels.project")}
            value={projectDisplay}
            warning={projectMissing}
            warningLabel={warningLabel}
          />
          <SummaryRow
            label={t("summary.labels.sessionType")}
            value={sessionTypeDisplay}
            warning={sessionTypeMissing}
            warningLabel={warningLabel}
          />
          <SummaryRow
            label={t("summary.labels.schedule")}
            value={scheduleDisplay}
            warning={scheduleMissing}
            warningLabel={warningLabel}
          />
          <SummaryRow
            label={t("summary.labels.location")}
            value={locationDisplay}
            warning={locationMissing}
            warningLabel={warningLabel}
          />
          <SummaryRow
            label={t("summary.labels.notes")}
            value={<NotesPreview content={sanitizedNotes} fallback={t("summary.values.empty")} />}
            warningLabel={warningLabel}
          />
          <NotificationPreview
            notifications={state.notifications}
            onToggle={handleNotificationToggle}
          />
        </CardContent>
      </Card>
    </div>
  );
};

interface SummaryRowProps {
  label: string;
  value: ReactNode;
  warning?: boolean;
  warningLabel: string;
}

const SummaryRow = ({ label, value, warning = false, warningLabel }: SummaryRowProps) => (
  <div className="grid grid-cols-[120px,1fr] items-start gap-4 text-sm">
    <span className="flex items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    <div className="flex min-w-0 items-start gap-2">
      <div className="min-w-0 break-words text-slate-900">{value}</div>
      {warning ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-label={warningLabel} />
      ) : null}
    </div>
  </div>
);

const renderSchedule = (
  schedule: { date?: string; time?: string; timezone?: string },
  t: TFunction<"sessionPlanning">
) => {
  if (!schedule.date && !schedule.time) {
    return t("summary.values.notScheduled");
  }
  const parts = [schedule.date ?? t("summary.values.dateTbd"), schedule.time ?? t("summary.values.timeTbd")];
  if (schedule.timezone) {
    parts.push(schedule.timezone);
  }
  return parts.join(" · ");
};

const NotesPreview = ({ content, fallback }: { content: string; fallback: string }) => {
  if (!content.trim()) {
    return <span className="text-muted-foreground">{fallback}</span>;
  }

  return <div className="whitespace-pre-wrap text-slate-800">{content}</div>;
};

const NotificationPreview = ({
  notifications,
  onToggle,
}: {
  notifications: SessionPlanningNotifications;
  onToggle: (key: keyof SessionPlanningNotifications, value: boolean) => void;
}) => {
  const { t } = useTranslation("sessionPlanning");
  const { loading, reminderWorkflows, summaryEmailWorkflows, otherWorkflows } = useSessionWorkflowCatalog();

  type WorkflowCategory = "reminder" | "summary" | "other";
  interface PreviewEntry {
    workflow: WorkflowSummary;
    categories: WorkflowCategory[];
    enabled: boolean;
    reminderType?: string | null;
  }

  const items = useMemo(
    () => [
      {
        key: "sendReminder" as const,
        label: t("summary.notifications.reminders"),
        description: t("summary.notifications.remindersDescription"),
        iconClass: "bg-emerald-50 text-emerald-600",
        icon: <BellRing className="h-4 w-4" aria-hidden="true" />,
      },
      {
        key: "sendSummaryEmail" as const,
        label: t("summary.notifications.summary"),
        description: t("summary.notifications.summaryDescription"),
        iconClass: "bg-sky-50 text-sky-600",
        icon: <Mail className="h-4 w-4" aria-hidden="true" />,
      },
    ],
    [t]
  );

  const aggregatedWorkflows = useMemo<PreviewEntry[]>(() => {
    const map = new Map<string, { workflow: WorkflowSummary; categories: Set<WorkflowCategory> }>();
    const register = (workflow: WorkflowSummary, category: WorkflowCategory) => {
      const existing = map.get(workflow.id);
      if (existing) {
        existing.categories.add(category);
      } else {
        map.set(workflow.id, { workflow, categories: new Set<WorkflowCategory>([category]) });
      }
    };

    reminderWorkflows.forEach((workflow) => register(workflow, "reminder"));
    summaryEmailWorkflows.forEach((workflow) => register(workflow, "summary"));
    otherWorkflows.forEach((workflow) => register(workflow, "other"));

    const entries = Array.from(map.values()).map(({ workflow, categories }) => {
      const hasReminderCategory = categories.has("reminder");
      const hasSummaryCategory = categories.has("summary");
      const enabled =
        categories.has("other") ||
        (hasReminderCategory && notifications.sendReminder) ||
        (hasSummaryCategory && notifications.sendSummaryEmail);

      return {
        workflow,
        categories: Array.from(categories),
        enabled,
        reminderType: workflow.reminderType ?? (workflow.triggerConditions as { reminder_type?: string } | undefined)?.reminder_type ?? null,
      };
    });

    const getPriority = (entry: PreviewEntry) => {
      if (entry.categories.includes("summary")) return 0;
      if (entry.categories.includes("reminder")) return 1;
      return 2;
    };

    return entries.sort((a, b) => {
      const priorityDiff = getPriority(a) - getPriority(b);
      if (priorityDiff !== 0) return priorityDiff;
      if (a.categories.includes("reminder") && b.categories.includes("reminder")) {
        const aDelay = a.workflow.delayMinutes ?? Number.MAX_SAFE_INTEGER;
        const bDelay = b.workflow.delayMinutes ?? Number.MAX_SAFE_INTEGER;
        if (aDelay !== bDelay) return aDelay - bDelay;
      }
      return (a.workflow.name || "").localeCompare(b.workflow.name || "");
    });
  }, [
    reminderWorkflows,
    summaryEmailWorkflows,
    otherWorkflows,
    notifications.sendReminder,
    notifications.sendSummaryEmail,
  ]);

  const missingMessages = useMemo(() => {
    if (loading) return [] as string[];
    const messages: string[] = [];
    if (notifications.sendReminder && reminderWorkflows.length === 0) {
      messages.push(t("summary.notifications.workflowMissingReminder"));
    }
    if (notifications.sendSummaryEmail && summaryEmailWorkflows.length === 0) {
      messages.push(t("summary.notifications.workflowMissingSummary"));
    }
    return messages;
  }, [
    loading,
    notifications.sendReminder,
    notifications.sendSummaryEmail,
    reminderWorkflows.length,
    summaryEmailWorkflows.length,
    t,
  ]);

  const categoryLabels: Record<WorkflowCategory, string> = useMemo(
    () => ({
      reminder: t("summary.notifications.workflowTags.reminder"),
      summary: t("summary.notifications.workflowTags.summary"),
      other: t("summary.notifications.workflowTags.other"),
    }),
    [t]
  );

  const formatTiming = useCallback(
    (delayMinutes?: number | null, reminderType?: string | null) => {
      if (delayMinutes === undefined || delayMinutes === null || delayMinutes <= 0) {
        if (reminderType && reminderType.trim().length > 0) {
          return reminderType;
        }
        return t("summary.notifications.workflowTiming.immediate");
      }
      const absoluteMinutes = Math.max(0, delayMinutes);
      if (absoluteMinutes % 1440 === 0) {
        const days = Math.round(absoluteMinutes / 1440);
        return t(
          days === 1
            ? "summary.notifications.workflowTiming.days"
            : "summary.notifications.workflowTiming.days_plural",
          { count: days }
        );
      }
      if (absoluteMinutes % 60 === 0) {
        const hours = Math.round(absoluteMinutes / 60);
        return t(
          hours === 1
            ? "summary.notifications.workflowTiming.hours"
            : "summary.notifications.workflowTiming.hours_plural",
          { count: hours }
        );
      }
      return t(
        absoluteMinutes === 1
          ? "summary.notifications.workflowTiming.minutes"
          : "summary.notifications.workflowTiming.minutes_plural",
        { count: absoluteMinutes }
      );
    },
    [t]
  );

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-amber-900">{t("summary.notifications.title")}</h4>
        <p className="text-xs text-amber-800">{t("summary.notifications.subtitle")}</p>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const enabled = notifications[item.key];
          return (
            <div
              key={item.key}
              className="flex flex-col gap-3 rounded-xl border border-amber-100 bg-white/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 rounded-full p-2 ${item.iconClass}`}>{item.icon}</div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-900">{item.label}</p>
                  <p className="text-xs text-amber-800 leading-relaxed">{item.description}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-xs font-medium uppercase tracking-wide text-amber-800">
                  {t(enabled ? "summary.status.on" : "summary.status.off")}
                </span>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => onToggle(item.key, checked)}
                  aria-label={t("summary.notifications.switchLabel", { notification: item.label })}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 space-y-2 text-xs leading-relaxed text-amber-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
          {t("summary.notifications.workflowHeading")}
        </p>
        {loading && aggregatedWorkflows.length === 0 ? (
          <p className="text-amber-700">{t("summary.notifications.workflowLoading")}</p>
        ) : aggregatedWorkflows.length === 0 ? (
          <p className="text-amber-700">{t("summary.notifications.workflowNoneConfigured")}</p>
        ) : (
          aggregatedWorkflows.map((entry) => {
            const { workflow, categories, enabled, reminderType } = entry;
            const isOptedOut = !enabled && !categories.includes("other");
            return (
              <div
                key={workflow.id}
                className={`rounded-lg border border-amber-100 bg-white/60 p-3 ${enabled ? "" : "opacity-75"}`}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-amber-900">{workflow.name}</span>
                  {categories.map((category) => (
                    <Badge
                      key={`${workflow.id}-${category}`}
                      variant="outline"
                      className="border-transparent bg-amber-100 text-[10px] font-semibold uppercase tracking-wide text-amber-900"
                    >
                      {categoryLabels[category]}
                    </Badge>
                  ))}
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    {t(enabled ? "summary.status.on" : "summary.status.off")}
                  </span>
                </div>
                {workflow.description ? (
                  <p className="mt-1 text-[11px] text-amber-800">{workflow.description}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-amber-700">
                  {formatTiming(workflow.delayMinutes ?? null, reminderType)}
                </p>
                {isOptedOut ? (
                  <p className="mt-1 text-[11px] text-amber-700">{t("summary.notifications.workflowOptOut")}</p>
                ) : null}
              </div>
            );
          })
        )}
        {missingMessages.map((message, index) => (
          <p key={`missing-${index}`} className="text-amber-700">
            {message}
          </p>
        ))}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-amber-900">
          <span>{t("summary.notifications.manageHelp")}</span>
          <Link
            to="/workflows"
            className="font-semibold underline underline-offset-4 hover:text-amber-950"
          >
            {t("summary.notifications.manageLink")}
          </Link>
        </div>
      </div>
    </div>
  );
};
