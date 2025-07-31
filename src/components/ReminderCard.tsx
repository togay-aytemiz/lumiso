import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";

interface ReminderActivity {
  id: string;
  content: string;
  reminder_date?: string;
  reminder_time?: string;
  type: string;
  lead_id: string;
  created_at: string;
  completed?: boolean;
}

interface ReminderCardProps {
  activity: ReminderActivity;
  leadName: string;
  onToggleCompletion: (activityId: string, completed: boolean) => void;
  onClick?: () => void;
  hideStatusBadge?: boolean;
  showCompletedBadge?: boolean;
}

const ReminderCard = ({ 
  activity, 
  leadName, 
  onToggleCompletion, 
  onClick,
  hideStatusBadge = false,
  showCompletedBadge = true
}: ReminderCardProps) => {
  const isOverdue = (reminderDate?: string) => {
    if (!reminderDate) return false;
    const today = new Date();
    const reminder = new Date(reminderDate);
    today.setHours(0, 0, 0, 0);
    reminder.setHours(0, 0, 0, 0);
    return reminder.getTime() < today.getTime();
  };

  const isToday = (reminderDate?: string) => {
    if (!reminderDate) return false;
    const today = new Date();
    const reminder = new Date(reminderDate);
    today.setHours(0, 0, 0, 0);
    reminder.setHours(0, 0, 0, 0);
    return reminder.getTime() === today.getTime();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    return new Date(`1970-01-01T${timeStr}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getVisualMarker = () => {
    if (activity.completed) {
      return (
        <div className="flex items-center gap-2">
          <div className="w-1 h-12 bg-emerald-500 rounded-full"></div>
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
            <CheckCircle className="h-4 w-4 text-white" />
          </div>
        </div>
      );
    } else if (isOverdue(activity.reminder_date)) {
      return <div className="w-1 h-12 bg-red-500 rounded-full"></div>;
    } else if (isToday(activity.reminder_date)) {
      return <div className="w-1 h-12 bg-gray-500 rounded-full"></div>;
    } else {
      return <div className="w-1 h-12 bg-gray-300 rounded-full"></div>;
    }
  };

  const getCardBackground = () => {
    if (activity.completed) {
      return 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800';
    }
    return 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-750';
  };

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border transition-all duration-200 ${onClick ? 'cursor-pointer' : ''} ${getCardBackground()}`}
      onClick={onClick}
    >
      {/* Visual Marker */}
      <div className="flex-shrink-0">
        {getVisualMarker()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Reminder Message */}
            <h3 className={`text-base font-medium text-slate-900 dark:text-slate-100 ${activity.completed ? 'opacity-60' : ''}`}>
              {activity.content}
            </h3>
            
            {/* Lead Name */}
            <p className={`text-sm text-slate-600 dark:text-slate-400 mt-1 ${activity.completed ? 'opacity-60' : ''}`}>
              Lead: {leadName}
            </p>
            
            {/* Date and Time */}
            {activity.reminder_date && (
              <p className={`text-sm text-slate-500 dark:text-slate-500 mt-1 ${activity.completed ? 'opacity-60' : ''}`}>
                {formatDate(activity.reminder_date)}
                {activity.reminder_time && ` – ${formatTime(activity.reminder_time)}`}
              </p>
            )}
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            {activity.completed && showCompletedBadge ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                Completed
              </Badge>
            ) : (
              <>
                {!hideStatusBadge && isOverdue(activity.reminder_date) && (
                  <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800">
                    Overdue
                  </Badge>
                )}
                {!hideStatusBadge && isToday(activity.reminder_date) && (
                  <Badge className="bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600">
                    Today
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Completion Toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleCompletion(activity.id, !activity.completed);
        }}
        className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600 hover:border-primary transition-colors flex-shrink-0"
      >
        {activity.completed ? (
          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
        )}
      </button>
    </div>
  );
};

export default ReminderCard;