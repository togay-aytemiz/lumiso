import { ActivityTimelineItem } from "./ActivityTimelineItem";
import {
  ReminderTimelineCard,
  type ReminderTimelineCardActivity,
} from "@/components/reminders/ReminderTimelineCard";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { formatGroupDate } from "@/lib/utils";

interface Activity {
  id: string;
  type: string;
  content: string;
  reminder_date?: string;
  reminder_time?: string;
  created_at: string;
  completed?: boolean;
  lead_id: string;
  user_id: string;
  project_id?: string;
}

interface Project {
  id: string;
  name: string;
}

interface ActivityTimelineProps {
  activities: Activity[];
  projects?: Project[];
  leadName: string;
  onToggleCompletion: (activityId: string, completed: boolean) => void;
  onReminderLeadNavigate?: (leadId: string) => void;
  onReminderProjectNavigate?: (projectId: string) => void;
  showReminderStatusIndicator?: boolean;
  onEditReminder?: (activity: ReminderTimelineCardActivity) => void;
  onDeleteReminder?: (activity: ReminderTimelineCardActivity) => void;
  onEditNote?: (activity: Activity) => void;
  onDeleteNote?: (activity: Activity) => void;
}

export function ActivityTimeline({
  activities,
  projects = [],
  leadName,
  onToggleCompletion,
  onReminderLeadNavigate,
  onReminderProjectNavigate,
  showReminderStatusIndicator = false,
  onEditReminder,
  onDeleteReminder,
  onEditNote,
  onDeleteNote,
}: ActivityTimelineProps) {
  const { t, i18n } = useFormsTranslation();
  const relativeDayLabels = {
    today: t("activitiesHistory.dayLabels.today"),
    yesterday: t("activitiesHistory.dayLabels.yesterday"),
  };
  
  if (activities.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-8">
        {t('activities.no_activities')}
      </div>;
  }
  const getProjectName = (projectId?: string) => {
    if (!projectId) return undefined;
    const project = projects.find(p => p.id === projectId);
    return project?.name;
  };
  const formatDayHeader = (date: string) => {
    const activityDate = parseISO(date);
    if (isToday(activityDate)) return relativeDayLabels.today;
    if (isYesterday(activityDate)) return relativeDayLabels.yesterday;
    return formatGroupDate(activityDate, i18n.language);
  };

  // Group activities by day
  const groupedActivities = activities.reduce((groups, activity) => {
    // Use reminder_date for reminders, created_at for notes
    const dateStr = activity.reminder_date || activity.created_at;
    const dayKey = format(parseISO(dateStr), "yyyy-MM-dd");
    if (!groups[dayKey]) {
      groups[dayKey] = {
        date: dayKey,
        activities: []
      };
    }
    groups[dayKey].activities.push(activity);
    return groups;
  }, {} as Record<string, {
    date: string;
    activities: Activity[];
  }>);
  const sortedDays = Object.values(groupedActivities).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return <div className="space-y-6">
      {sortedDays.map((day, dayIndex) => <div key={day.date} className="relative">
          {/* Day header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-primary" />
              {dayIndex < sortedDays.length - 1}
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">
              {formatDayHeader(day.date)}
            </h3>
          </div>

          {/* Activities for this day */}
          <div className="ml-6 space-y-1 relative">
            {/* Connecting line for activities */}
            <div className="absolute left-[-18px] top-0 bottom-0 w-px bg-muted-foreground/20" />
            
            {day.activities.map((activity, activityIndex) => {
          // Use ReminderTimelineCard for reminders with dates
          if (activity.type === "reminder" && activity.reminder_date) {
            const reminderActivity = {
              ...activity,
              reminder_date: activity.reminder_date as string,
              reminder_time: activity.reminder_time ?? null,
            };

            const handleOpenLead =
              onReminderLeadNavigate !== undefined
                ? () => onReminderLeadNavigate(activity.lead_id)
                : undefined;

            const handleOpenProject =
              onReminderProjectNavigate && activity.project_id
                ? () => onReminderProjectNavigate(activity.project_id!)
                : undefined;

            return (
              <ReminderTimelineCard
                key={activity.id}
                activity={reminderActivity}
                leadName={leadName}
                projectName={getProjectName(activity.project_id)}
                onToggleCompletion={onToggleCompletion}
                onOpenLead={handleOpenLead}
                onOpenProject={handleOpenProject}
                showStatusIndicator={showReminderStatusIndicator}
                onEditReminder={
                  onEditReminder
                    ? () => onEditReminder(reminderActivity)
                    : undefined
                }
                onDeleteReminder={
                  onDeleteReminder
                    ? () => onDeleteReminder(reminderActivity)
                    : undefined
                }
              />
            );
          }

          // Use timeline item for notes and reminders without dates
          return (
            <ActivityTimelineItem
              key={activity.id}
              id={activity.id}
              type={activity.type as "note" | "reminder"}
              content={activity.content}
              completed={activity.completed}
              projectName={getProjectName(activity.project_id)}
              onToggleCompletion={
                activity.type === "reminder" ? onToggleCompletion : undefined
              }
              onEditNote={
                activity.type === "note" && onEditNote
                  ? () => onEditNote(activity)
                  : undefined
              }
              onDeleteNote={
                activity.type === "note" && onDeleteNote
                  ? () => onDeleteNote(activity)
                  : undefined
              }
            />
          );
        })}
          </div>
        </div>)}
    </div>;
}
