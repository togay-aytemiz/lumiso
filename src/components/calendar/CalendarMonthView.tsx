import { memo, KeyboardEvent as ReactKeyboardEvent } from "react";
import { format, eachDayOfInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday } from "date-fns";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { getUserLocale, getDateFnsLocale, cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useOrganizationTimezone } from "@/hooks/useOrganizationTimezone";

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  status: string;
  session_name?: string | null;
  notes?: string;
  lead_id: string;
  project_id?: string | null;
  location?: string | null;
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

interface CalendarMonthViewProps {
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
  onDayClick?: (date: Date) => void;
  isMobile?: boolean;
  touchHandlers: {
    handleTouchStart: (e: React.TouchEvent) => void;
    handleTouchMove: (e: React.TouchEvent) => void;
    handleTouchEnd: (e: React.TouchEvent) => void;
    handleTouchCancel: () => void;
  };
  className?: string;
  fullHeight?: boolean;
}

export const CalendarMonthView = memo<CalendarMonthViewProps>(({
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
  onDayClick,
  isMobile,
  touchHandlers,
  className,
  fullHeight
}) => {
  const { t } = useTranslation(['pages', 'forms']);
  const userLocale = getUserLocale();
  const dateFnsLocale = getDateFnsLocale();
  const { formatTime: formatOrgTime } = useOrganizationTimezone();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: userLocale === 'en-US' ? 0 : 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: userLocale === 'en-US' ? 0 : 1 });
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(calendarStart, i);
    return format(day, "EEE", { locale: dateFnsLocale });
  });
  const weekCount = Math.max(1, Math.ceil(days.length / 7));
  const rootClassName = cn(
    "bg-card rounded-xl border border-border shadow-sm",
    fullHeight && "h-full flex flex-col overflow-hidden",
    className
  );
  const gridClassName = cn(
    "grid grid-cols-7 gap-px bg-border",
    fullHeight && "flex-1"
  );
  const gridStyle = fullHeight ? { gridTemplateRows: `repeat(${weekCount}, minmax(0, 1fr))` } : undefined;

  const handleDayKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    day: Date
  ) => {
    if (!onDayClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onDayClick(day);
    }
  };

  return (
    <div 
      className={rootClassName}
      onTouchStart={touchHandlers.handleTouchStart}
      onTouchMove={touchHandlers.handleTouchMove}
      onTouchEnd={touchHandlers.handleTouchEnd}
      onTouchCancel={touchHandlers.handleTouchCancel}
    >
      {/* Week header */}
      <div className="grid grid-cols-7 border-b border-border">
        {weekDays.map((day, index) => (
          <div key={index} className="p-2 md:p-3 text-xs md:text-sm font-medium text-muted-foreground text-center">
            <span className="md:hidden">{day.charAt(0)}</span>
            <span className="hidden md:inline">{day}</span>
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className={gridClassName} style={gridStyle}>
        {days.map((day, index) => {
          const { sessions: daySessions, activities: dayActivities } = getEventsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isDayToday = isToday(day);
          
          return (
            <div
              key={index}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (onDayClick) {
                  onDayClick(day);
                }
              }}
              onKeyDown={(event) => handleDayKeyDown(event, day)}
              className={`
                min-h-16 md:min-h-24 p-1 md:p-2 bg-card transition-colors relative
                ${!isCurrentMonth ? "text-muted-foreground" : ""}
                ${isMobile ? "min-h-11 cursor-pointer" : ""}
              `}
            >
              {/* Day number in top right corner */}
              <div className="absolute top-1 right-1 md:top-2 md:right-2">
                <span
                  className={`flex h-5 w-5 md:h-7 md:w-7 items-center justify-center rounded-full text-[11px] md:text-sm font-medium transition-colors
                    ${isDayToday ? "bg-primary text-primary-foreground shadow-sm" : ""}
                  `}
                >
                  {format(day, "d")}
                </span>
              </div>
              
              {/* Events - with top margin to avoid overlap with day number */}
              <div className="space-y-0.5 mt-6 md:mt-8">
                {(() => {
                  const sessionsList = showSessions ? daySessions : [];
                  const remindersList = showReminders ? dayActivities : [];

                  // Defensive sorting
                  const sortedSessions = [...sessionsList].sort((a, b) => a.session_time.localeCompare(b.session_time));
                  const sortedActivities = [...remindersList].sort((a, b) => {
                    if (!a.reminder_time && !b.reminder_time) return 0;
                    if (!a.reminder_time) return 1;
                    if (!b.reminder_time) return -1;
                    return a.reminder_time.localeCompare(b.reminder_time);
                  });

                  const combined = [
                    ...sortedSessions.map((s) => ({ kind: 'session' as const, item: s })),
                    ...sortedActivities.map((a) => ({ kind: 'activity' as const, item: a })),
                  ];

                  // Mobile/Tablet: max 2 dots, desktop: max 3 items
                  const maxVisible = 2;
                  const shown = combined.slice(0, maxVisible);
                  const extras = combined.slice(maxVisible);

                  const sessionExtras = extras
                    .filter((e) => e.kind === 'session')
                    .map((e) => e.item as Session)
                    .sort((a, b) => a.session_time.localeCompare(b.session_time));
                  const activityExtras = extras
                    .filter((e) => e.kind === 'activity')
                    .map((e) => e.item as Activity)
                    .sort((a, b) => {
                      if (!a.reminder_time && !b.reminder_time) return 0;
                      if (!a.reminder_time) return 1;
                      if (!b.reminder_time) return -1;
                      return a.reminder_time!.localeCompare(b.reminder_time!);
                    });

                  return (
                    <>
                      {/* Mobile/Tablet: Show dots in bottom left, Desktop: Show items */}
                      <div className="md:hidden absolute bottom-1 left-1 flex items-center gap-1">
                        {shown.map((entry, idx) => (
                          <div
                            key={idx}
                            className={`w-2 h-2 rounded-full ${
                              entry.kind === 'session' ? 'bg-primary' : 'bg-muted-foreground/60'
                            }`}
                          />
                        ))}
                        {extras.length > 0 && (
                          <div className="text-xs text-muted-foreground">+{extras.length}</div>
                        )}
                      </div>
                      
                      {/* Desktop: Show full items */}
                      <div className="hidden md:block space-y-0.5">
                        {shown.map((entry) => {
                          if (entry.kind === 'session') {
                            const session = entry.item as Session;
                            const sessionTitle =
                              session.session_name?.trim() ||
                              projectsMap[session.project_id || ""]?.name ||
                              leadsMap[session.lead_id]?.name ||
                              t('calendar.labels.session');
                            const leadName = leadsMap[session.lead_id]?.name || t('calendar.labels.lead');
                            const projectName = session.project_id ? projectsMap[session.project_id]?.name : undefined;
                            const dateLabel = format(new Date(session.session_date), 'PPP', { locale: dateFnsLocale });
                            const timeLabel = formatOrgTime(session.session_time);
                            const line = `${timeLabel} ${leadName}${projectName ? " • " + projectName : ""}`;
                            const locationLabel = session.location || undefined;
                            return (
                              <Tooltip key={`s-${session.id}`}>
                                <TooltipTrigger asChild>
                                  <button
                                    className={`w-full text-left text-xs px-1.5 py-0.5 rounded truncate border hover:bg-primary/15 ${isDayToday ? 'bg-primary/15 border-primary/30' : 'bg-primary/10 border-primary/20'} text-primary`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSessionClick(session);
                                    }}
                                  >
                                    {line}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs space-y-2 text-left text-sm leading-snug">
                                  <div className="font-semibold text-foreground">
                                    {sessionTitle}
                                  </div>
                                  <div className="space-y-1 text-foreground">
                                    <p>{t('calendar.labels.lead')}: {leadName}</p>
                                    {projectName ? <p>{t('calendar.labels.project')}: {projectName}</p> : null}
                                    {locationLabel ? (
                                      <p>{t('calendar.labels.location', { defaultValue: 'Location' })}: {locationLabel}</p>
                                    ) : null}
                                  </div>
                                  <p className="font-medium text-foreground">
                                    {dateLabel} • {timeLabel}
                                  </p>
                                  {session.notes ? (
                                    <p className="text-muted-foreground">{session.notes}</p>
                                  ) : null}
                                </TooltipContent>
                              </Tooltip>
                            );
                          } else {
                            const activity = entry.item as Activity;
                            const leadName = leadsMap[activity.lead_id]?.name || t('calendar.labels.lead');
                            const projectName = activity.project_id ? projectsMap[activity.project_id!]?.name : undefined;
                            const timeText = activity.reminder_time ? formatOrgTime(activity.reminder_time) : t('calendar.labels.allDay');
                            const dateLabel = format(new Date(activity.reminder_date), 'PPP', { locale: dateFnsLocale });
                            const isToggling = completingReminderId === activity.id;
                            const toggleLabel = activity.completed
                              ? t('forms:reminders.markIncomplete', { defaultValue: 'Mark as not done' })
                              : t('forms:reminders.markComplete', { defaultValue: 'Mark as done' });
                            const line = `${timeText} ${leadName}${projectName ? " • " + projectName : ""}`;
                            return (
                              <Tooltip key={`a-${activity.id}`}>
                                <TooltipTrigger asChild>
                                  <button
                                    className={`w-full text-left text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground truncate border border-border hover:bg-accent hover:text-accent-foreground ${activity.completed ? "line-through opacity-60" : ""}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onActivityClick(activity);
                                    }}
                                  >
                                    {line}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs space-y-1 text-sm leading-snug">
                                  <p className="font-semibold text-foreground">{activity.content}</p>
                                  <p className="text-foreground">
                                    {t('calendar.labels.lead')}: {leadName}
                                  </p>
                                  {projectName ? (
                                    <p className="text-foreground">
                                      {t('calendar.labels.project')}: {projectName}
                                    </p>
                                  ) : null}
                                  <p className="text-foreground">
                                    {dateLabel} • {timeText}
                                  </p>
                                  {onToggleReminderCompletion ? (
                                    <div className="pt-2 mt-2 border-t border-slate-200">
                                      <button
                                        type="button"
                                        className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 underline underline-offset-4 disabled:opacity-60"
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          if (isToggling) return;
                                          onToggleReminderCompletion(activity, !activity.completed);
                                        }}
                                        disabled={isToggling}
                                      >
                                        {isToggling ? t('calendar.labels.updating', { defaultValue: 'Updating...' }) : toggleLabel}
                                      </button>
                                    </div>
                                  ) : null}
                                </TooltipContent>
                              </Tooltip>
                            );
                          }
                        })}
                      </div>

                      {/* Desktop overflow tooltip */}
                      {!isMobile && extras.length > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-xs text-muted-foreground cursor-help text-left">
                              {t('calendar.labels.moreEvents', { count: extras.length })}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {sessionExtras.length > 0 && (
                              <div className="mb-1">
                                <div className="text-xs font-medium mb-1">{t('calendar.sections.sessions')}</div>
                                <ul className="space-y-0.5">
                                  {sessionExtras.map((session) => {
                                    const leadName = leadsMap[session.lead_id]?.name || t('calendar.labels.lead');
                                    const projectName = session.project_id ? projectsMap[session.project_id]?.name : undefined;
                                    const timeText = formatOrgTime(session.session_time);
                                    return (
                                      <li key={session.id} className="text-xs">
                                        {timeText} {leadName}{projectName ? ` • ${projectName}` : ""}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                            {activityExtras.length > 0 && (
                              <div>
                                <div className="text-xs font-medium mb-1">{t('calendar.sections.reminders')}</div>
                                <ul className="space-y-0.5">
                                  {activityExtras.map((activity) => {
                                    const leadName = leadsMap[activity.lead_id]?.name || t('calendar.labels.lead');
                                    const projectName = activity.project_id ? projectsMap[activity.project_id!]?.name : undefined;
                                    const timeText = activity.reminder_time ? formatOrgTime(activity.reminder_time) : t('calendar.labels.allDay');
                                    return (
                                      <li key={activity.id} className="text-xs">
                                        {timeText} {leadName}{projectName ? ` • ${projectName}` : ""}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

CalendarMonthView.displayName = "CalendarMonthView";
