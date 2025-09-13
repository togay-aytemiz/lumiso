import { ActivityTimelineItem } from "./ActivityTimelineItem";
import ReminderCard from "@/components/ReminderCard";
import { format, isToday, isYesterday, parseISO } from "date-fns";

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
}

export function ActivityTimeline({ 
  activities, 
  projects = [], 
  leadName, 
  onToggleCompletion 
}: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No activities yet
      </div>
    );
  }

  const getProjectName = (projectId?: string) => {
    if (!projectId) return undefined;
    const project = projects.find(p => p.id === projectId);
    return project?.name;
  };

  const formatDayHeader = (date: string) => {
    const activityDate = parseISO(date);
    if (isToday(activityDate)) return "Today";
    if (isYesterday(activityDate)) return "Yesterday";
    return format(activityDate, "MMM d, yyyy");
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
  }, {} as Record<string, { date: string; activities: Activity[] }>);

  const sortedDays = Object.values(groupedActivities).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-6">
      {sortedDays.map((day, dayIndex) => (
        <div key={day.date} className="relative">
          {/* Day header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-primary" />
              {dayIndex < sortedDays.length - 1 && (
                <div className="w-px h-6 bg-muted-foreground/20 mt-1" />
              )}
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
              // Use ReminderCard for reminders with dates
              if (activity.type === 'reminder' && activity.reminder_date) {
                return (
                  <ReminderCard 
                    key={activity.id}
                    activity={activity} 
                    leadName={leadName} 
                    onToggleCompletion={onToggleCompletion} 
                    showCompletedBadge={false} 
                    hideStatusBadge={activity.completed}
                    projectName={getProjectName(activity.project_id)}
                  />
                );
              }
              
              // Use timeline item for notes and reminders without dates
              return (
                <ActivityTimelineItem
                  key={activity.id}
                  id={activity.id}
                  type={activity.type as 'note' | 'reminder'}
                  content={activity.content}
                  completed={activity.completed}
                  projectName={getProjectName(activity.project_id)}
                  onToggleCompletion={activity.type === 'reminder' ? onToggleCompletion : undefined}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}