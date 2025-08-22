import { ChevronRight, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatTime, cn } from "@/lib/utils";
import { getRelativeDate, isOverdueSession, getDateDisplayClasses } from "@/lib/dateUtils";
import SessionStatusBadge from "@/components/SessionStatusBadge";

type SessionStatus = 'planned' | 'completed' | 'in_post_processing' | 'delivered' | 'cancelled';

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes?: string;
  status: SessionStatus;
  project_id?: string;
  leads?: {
    name: string;
  };
  projects?: {
    name: string;
    project_types?: {
      name: string;
    };
  };
}

interface CompactSessionBannerProps {
  session: Session;
  onClick?: () => void;
}

const CompactSessionBanner = ({ 
  session, 
  onClick
}: CompactSessionBannerProps) => {
  
  const getSessionName = () => {
    if (session.projects?.project_types?.name) {
      return `${session.projects.project_types.name} Session`;
    }
    return "Session";
  };

  const relativeDate = getRelativeDate(session.session_date);
  const isOverdue = isOverdueSession(session.session_date, session.status);
  const dateClasses = getDateDisplayClasses(session.session_date);

  return (
    <Card 
      className={cn(
        "shadow-sm border bg-card transition-shadow hover:shadow-md cursor-pointer",
        isOverdue && "border-orange-200 bg-orange-50/30"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 min-h-[56px]">
          {/* Session Name - Always visible */}
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <h3 className="font-semibold text-base text-foreground truncate">
              {getSessionName()}
            </h3>
            {isOverdue && (
              <div className="flex items-center gap-1 text-orange-600">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span className="text-xs font-medium hidden sm:inline">Past due</span>
              </div>
            )}
          </div>

          {/* Status Badge - Hidden on mobile */}
          <div className="hidden sm:flex flex-shrink-0">
            <SessionStatusBadge
              sessionId={session.id}
              currentStatus={session.status}
              editable={false}
              onStatusChange={() => {}}
            />
          </div>

          {/* Date and Time */}
          <div className="flex items-center gap-2 text-sm flex-shrink-0">
            <span className={cn("font-medium", dateClasses)}>
              {relativeDate}
            </span>
            <span className="text-muted-foreground">
              {formatTime(session.session_time)}
            </span>
          </div>

          {/* Chevron */}
          {onClick && (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
        </div>

        {/* Mobile: Status Badge and Warning Row */}
        <div className="sm:hidden mt-2 flex items-center justify-between">
          <SessionStatusBadge
            sessionId={session.id}
            currentStatus={session.status}
            editable={false}
            onStatusChange={() => {}}
          />
          {isOverdue && (
            <div className="flex items-center gap-1 text-orange-600">
              <AlertTriangle className="h-3 w-3" />
              <span className="text-xs font-medium">This session is past due and needs attention</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CompactSessionBanner;