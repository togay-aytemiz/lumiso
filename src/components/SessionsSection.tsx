import { useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import SessionSheetView from "./SessionSheetView";
import { NewSessionDialogForProject } from "./NewSessionDialogForProject";
import { useNavigate, useLocation } from "react-router-dom";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DeadSimpleSession } from "./DeadSimpleSessionBanner";
import SessionListCard from "./SessionListCard";
import EditSessionDialog from "./EditSessionDialog";
import type { SessionPlanningStepId } from "@/features/session-planning";
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
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionSheetOpen, setIsSessionSheetOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingStartStep, setEditingStartStep] = useState<SessionPlanningStepId | undefined>(undefined);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useFormsTranslation();
  const isMobile = useIsMobile();
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

  const handleConnectProject = (sessionId: string) => {
    setEditingSessionId(sessionId);
    setEditingStartStep("project");
  };

  const editingSession = editingSessionId ? sessions.find((s) => s.id === editingSessionId) : null;

  const summary = useMemo(() => {
    if (loading || sessions.length === 0) {
      return null;
    }
    return sessions.length === 1
      ? t("sessions_form.project_sessions_count", { count: sessions.length })
      : t("sessions_form.project_sessions_count_plural", { count: sessions.length });
  }, [loading, sessions.length, t]);
  return (
    <>
      <SessionListCard
        title={t("sessions_form.title")}
        icon={Calendar}
        sessions={sessions}
        loading={loading}
        headerAction={
          <NewSessionDialogForProject
            leadId={leadId}
            leadName={leadName}
            projectName={projectName}
            projectId={projectId}
            onSessionScheduled={onSessionUpdated}
          />
        }
        summary={summary ?? undefined}
        emptyState={{
          icon: Calendar,
          title: t("sessions_form.no_sessions"),
          description: t("sessions_form.add_sessions_hint")
        }}
        onSessionClick={handleSessionClick}
        onConnectProject={handleConnectProject}
      />

      <SessionSheetView
        sessionId={selectedSessionId || ""}
        isOpen={isSessionSheetOpen}
        onOpenChange={handleSessionSheetOpenChange}
        onViewFullDetails={handleViewFullSessionDetails}
        onNavigateToLead={handleNavigateToLead}
        onNavigateToProject={handleNavigateToProject}
        onSessionUpdated={handleSessionSheetUpdated}
      />

      {editingSession ? (
        <EditSessionDialog
          sessionId={editingSession.id}
          leadId={editingSession.lead_id || leadId}
          currentDate={editingSession.session_date}
          currentTime={editingSession.session_time || ""}
          currentNotes={editingSession.notes || ""}
          currentProjectId={editingSession.project_id}
          currentSessionName={editingSession.session_name ?? undefined}
          leadName={leadName}
          open
          startStep={editingStartStep}
          onOpenChange={(open) => {
            if (!open) {
              setEditingSessionId(null);
              setEditingStartStep(undefined);
            }
          }}
          onSessionUpdated={() => {
            onSessionUpdated();
            setEditingSessionId(null);
            setEditingStartStep(undefined);
          }}
        />
      ) : null}
    </>
  );
}
