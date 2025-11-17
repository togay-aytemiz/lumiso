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
import { Button } from "@/components/ui/button";
import { EmptyStateInfoSheet } from "@/components/empty-states/EmptyStateInfoSheet";
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
  const [showSessionInfo, setShowSessionInfo] = useState(false);
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
  const sessionInfoSectionsRaw = t("sessions_form.emptyState.sections", {
    returnObjects: true,
    defaultValue: []
  });
  const sessionInfoSections = Array.isArray(sessionInfoSectionsRaw)
    ? (sessionInfoSectionsRaw as { title: string; description: string }[])
    : [];
  const hasSessions = sessions.length > 0;
  const renderNewSessionButton = () => (
    <NewSessionDialogForProject
      leadId={leadId}
      leadName={leadName}
      projectName={projectName}
      projectId={projectId}
      onSessionScheduled={onSessionUpdated}
    />
  );

  return (
    <>
      <SessionListCard
        title={t("sessions_form.title")}
        icon={Calendar}
        sessions={sessions}
        loading={loading}
        headerAction={hasSessions ? renderNewSessionButton() : undefined}
        summary={summary ?? undefined}
        emptyState={{
          icon: Calendar,
          title: t("sessions_form.no_sessions"),
          helperAction: (
            <Button
              variant="link"
              size="sm"
              className="h-auto w-full px-0 text-sm text-amber-700 underline underline-offset-4 decoration-amber-400 hover:text-amber-900 sm:w-auto"
              onClick={() => setShowSessionInfo(true)}
            >
              <span className="whitespace-normal leading-snug text-center">
                {t("sessions_form.emptyState.learnMore")}
              </span>
            </Button>
          ),
          action: !hasSessions ? renderNewSessionButton() : undefined
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

      <EmptyStateInfoSheet
        open={showSessionInfo}
        onOpenChange={setShowSessionInfo}
        title={t("sessions_form.emptyState.sheetTitle")}
        description={t("sessions_form.emptyState.sheetDescription")}
        sections={sessionInfoSections}
      />
    </>
  );
}
