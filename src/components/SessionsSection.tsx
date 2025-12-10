import { useMemo, useState } from "react";
import { Calendar, Info } from "lucide-react";
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
import { Trans, useTranslation } from "react-i18next";
interface SessionsSectionProps {
  sessions: DeadSimpleSession[];
  loading: boolean;
  leadId: string;
  projectId: string;
  leadName: string;
  projectName: string;
  onSessionUpdated: () => void;
  onDeleteSession: (sessionId: string) => void;
  sessionPlanningLocked?: boolean;
  onSessionPlanningLocked?: () => void;
  sessionPlanningLockTooltip?: string;
  unassignedSessionsCount?: number;
  onUnassignedSessionsClick?: () => void;
  titleOverride?: string;
}
export function SessionsSection({
  sessions,
  loading,
  leadId,
  projectId,
  leadName,
  projectName,
  onSessionUpdated,
  onDeleteSession,
  sessionPlanningLocked = false,
  onSessionPlanningLocked,
  sessionPlanningLockTooltip,
  unassignedSessionsCount = 0,
  onUnassignedSessionsClick,
  titleOverride
}: SessionsSectionProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionSheetOpen, setIsSessionSheetOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingStartStep, setEditingStartStep] = useState<SessionPlanningStepId | undefined>(undefined);
  const [showSessionInfo, setShowSessionInfo] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useFormsTranslation();
  const { t: tPages } = useTranslation("pages");
  const isMobile = useIsMobile();
  const shouldOpenFullPage = useMemo(() => {
    if (isMobile) {
      return true;
    }
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia("(pointer: coarse)").matches;
  }, [isMobile]);

  const navigateToSessionPage = (sessionId: string) => {
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    navigate(`/sessions/${sessionId}`, { state: { from: currentPath } });
  };

  const openSession = (sessionId: string) => {
    if (shouldOpenFullPage) {
      navigateToSessionPage(sessionId);
      return;
    }
    setSelectedSessionId(sessionId);
    setIsSessionSheetOpen(true);
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
    openSession(sessionId);
  };

  const handleViewSessionDetails = (sessionId: string) => {
    openSession(sessionId);
  };

  const handleViewFullSessionDetails = () => {
    if (selectedSessionId) {
      navigateToSessionPage(selectedSessionId);
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
  const showUnassignedSessionsBanner = unassignedSessionsCount > 0;
  const unassignedSessionsLinkLabel = tPages("projectDetail.sessions.unassignedLinkLabel", {
    defaultValue: "See sessions on the lead",
  });
  const unassignedSessionsText = (
    <Trans
      t={tPages}
      i18nKey="projectDetail.sessions.unassignedBannerText"
      count={unassignedSessionsCount}
      values={{
        count: unassignedSessionsCount,
        leadName
      }}
      components={{
        strong: <span className="font-semibold" />
      }}
    />
  );
  const unassignedSessionsBanner = showUnassignedSessionsBanner ? (
    <div className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm leading-relaxed text-indigo-900">
      <Info className="mt-0.5 h-4 w-4 text-indigo-500" aria-hidden="true" />
      <p className="flex flex-wrap items-center gap-1">
        {unassignedSessionsText}
        <button
          type="button"
          className="font-normal text-indigo-800 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 cursor-pointer"
          onClick={(event) => {
            event.preventDefault();
            onUnassignedSessionsClick?.();
          }}
        >
          {unassignedSessionsLinkLabel}
        </button>
      </p>
    </div>
  ) : undefined;
  const renderNewSessionButton = () => (
    <NewSessionDialogForProject
      leadId={leadId}
      leadName={leadName}
      projectName={projectName}
      projectId={projectId}
      onSessionScheduled={onSessionUpdated}
      disabled={sessionPlanningLocked}
      disabledTooltip={sessionPlanningLockTooltip}
      onLockedClick={onSessionPlanningLocked}
    />
  );

  return (
    <>
      <SessionListCard
        title={titleOverride ?? t("sessions_form.title")}
        icon={Calendar}
        sessions={sessions}
        loading={loading}
        headerAction={hasSessions ? renderNewSessionButton() : undefined}
        summary={summary ?? undefined}
        banner={unassignedSessionsBanner}
        emptyState={{
          icon: Calendar,
          title: t("sessions_form.no_sessions"),
          description: t("sessions_form.add_sessions_hint"),
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
        onViewDetails={handleViewSessionDetails}
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
