import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Edit, AlertTriangle, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import SessionStatusBadge from "@/components/SessionStatusBadge";
import { isOverdueSession } from "@/lib/dateUtils";
import EditSessionDialog from "@/components/EditSessionDialog";
import type { SessionPlanningStepId } from "@/features/session-planning";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useSessionActions } from "@/hooks/useSessionActions";
import ProjectDetailsLayout from "@/components/project-details/ProjectDetailsLayout";
import { UnifiedClientDetails } from "@/components/UnifiedClientDetails";
import SessionGallery from "@/components/SessionGallery";
import { getDisplaySessionName } from "@/lib/sessionUtils";
import {
  useMessagesTranslation,
  useCommonTranslation,
  useFormsTranslation,
} from "@/hooks/useTypedTranslation";
import { useTranslation } from "react-i18next";
import { EntityHeader } from "@/components/EntityHeader";
import { buildSessionSummaryItems } from "@/lib/sessions/buildSessionSummaryItems";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface SessionData {
  id: string;
  session_name: string | null;
  session_date: string;
  session_time: string;
  notes: string | null;
  location: string | null;
  status: string;
  lead_id: string;
  project_id: string | null;
  user_id: string;
  google_event_id?: string | null; // Make optional since it's not always returned
  leads?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
  };
  projects?: {
    id: string;
    name: string;
    project_types?: {
      name: string;
    };
  };
}

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation<{ from?: string }>();
  const { toast } = useToast();
  const { deleteSession } = useSessionActions();
  const { t: tMessages } = useMessagesTranslation();
  const { t: tCommon } = useCommonTranslation();
  const { t: tForms } = useFormsTranslation();
  const { t: tPages } = useTranslation("pages");
  const isMobile = useIsMobile();

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editStartStep, setEditStartStep] = useState<
    SessionPlanningStepId | undefined
  >(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const fetchSession = async () => {
    if (!id) return;

    console.log("SessionDetail: Starting to fetch session data for ID:", id);
    const startTime = performance.now();

    try {
      const { data, error } = await supabase
        .from("sessions")
        .select(
          `
          *,
          leads:lead_id (
            id,
            name,
            email,
            phone,
            notes
          ),
          projects:project_id (
            id,
            name,
            project_types (
              name
            )
          )
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;

      const endTime = performance.now();
      console.log(`SessionDetail: Fetch completed in ${endTime - startTime}ms`);

      setSession(data);
    } catch (error: any) {
      console.error("SessionDetail: Error fetching session:", error);
      toast({
        title: tCommon("toast.error"),
        description: tPages("sessionDetail.toast.loadErrorDescription"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("SessionDetail: Component mounted, session ID:", id);
    fetchSession();
  }, [id]);

  const handleEdit = () => {
    setEditStartStep(undefined);
    setIsEditDialogOpen(true);
  };

  const backTarget = location.state?.from;
  const getFallbackRoute = useCallback(() => {
    if (backTarget) {
      return backTarget;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      return -1;
    }
    return "/sessions";
  }, [backTarget]);

  const handleBack = useCallback(() => {
    const fallback = getFallbackRoute();
    if (typeof fallback === "number") {
      navigate(fallback);
    } else {
      navigate(fallback);
    }
  }, [getFallbackRoute, navigate]);

  const handleDelete = async () => {
    if (!session) return;

    const success = await deleteSession(session.id);
    if (success) {
      const fallback = backTarget ?? "/sessions";
      navigate(fallback);
    }
  };

  const handleSessionUpdated = () => {
    fetchSession();
    setIsEditDialogOpen(false);
    setEditStartStep(undefined);
  };

  const handleStatusChange = () => {
    fetchSession();
  };

  const handleLeadClick = useCallback(() => {
    if (session?.lead_id) {
      navigate(`/leads/${session.lead_id}`);
    }
  }, [navigate, session?.lead_id]);

  const handleProjectClick = useCallback(() => {
    if (session?.project_id) {
      navigate(`/projects/${session.project_id}`);
    }
  }, [navigate, session?.project_id]);

  const sessionTypeLabel =
    session?.projects?.project_types?.name || tForms("sessionBanner.session");
  const sessionNameDisplay = session ? getDisplaySessionName(session) : "";

  const openEditStep = useCallback(
    (step: SessionPlanningStepId) => {
      setEditStartStep(step);
      setIsEditDialogOpen(true);
    },
    [setEditStartStep, setIsEditDialogOpen]
  );

  const summaryItems = useMemo(
    () =>
      session
        ? buildSessionSummaryItems({
            session,
            labels: {
              dateTime: tPages("sessionDetail.labels.dateTime"),
              project: tPages("sessionDetail.labels.project"),
              notes: tPages("sessionDetail.labels.notes"),
              location: tPages("sessionDetail.labels.location"),
            },
            placeholders: {
              project: tPages("sessionDetail.summary.placeholders.project"),
              notes: tPages("sessionDetail.summary.placeholders.notes"),
              location: tPages("sessionDetail.summary.placeholders.location"),
            },
            actions: {
              editSchedule: tPages(
                "sessionDetail.summary.actions.editSchedule"
              ),
              connectProject: tPages(
                "sessionDetail.summary.actions.connectProject"
              ),
              addNotes: tPages("sessionDetail.summary.actions.addNotes"),
              addLocation: tPages("sessionDetail.summary.actions.addLocation"),
            },
            onProjectClick: session.project_id ? handleProjectClick : undefined,
            onEditSchedule: () => openEditStep("schedule"),
            onConnectProject: () => openEditStep("project"),
            onAddNotes: () => openEditStep("notes"),
            onAddLocation: () => openEditStep("location"),
          })
        : [],
    [session, tPages, handleProjectClick, openEditStep]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="container mx-auto px-4 py-6">
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-muted rounded w-1/4"></div>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-48 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">
            {tPages("sessionDetail.emptyState.title")}
          </h2>
          <p className="text-muted-foreground mb-4">
            {tPages("sessionDetail.emptyState.description")}
          </p>
          <Button onClick={() => navigate("/sessions")}>
            {tPages("sessionDetail.emptyState.cta")}
          </Button>
        </div>
      </div>
    );
  }

  const leftContent = session.leads && (
    <UnifiedClientDetails
      lead={{
        id: session.leads.id,
        name: session.leads.name,
        email: session.leads.email,
        phone: session.leads.phone,
        notes: session.leads.notes,
      }}
      title={tPages("sessionDetail.cards.clientDetails")}
      showQuickActions={true}
      showClickableNames={true}
      defaultExpanded={false}
      onNavigateToLead={handleLeadClick}
    />
  );

  const sections = [
    {
      id: "session-gallery",
      title: tPages("sessionDetail.gallery.title"),
      content: <SessionGallery sessionId={session.id} />,
    },
  ];

  const dangerZone = (
    <div className="border border-destructive/20 bg-destructive/5 rounded-lg p-6">
      <div className="space-y-4">
        <h3 className="font-medium text-destructive">
          {tPages("sessionDetail.dangerZone.title")}
        </h3>
        <Button
          variant="outline"
          onClick={() => setIsDeleteDialogOpen(true)}
          className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          size="lg"
        >
          {tPages("sessionDetail.dangerZone.button")}
        </Button>
        <p className="text-sm text-muted-foreground text-center">
          {tPages("sessionDetail.dangerZone.description")}
        </p>
      </div>
    </div>
  );

  const isOverdue = session
    ? isOverdueSession(session.session_date, session.status)
    : false;

  const overdueBanner = isOverdue ? (
    <div className="space-y-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm leading-relaxed text-orange-800">
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 text-orange-600"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <p className="font-semibold text-orange-900">
            {tPages("sessionDetail.overdue.title")}
          </p>
          <p>{tPages("sessionDetail.overdue.description")}</p>
        </div>
      </div>
      <div className="pl-7">
        <Button
          size="sm"
          variant="outline"
          className="border-orange-300 text-orange-700 hover:bg-orange-100 hover:text-orange-700"
          onClick={() => {
            setEditStartStep("schedule");
            setIsEditDialogOpen(true);
          }}
        >
          {tPages("sessionDetail.overdue.reschedule")}
        </Button>
      </div>
    </div>
  ) : undefined;

  const renderSessionStatusBadge = (
    className?: string,
    size: "sm" | "default" = "default"
  ) =>
    session ? (
      <SessionStatusBadge
        sessionId={session.id}
        currentStatus={session.status as any}
        editable={true}
        onStatusChange={handleStatusChange}
        size={size}
        className={className}
      />
    ) : null;

  const renderEditButton = (className?: string) => (
    <Button
      variant="outline"
      size="sm"
      onClick={handleEdit}
      className={cn("gap-2 text-sm font-medium", className)}
    >
      <Edit className="h-4 w-4" />
      <span>{tForms("sessions.editSession")}</span>
    </Button>
  );

  const headerActions = session ? (
    isMobile ? (
      <div className="flex w-full flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[160px]">
          {renderSessionStatusBadge("w-full h-9 justify-center")}
        </div>
        {renderEditButton("min-w-[120px] justify-center")}
      </div>
    ) : (
      renderEditButton()
    )
  ) : undefined;

  const headerTitle = session ? (
    <span className="flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {sessionTypeLabel}
      </span>
      <span className="flex flex-wrap items-center gap-2 text-foreground">
        <span className="break-words text-pretty leading-tight">
          {sessionNameDisplay}
        </span>
        {!isMobile && renderSessionStatusBadge("text-xs sm:text-sm")}
      </span>
    </span>
  ) : undefined;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-full px-6 py-6">
        {session && (
          <EntityHeader
            name={sessionNameDisplay}
            title={headerTitle}
            onBack={handleBack}
            backLabel={tCommon("buttons.back")}
            summaryItems={summaryItems}
            banner={overdueBanner}
            actions={headerActions}
            avatarClassName="bg-gradient-to-br from-amber-300 via-orange-400 to-orange-500 text-white ring-0"
            avatarContent={
              <CalendarIcon className="h-5 w-5 text-white" aria-hidden="true" />
            }
            fallbackInitials="SE"
          />
        )}
      </div>

      <div className="mx-auto max-w-full px-6 pb-6">
        <ProjectDetailsLayout
          header={<></>}
          left={leftContent}
          sections={sections}
          overviewNavId="session-detail-overview"
          overviewLabel={tForms("project_sheet.overview_tab")}
          rightFooter={dangerZone}
        />
      </div>

      {/* Edit Dialog */}
      {isEditDialogOpen && (
        <ErrorBoundary
          onError={(error) => {
            console.error("Error in EditSessionDialog:", error);
            setIsEditDialogOpen(false);
          }}
        >
          <EditSessionDialog
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                setEditStartStep(undefined);
              }
              setIsEditDialogOpen(open);
            }}
            sessionId={session.id}
            leadId={session.lead_id}
            currentSessionName={session.session_name || ""}
            currentDate={session.session_date}
            currentTime={session.session_time}
            currentNotes={session.notes || ""}
            currentLocation={session.location || ""}
            currentProjectId={session.project_id}
            leadName={session.leads?.name || ""}
            onSessionUpdated={handleSessionUpdated}
            startStep={editStartStep}
          />
        </ErrorBoundary>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tPages("sessionDetail.modal.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tMessages("confirm.deleteSession")}{" "}
              {tMessages("confirm.cannotUndo")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tPages("sessionDetail.dangerZone.button")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
