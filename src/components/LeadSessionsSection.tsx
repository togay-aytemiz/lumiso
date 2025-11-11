import { type ReactNode, useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DeadSimpleSession } from "@/components/DeadSimpleSessionBanner";
import SessionListCard from "@/components/SessionListCard";
import SessionSheetView from "@/components/SessionSheetView";
import EditSessionDialog from "@/components/EditSessionDialog";
import type { SessionPlanningStepId } from "@/features/session-planning";

interface LeadSessionsSectionProps {
  sessions: DeadSimpleSession[];
  loading: boolean;
  leadId: string;
  leadName: string;
  onSessionsChanged: () => void;
  headerAction?: ReactNode;
}

export function LeadSessionsSection({
  sessions,
  loading,
  leadId,
  leadName,
  onSessionsChanged,
  headerAction
}: LeadSessionsSectionProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionSheetOpen, setIsSessionSheetOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingStartStep, setEditingStartStep] = useState<SessionPlanningStepId | undefined>(undefined);
  const navigate = useNavigate();
  const location = useLocation();
  const { t: tForms } = useFormsTranslation();
  const { t: tPages } = useTranslation("pages");
  const isMobile = useIsMobile();

  const summary = useMemo(() => {
    if (loading || sessions.length === 0) {
      return null;
    }
    return tPages("leadDetail.header.sessions.count", { count: sessions.length });
  }, [loading, sessions.length, tPages]);

  const handleSessionClick = (sessionId: string) => {
    if (isMobile) {
      const currentPath = `${location.pathname}${location.search}${location.hash}`;
      navigate(`/sessions/${sessionId}`, { state: { from: currentPath } });
      return;
    }
    setSelectedSessionId(sessionId);
    setIsSessionSheetOpen(true);
  };

  const handleSessionSheetOpenChange = (open: boolean) => {
    setIsSessionSheetOpen(open);
    if (!open) {
      onSessionsChanged();
    }
  };

  const handleSessionSheetUpdated = () => {
    onSessionsChanged();
  };

  const handleConnectProject = (sessionId: string) => {
    setEditingSessionId(sessionId);
    setEditingStartStep("project");
  };

  const handleViewFullDetails = () => {
    if (!selectedSessionId) return;
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    navigate(`/sessions/${selectedSessionId}`, { state: { from: currentPath } });
  };

  const handleNavigateToLead = () => {
    navigate(`/leads/${leadId}`);
  };

  const handleNavigateToProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  return (
    <>
      <SessionListCard
        title={tForms("sessions_form.title")}
        icon={Calendar}
        sessions={sessions}
        loading={loading}
        summary={summary ?? undefined}
        headerAction={headerAction}
        emptyState={{
          icon: Calendar,
          title: tForms("sessions_form.no_sessions"),
          description: tForms("sessions_form.add_sessions_hint")
        }}
        onSessionClick={handleSessionClick}
        onConnectProject={handleConnectProject}
      />

      <SessionSheetView
        sessionId={selectedSessionId || ""}
        isOpen={isSessionSheetOpen}
        onOpenChange={handleSessionSheetOpenChange}
        onViewFullDetails={handleViewFullDetails}
        onNavigateToLead={handleNavigateToLead}
        onNavigateToProject={handleNavigateToProject}
        onSessionUpdated={handleSessionSheetUpdated}
      />

      {editingSessionId ? (() => {
        const session = sessions.find((s) => s.id === editingSessionId);
        if (!session) {
          return null;
        }

        return (
          <EditSessionDialog
            sessionId={session.id}
            leadId={session.lead_id || leadId}
            currentDate={session.session_date}
            currentTime={session.session_time || ""}
            currentNotes={session.notes || ""}
            currentProjectId={session.project_id}
            currentSessionName={session.session_name ?? undefined}
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
              onSessionsChanged();
              setEditingSessionId(null);
              setEditingStartStep(undefined);
            }}
          />
        );
      })() : null}
    </>
  );
}

export default LeadSessionsSection;
