import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import DeadSimpleSessionBanner from "@/components/DeadSimpleSessionBanner";

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
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg"></div>
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

  return (
    <div className="w-full bg-blue-50/50 border border-blue-100 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Sessions</h3>
        <Badge variant="secondary">
          {sessions.length}
        </Badge>
      </div>
      
      <div className="space-y-3">
        {sortedSessions.map((session) => (
          <DeadSimpleSessionBanner
            key={session.id}
            session={session}
            onClick={onSessionClick}
          />
        ))}
      </div>
    </div>
  );
};

export default EnhancedSessionsSection;