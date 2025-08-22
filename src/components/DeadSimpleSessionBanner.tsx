import { AlertTriangle, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTime, cn } from "@/lib/utils";
import { getRelativeDate, isOverdueSession } from "@/lib/dateUtils";
import { SessionStatusBadge } from "@/components/SessionStatusBadge";

type SessionStatus = "planned" | "completed" | "cancelled" | "no_show" | "rescheduled" | "in_post_processing" | "delivered";

interface Session {
  id: string;
  session_date: string;
  session_time?: string;
  notes?: string;
  status: SessionStatus;
  project_id?: string;
  lead_id: string;
  projects?: {
    name: string;
    project_types?: {
      name: string;
    };
  };
}

interface DeadSimpleSessionBannerProps {
  session: Session;
  onClick: (sessionId: string) => void;
}

const DeadSimpleSessionBanner = ({ session, onClick }: DeadSimpleSessionBannerProps) => {
  const getSessionName = (session: Session): string => {
    if (session.projects?.project_types?.name) {
      return `${session.projects.project_types.name} Session`;
    }
    return "Session";
  };

  const getTimeIndicator = (session: Session) => {
    const relativeDate = getRelativeDate(session.session_date);
    const isOverdue = isOverdueSession(session.session_date, session.status);
    
    if (isOverdue) {
      return {
        label: "Past Due",
        leftBorder: "border-l-4 border-l-orange-500",
        labelBg: "bg-orange-100 text-orange-800"
      };
    }
    
    if (relativeDate === "Today") {
      return {
        label: "Today",
        leftBorder: "border-l-4 border-l-blue-500",
        labelBg: "bg-blue-100 text-blue-800"
      };
    }
    
    if (relativeDate === "Tomorrow") {
      return {
        label: "Tomorrow",
        leftBorder: "border-l-4 border-l-green-500",
        labelBg: "bg-green-100 text-green-800"
      };
    }
    
    return {
      label: null,
      leftBorder: "border-l-4 border-l-gray-200",
      labelBg: null
    };
  };

  const timeIndicator = getTimeIndicator(session);
  const isOverdue = isOverdueSession(session.session_date, session.status);

  return (
    <div
      className={cn(
        "w-full bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors",
        timeIndicator.leftBorder
      )}
      onClick={() => onClick(session.id)}
    >
      <div className="flex items-center justify-between w-full">
        {/* Left: Date */}
        <div className="text-sm font-medium text-gray-900 min-w-0 flex-shrink-0">
          {getRelativeDate(session.session_date)}
          {session.session_time && (
            <>
              <Clock className="inline h-3 w-3 ml-2 mr-1" />
              {formatTime(session.session_time)}
            </>
          )}
        </div>

        {/* Middle: Session name and project */}
        <div className="flex-1 mx-4 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {getSessionName(session)}
            </span>
            {timeIndicator.label && (
              <Badge variant="secondary" className={cn("text-xs px-2 py-1", timeIndicator.labelBg)}>
                {timeIndicator.label}
              </Badge>
            )}
            {isOverdue && (
              <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
            )}
          </div>
          {session.projects?.name && (
            <div className="text-xs text-gray-500 truncate">
              {session.projects.name}
            </div>
          )}
        </div>

        {/* Right: Status and arrow */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <SessionStatusBadge
            sessionId={session.id}
            currentStatus={session.status as any}
            editable={false}
            onStatusChange={() => {}}
            size="sm"
          />
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </div>
      </div>
    </div>
  );
};

export default DeadSimpleSessionBanner;