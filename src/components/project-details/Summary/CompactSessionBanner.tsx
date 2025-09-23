import { ChevronRight, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatTime, cn } from "@/lib/utils";
import { getRelativeDate, isOverdueSession, getDateDisplayClasses } from "@/lib/dateUtils";
import SessionStatusBadge from "@/components/SessionStatusBadge";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes?: string;
  status: string;
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
  const { t: tForms } = useFormsTranslation();
  
  const getSessionName = () => {
    if (session.projects?.project_types?.name) {
      return `${session.projects.project_types.name} ${tForms('sessionBanner.session')}`;
    }
    return tForms('sessionBanner.session');
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
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-4 p-4 min-h-[64px]">
          {/* Session Name */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h3 className="font-semibold text-base text-foreground truncate">
              {getSessionName()}
            </h3>
            {isOverdue && (
              <div className="flex items-center gap-1 text-orange-600">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span className="text-xs font-medium hidden md:inline">{tForms('sessionBanner.pastDue')}</span>
              </div>
            )}
          </div>

          {/* Status - Desktop only */}
          <div className="hidden md:block flex-shrink-0">
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
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
        
        {/* Mobile Status and Warning */}
        <div className="md:hidden px-4 pb-4 flex items-center justify-between">
          <SessionStatusBadge
            sessionId={session.id}
            currentStatus={session.status}
            editable={false}
            onStatusChange={() => {}}
          />
          {isOverdue && (
            <span className="text-xs text-orange-600 font-medium">{tForms('sessionBanner.needsAttention')}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CompactSessionBanner;