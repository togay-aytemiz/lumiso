import { ActivityTimelineItem } from "./ActivityTimelineItem";
import ReminderCard from "@/components/ReminderCard";

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

  return (
    <div className="space-y-1">
      {activities.map((activity, index) => {
        // Use ReminderCard for reminders with dates
        if (activity.type === 'reminder' && activity.reminder_date) {
          return (
            <div key={activity.id} className="ml-5">
              <ReminderCard 
                activity={activity} 
                leadName={leadName} 
                onToggleCompletion={onToggleCompletion} 
                showCompletedBadge={false} 
                hideStatusBadge={activity.completed} 
              />
            </div>
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
  );
}