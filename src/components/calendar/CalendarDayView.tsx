import { memo } from "react";
import { isToday } from "date-fns";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useOrganizationTimezone } from "@/hooks/useOrganizationTimezone";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  status: string;
  notes?: string;
  lead_id: string;
  project_id?: string | null;
}

interface Activity {
  id: string;
  content: string;  
  reminder_date: string;
  reminder_time?: string;
  type: string;
  lead_id: string;
  project_id?: string | null;
  completed?: boolean;
}

interface CalendarDayViewProps {
  currentDate: Date;
  getEventsForDate: (date: Date) => {
    sessions: Session[];
    activities: Activity[];
  };
  showSessions: boolean;
  showReminders: boolean;
  leadsMap: Record<string, { name: string }>;
  projectsMap: Record<string, { name: string }>;
  onSessionClick: (session: Session) => void;
  onActivityClick: (activity: Activity) => void;
  onToggleReminderCompletion?: (activity: Activity, nextCompleted: boolean) => void;
  completingReminderId?: string | null;
  touchHandlers: {
    handleTouchStart: (e: React.TouchEvent) => void;
    handleTouchMove: (e: React.TouchEvent) => void;
    handleTouchEnd: (e: React.TouchEvent) => void;
    handleTouchCancel: () => void;
  };
}

export const CalendarDayView = memo<CalendarDayViewProps>(({
  currentDate,
  getEventsForDate,
  showSessions,
  showReminders,
  leadsMap,
  projectsMap,
  onSessionClick,
  onActivityClick,
  onToggleReminderCompletion,
  completingReminderId,
  touchHandlers
}) => {
  const { t } = useTranslation(['pages', 'forms']);
  const { formatTime: formatOrgTime } = useOrganizationTimezone();
  const { sessions, activities } = getEventsForDate(currentDate);
  const isDayToday = isToday(currentDate);

  // Sort sessions and activities by time
  const sortedSessions = showSessions ? [...sessions].sort((a, b) => a.session_time.localeCompare(b.session_time)) : [];
  const sortedActivities = showReminders ? [...activities].sort((a, b) => {
    if (!a.reminder_time && !b.reminder_time) return 0;
    if (!a.reminder_time) return 1;
    if (!b.reminder_time) return -1;
    return a.reminder_time.localeCompare(b.reminder_time);
  }) : [];

  return (
    <div 
      className="space-y-6"
      onTouchStart={touchHandlers.handleTouchStart}
      onTouchMove={touchHandlers.handleTouchMove}
      onTouchEnd={touchHandlers.handleTouchEnd}
      onTouchCancel={touchHandlers.handleTouchCancel}
    >
      {/* Today badge only - date is shown in navigation */}
      {isDayToday && (
        <div className="text-center pb-4">
          <Badge variant="secondary">
            {t('calendar.labels.today')}
          </Badge>
        </div>
      )}

      {/* Sessions section */}
      {showSessions && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            {t('calendar.sections.sessions')} ({sortedSessions.length})
          </h3>
          
          {sortedSessions.length === 0 ? (
            <div className="text-muted-foreground text-center py-8 bg-card rounded-lg border border-dashed">
              {t('calendar.emptyStates.noSessions')}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedSessions.map((session) => {
                const leadName = leadsMap[session.lead_id]?.name || t('calendar.labels.lead');
                const projectName = session.project_id ? projectsMap[session.project_id]?.name : undefined;
                
                return (
                  <Tooltip key={session.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onSessionClick(session)}
                        className="w-full p-4 bg-card rounded-lg border border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-primary mb-1">
                              {projectName || t('calendar.labels.session')}
                            </div>
                            <div className="text-sm text-muted-foreground mb-2">
                              {leadName}
                            </div>
                            <div className="text-sm font-medium">
                              {formatOrgTime(session.session_time)}
                            </div>
                            {session.notes && (
                              <div className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                {session.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">{t('calendar.tooltips.clickSession')}</div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Activities/Reminders section */}
      {showReminders && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted-foreground/60"></div>
            {t('calendar.sections.reminders')} ({sortedActivities.length})
          </h3>
          
          {sortedActivities.length === 0 ? (
            <div className="text-muted-foreground text-center py-8 bg-card rounded-lg border border-dashed">
              {t('calendar.emptyStates.noReminders')}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedActivities.map((activity) => {
                const leadName = leadsMap[activity.lead_id]?.name || t('calendar.labels.lead');
                const projectName = activity.project_id ? projectsMap[activity.project_id]?.name : undefined;
                const timeText = activity.reminder_time ? formatOrgTime(activity.reminder_time) : t('calendar.labels.allDay');
                const shouldShowTypeBadge = !activity.completed && activity.type && activity.type.toLowerCase() !== 'reminder';
                const completionLabel = activity.completed
                  ? t('forms:reminders.markIncomplete', { defaultValue: 'Mark as not done' })
                  : t('forms:reminders.markComplete', { defaultValue: 'Mark as done' });
                const isToggling = completingReminderId === activity.id;
                
                return (
                  <Tooltip key={activity.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onActivityClick(activity)}
                        className={`w-full p-4 bg-card rounded-lg border hover:bg-accent/50 transition-colors text-left ${
                          activity.completed ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium mb-1 ${activity.completed ? 'line-through' : ''}`}>
                              {activity.content}
                            </div>
                            <div className="text-sm text-muted-foreground mb-2">
                              {projectName ? `${t('calendar.labels.project')}: ${projectName}` : `${t('calendar.labels.lead')}: ${leadName}`}
                            </div>
                            <div className="text-sm font-medium">
                              {timeText}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {onToggleReminderCompletion && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (isToggling) return;
                                  onToggleReminderCompletion(activity, !activity.completed);
                                }}
                                disabled={isToggling}
                                aria-pressed={activity.completed}
                                aria-label={completionLabel}
                                className={cn(
                                  "flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60",
                                  activity.completed
                                    ? "text-emerald-600"
                                    : "text-slate-500 hover:text-primary"
                                )}
                              >
                                {isToggling ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : activity.completed ? (
                                  <CheckCircle2 className="h-5 w-5" />
                                ) : (
                                  <Circle className="h-5 w-5" />
                                )}
                              </button>
                            )}
                            {(activity.completed || shouldShowTypeBadge) && (
                              <Badge
                                variant={activity.completed ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {activity.completed ? t('calendar.labels.completed') : activity.type}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">
                        {activity.project_id ? t('calendar.tooltips.clickProject') : t('calendar.tooltips.clickLead')}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state when both are disabled */}
      {!showSessions && !showReminders && (
        <div className="text-center py-12 text-muted-foreground">
          <div className="text-lg font-medium mb-2">{t('calendar.emptyStates.noEvents')}</div>
          <div className="text-sm">{t('calendar.emptyStates.enableFilters')}</div>
        </div>
      )}
    </div>
  );
});

CalendarDayView.displayName = "CalendarDayView";
