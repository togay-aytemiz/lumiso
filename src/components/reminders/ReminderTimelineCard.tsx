import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, CheckCircle2, Clock, RotateCcw, UserCircle } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

export interface ReminderTimelineCardActivity {
  id: string;
  content: string;
  reminder_date: string;
  reminder_time: string | null;
  lead_id: string;
  project_id?: string | null;
  completed?: boolean;
}

interface ReminderTimelineLabels {
  lead: string;
  markComplete: string;
  markIncomplete: string;
  openLead: string;
  openProject: string;
  noTime: string;
  overdue: string;
  today: string;
  tomorrow: string;
  completed: string;
}

export interface ReminderTimelineCardProps {
  activity: ReminderTimelineCardActivity;
  leadName: string;
  onToggleCompletion: (activityId: string, completed: boolean) => void;
  onOpenLead?: () => void;
  onOpenProject?: () => void;
  projectName?: string;
  labels?: ReminderTimelineLabels;
  showStatusIndicator?: boolean;
}

const isSameDay = (reminderDate?: string | null, offsetDays = 0) => {
  if (!reminderDate) return false;
  const today = new Date();
  const candidate = new Date(reminderDate);
  today.setHours(0, 0, 0, 0);
  candidate.setHours(0, 0, 0, 0);
  if (offsetDays !== 0) {
    today.setDate(today.getDate() + offsetDays);
  }
  return today.getTime() === candidate.getTime();
};

const isBeforeToday = (reminderDate?: string | null) => {
  if (!reminderDate) return false;
  const today = new Date();
  const candidate = new Date(reminderDate);
  today.setHours(0, 0, 0, 0);
  candidate.setHours(0, 0, 0, 0);
  return candidate.getTime() < today.getTime();
};

export const ReminderTimelineCard = ({
  activity,
  leadName,
  onToggleCompletion,
  onOpenLead,
  onOpenProject,
  projectName,
  labels: overrideLabels,
  showStatusIndicator = false,
}: ReminderTimelineCardProps) => {
  const { t } = useTranslation("pages");
  const { t: tForms } = useFormsTranslation();

  const labels = useMemo<ReminderTimelineLabels>(() => {
    if (overrideLabels) return overrideLabels;
    return {
      lead: tForms("reminders.lead"),
      markComplete: tForms("reminders.markComplete"),
      markIncomplete: tForms("reminders.markIncomplete"),
      openLead: t("reminders.timeline.openLead"),
      openProject: t("reminders.timeline.openProject"),
      noTime: tForms("reminders.noTime"),
      overdue: tForms("reminders.overdue"),
      today: tForms("reminders.today"),
      tomorrow: tForms("reminders.tomorrow"),
      completed: tForms("reminders.completed"),
    };
  }, [overrideLabels, t, tForms]);

  const statusFlags = useMemo(
    () => ({
      isOverdue: isBeforeToday(activity.reminder_date),
      isToday: isSameDay(activity.reminder_date),
      isTomorrow: isSameDay(activity.reminder_date, 1),
    }),
    [activity.reminder_date]
  );

  const statusConfig = useMemo(() => {
    if (activity.completed) {
      return {
        label: labels.completed,
        className:
          "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
        indicatorClassName: "border-emerald-300 bg-emerald-400/90",
      };
    }

    if (statusFlags.isOverdue) {
      return {
        label: labels.overdue,
        className: "bg-destructive/10 text-destructive border-destructive/20",
        indicatorClassName: "border-destructive/50 bg-destructive",
      };
    }

    if (statusFlags.isToday) {
      return {
        label: labels.today,
        className: "bg-primary/10 text-primary border-primary/20",
        indicatorClassName: "border-primary/40 bg-primary/80",
      };
    }

    if (statusFlags.isTomorrow) {
      return {
        label: labels.tomorrow,
        className:
          "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/30",
        indicatorClassName: "border-amber-300 bg-amber-400",
      };
    }

    return null;
  }, [activity.completed, labels, statusFlags]);

  const indicatorClassName = statusConfig
    ? statusConfig.indicatorClassName
    : "border-border/70 bg-muted-foreground/70";

  return (
    <div className={cn("relative", showStatusIndicator ? "pl-8" : "pl-0")}>
      {showStatusIndicator && (
        <span
          className={cn(
            "absolute left-[6px] top-5 h-2.5 w-2.5 rounded-full border-2 bg-background",
            indicatorClassName
          )}
          aria-hidden="true"
        />
      )}
      <div className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {statusConfig && (
                <Badge className={cn("text-xs", statusConfig.className)}>
                  {statusConfig.label}
                </Badge>
              )}
              {projectName && (
                <Badge variant="secondary" className="text-xs">
                  {projectName}
                </Badge>
              )}
            </div>
            <div>
              <h3
                className={cn(
                  "text-base font-medium text-foreground",
                  activity.completed && "line-through text-muted-foreground"
                )}
              >
                {activity.content}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <UserCircle className="h-4 w-4" aria-hidden="true" />
                  <span className="font-medium text-foreground">
                    {labels.lead}:
                  </span>
                  <span className="text-muted-foreground">{leadName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {activity.reminder_time
                      ? formatTime(activity.reminder_time)
                      : labels.noTime}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Button
              variant={activity.completed ? "outline" : "secondary"}
              size="sm"
              className="flex items-center gap-2"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleCompletion(activity.id, !activity.completed);
              }}
            >
              {activity.completed ? (
                <>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  {labels.markIncomplete}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {labels.markComplete}
                </>
              )}
            </Button>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {onOpenLead && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 text-primary"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenLead();
                  }}
                >
                  {labels.openLead}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
              {onOpenProject && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 text-primary"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenProject();
                  }}
                >
                  {labels.openProject}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

ReminderTimelineCard.displayName = "ReminderTimelineCard";
