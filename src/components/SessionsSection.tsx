import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar } from "lucide-react";
import DeadSimpleSessionBanner from "./DeadSimpleSessionBanner";
import EditSessionDialog from "./EditSessionDialog";
import SessionSheetView from "./SessionSheetView";
import { NewSessionDialogForProject } from "./NewSessionDialogForProject";
import { useNavigate, useLocation } from "react-router-dom";
import { sortSessionsByLifecycle } from "@/lib/sessionSorting";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DeadSimpleSession } from "./DeadSimpleSessionBanner";
interface SessionsSectionProps {
  sessions: DeadSimpleSession[];
  loading: boolean;
  leadId: string;
  projectId: string;
  leadName: string;
  projectName: string;
  onSessionUpdated: () => void;
  onDeleteSession: (sessionId: string) => void;
}
export function SessionsSection({
  sessions,
  loading,
  leadId,
  projectId,
  leadName,
  projectName,
  onSessionUpdated,
  onDeleteSession
}: SessionsSectionProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionSheetOpen, setIsSessionSheetOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useFormsTranslation();
  const isMobile = useIsMobile();
  const handleSessionUpdated = () => {
    onSessionUpdated();
    setEditingSessionId(null);
  };

  const handleSessionSheetUpdated = () => {
    onSessionUpdated(); // Propagate updates from session sheet to parent
  };

  const handleSessionSheetOpenChange = (open: boolean) => {
    setIsSessionSheetOpen(open);
    if (!open) {
      // When sheet closes, refresh the sessions to reflect any updates
      onSessionUpdated();
    }
  };

  const handleSessionClick = (sessionId: string) => {
    if (isMobile) {
      navigate(`/sessions/${sessionId}`);
      return;
    }
    setSelectedSessionId(sessionId);
    setIsSessionSheetOpen(true);
  };

  const handleViewFullSessionDetails = () => {
    if (selectedSessionId) {
      const currentPath = `${location.pathname}${location.search}${location.hash}`;
      navigate(`/sessions/${selectedSessionId}`, { state: { from: currentPath } });
    }
  };

  const handleNavigateToLead = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

  const handleNavigateToProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };
  if (loading) {
    return <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {t('sessions_form.title')}
            <div className="w-6 h-6 bg-muted animate-pulse rounded" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="w-full h-4 bg-muted animate-pulse rounded" />
            <div className="w-3/4 h-4 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>;
  }
  return <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-xl font-semibold">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t('sessions_form.title')}
            </div>
            <NewSessionDialogForProject leadId={leadId} leadName={leadName} projectName={projectName} projectId={projectId} onSessionScheduled={onSessionUpdated} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length > 0 ? <div className="space-y-3">
              {!loading && <p className="text-sm text-muted-foreground mb-3">
                  {sessions.length === 1 
                    ? t('sessions_form.project_sessions_count', { count: sessions.length })
                    : t('sessions_form.project_sessions_count_plural', { count: sessions.length })
                  }
                </p>}
              {sortSessionsByLifecycle(sessions).map(session => (
                <DeadSimpleSessionBanner
                  key={session.id}
                  session={session}
                  onClick={() => handleSessionClick(session.id)}
                />
              ))}
            </div> : <div className="text-center py-4">
              <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">{t('sessions_form.no_sessions')}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('sessions_form.add_sessions_hint')}
              </p>
            </div>}
        </CardContent>
      </Card>

      {/* Edit Session Dialog */}
      {editingSessionId && (() => {
        const session = sessions.find(s => s.id === editingSessionId);
        return session ? (
           <EditSessionDialog 
             sessionId={session.id} 
             leadId={session.lead_id} 
             currentDate={session.session_date} 
             currentTime={session.session_time} 
             currentNotes={session.notes} 
             currentProjectId={session.project_id} 
             currentSessionName={session.session_name}
             leadName={leadName} 
             open={!!editingSessionId} 
             onOpenChange={open => {
               if (!open) {
                 setEditingSessionId(null);
               }
             }} 
             onSessionUpdated={handleSessionUpdated} 
           />
        ) : null;
      })()}

      {/* Session Sheet View */}
      <SessionSheetView
        sessionId={selectedSessionId || ''}
        isOpen={isSessionSheetOpen}
        onOpenChange={handleSessionSheetOpenChange}
        onViewFullDetails={handleViewFullSessionDetails}
        onNavigateToLead={handleNavigateToLead}
        onNavigateToProject={handleNavigateToProject}
        onSessionUpdated={handleSessionSheetUpdated}
      />
    </>;
}
