import { useState } from "react";
import { AlertTriangle, Clock, CheckCircle, ChevronRight } from "lucide-react";
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
      <div className="w-full bg-blue-50/50 border border-blue-100 rounded-lg p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
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
        leftBorder: "border-l-4 border-l-orange-500",
        textColor: "text-orange-700",
        labelBg: "bg-orange-100 text-orange-800"
      };
    }
    
    if (relativeDate === "Today") {
      return {
        label: "Today",
        leftBorder: "border-l-4 border-l-blue-500",
        textColor: "text-blue-700",
        labelBg: "bg-blue-100 text-blue-800"
      };
    }
    
    if (relativeDate === "Tomorrow") {
      return {
        label: "Tomorrow",
        leftBorder: "border-l-4 border-l-green-500",
        textColor: "text-green-700",
        labelBg: "bg-green-100 text-green-800"
      };
    }
    
    return {
      label: null,
      leftBorder: "border-l-4 border-l-gray-200",
      textColor: "text-muted-foreground",
      labelBg: null
    };
  };

  return (
    <div className="w-full bg-blue-50/50 border border-blue-100 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Sessions</h3>
        <Badge variant="secondary">
          {sessions.length}
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {sortedSessions.map((session) => {
          const timeIndicator = getTimeIndicator(session);
          const isOverdue = isOverdueSession(session.session_date, session.status);
          
          return (
            <Card
              key={session.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md bg-white",
                timeIndicator.leftBorder,
                "hover:scale-[1.02]"
              )}
              onClick={() => onSessionClick(session.id)}
            >
              <CardContent className="p-4">
                <div className="flex flex-col space-y-3">
                  {/* Session name and time label */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm truncate">
                        {getSessionName(session)}
                      </h4>
                      {timeIndicator.label && (
                        <Badge variant="secondary" className={cn("text-xs px-2 py-0", timeIndicator.labelBg)}>
                          {timeIndicator.label}
                        </Badge>
                      )}
                      {isOverdue && (
                        <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                  
                  {/* Project name if available */}
                  {session.projects?.name && (
                    <p className="text-xs text-muted-foreground truncate">
                      {session.projects.name}
                    </p>
                  )}
                  
                  {/* Date and time */}
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      {!timeIndicator.label && getRelativeDate(session.session_date)}
                      {session.session_time && ` • ${formatTime(session.session_time)}`}
                    </span>
                  </div>
                  
                  {/* Status badge */}
                  <div className="flex items-center">
                    <SessionStatusBadge
                      sessionId={session.id}
                      currentStatus={session.status as any}
                      editable={false}
                      onStatusChange={() => {}}
                      size="sm"
                    />
                  </div>
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