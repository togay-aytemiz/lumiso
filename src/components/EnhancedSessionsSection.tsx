import { useState } from "react";
import { AlertTriangle, Clock, CheckCircle, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

interface EnhancedSessionsSectionProps {
  sessions: Session[];
  loading?: boolean;
  onSessionClick: (sessionId: string) => void;
}

const EnhancedSessionsSection = ({ sessions, loading, onSessionClick }: EnhancedSessionsSectionProps) => {
  if (loading) {
    return (
      <div className="w-full bg-background/95 backdrop-blur border rounded-lg p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return null;
  }

  // Sort sessions chronologically (past to future)
  const sortedSessions = [...sessions].sort((a, b) => {
    const dateA = new Date(`${a.session_date}T${a.session_time || '00:00'}`);
    const dateB = new Date(`${b.session_date}T${b.session_time || '00:00'}`);
    return dateA.getTime() - dateB.getTime();
  });

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
        color: "bg-orange-500",
        textColor: "text-orange-700",
        bgColor: "bg-orange-50",
        borderColor: "border-orange-200"
      };
    }
    
    if (relativeDate === "Today") {
      return {
        label: "Today",
        color: "bg-blue-500",
        textColor: "text-blue-700",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200"
      };
    }
    
    if (relativeDate === "Tomorrow") {
      return {
        label: "Tomorrow",
        color: "bg-green-500",
        textColor: "text-green-700",
        bgColor: "bg-green-50",
        borderColor: "border-green-200"
      };
    }
    
    return {
      label: null,
      color: null,
      textColor: "text-muted-foreground",
      bgColor: "bg-background",
      borderColor: "border-border"
    };
  };

  return (
    <div className="w-full bg-background/95 backdrop-blur border rounded-lg p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Sessions</h3>
        <Badge variant="secondary" className="ml-auto">
          {sessions.length}
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sortedSessions.map((session) => {
          const timeIndicator = getTimeIndicator(session);
          const isOverdue = isOverdueSession(session.session_date, session.status);
          
          return (
            <Card
              key={session.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md relative",
                timeIndicator.bgColor,
                timeIndicator.borderColor,
                "hover:scale-[1.02]"
              )}
              onClick={() => onSessionClick(session.id)}
            >
              <CardContent className="p-4">
                {/* Time indicator dot */}
                {timeIndicator.color && (
                  <div className={cn("absolute top-2 right-2 w-2 h-2 rounded-full", timeIndicator.color)} />
                )}
                
                {/* Main content - vertically centered */}
                <div className="flex flex-col justify-center min-h-[4rem] space-y-2">
                  {/* Session name and overdue warning */}
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm truncate">
                      {getSessionName(session)}
                    </h4>
                    {isOverdue && (
                      <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    )}
                  </div>
                  
                  {/* Project name if available */}
                  {session.projects?.name && (
                    <p className="text-xs text-muted-foreground truncate">
                      {session.projects.name}
                    </p>
                  )}
                  
                  {/* Date and time */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className={cn("text-xs font-medium", timeIndicator.textColor)}>
                        {timeIndicator.label || getRelativeDate(session.session_date)}
                      </span>
                      {session.session_time && (
                        <span className="text-xs text-muted-foreground">
                          • {formatTime(session.session_time)}
                        </span>
                      )}
                    </div>
                    
                    {/* Status indicator */}
                    <div className="flex items-center">
                      {session.status === 'completed' && (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      )}
                      {session.status === 'planned' && !isOverdue && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      )}
                      {session.status === 'cancelled' && (
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                      )}
                    </div>
                  </div>
                  
                  {/* Warning text for overdue sessions */}
                  {isOverdue && (
                    <p className="text-xs text-orange-600 font-medium">
                      Needs attention
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default EnhancedSessionsSection;