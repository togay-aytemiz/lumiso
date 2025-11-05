import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { SessionPlanningProvider } from "../context/SessionPlanningProvider";
import { SessionSavedResourcesProvider } from "../context/SessionSavedResourcesProvider";
import { SessionWorkflowProvider } from "../context/SessionWorkflowProvider";
import { useSessionWorkflowCatalog } from "../context/sessionWorkflowContext";
import { SessionPlanningOriginalStateProvider } from "../context/SessionPlanningOriginalStateContext";
import { useSessionPlanningEntryContext } from "../hooks/useSessionPlanningEntryContext";
import { SessionPlanningWizard } from "./SessionPlanningWizard";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { SessionPlanningDraft, SessionPlanningEntryContext, SessionPlanningState, SessionPlanningStepId } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { createSession, updateSession } from "../api/sessionCreation";
import { createLead, createProject } from "../api/leadProjectCreation";
import { useWorkflowTriggers } from "@/hooks/useWorkflowTriggers";
import { useSessionReminderScheduling } from "@/hooks/useSessionReminderScheduling";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CalendarDays, CheckCircle2, Loader2, MapPin, User, Briefcase } from "lucide-react";
import { trackEvent } from "@/lib/telemetry";
import { useNavigate } from "react-router-dom";

const DRAFT_STORAGE_PREFIX = "session-wizard-draft";
const DRAFT_VERSION = 1;

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const buildDraftKey = (userId: string | null, context: SessionPlanningEntryContext) => {
  const parts = [
    userId || "anon",
    context.sessionId || "new-session",
    context.leadId || "new",
    context.projectId || "none",
    context.entrySource || "default",
    context.mode || "create"
  ];
  return `${DRAFT_STORAGE_PREFIX}:${parts.join(":")}`;
};

const parseDraft = (raw: string | null): SessionPlanningDraft | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionPlanningDraft;
    if (parsed && typeof parsed.updatedAt === "string" && parsed.version === DRAFT_VERSION && parsed.state) {
      return parsed;
    }
  } catch (error) {
    console.error("Unable to parse session planning draft", error);
  }
  return null;
};

interface CompletionSummary {
  sessionId: string;
  sessionName: string;
  sessionDate: string;
  sessionTime: string;
  leadName: string;
  projectId?: string;
  projectName?: string;
  location?: string;
  entrySource?: string;
  notifications: SessionPlanningState["notifications"];
}

const prepareStateForDraft = (state: SessionPlanningState, savedAt: string): SessionPlanningState => {
  const clone = JSON.parse(JSON.stringify(state)) as SessionPlanningState;
  clone.meta = {
    ...clone.meta,
    isDirty: false,
    isSavingDraft: false,
    lastSavedAt: savedAt
  };
  return clone;
};

interface SessionPlanningWizardSheetProps {
  leadId?: string;
  leadName?: string;
  projectId?: string;
  projectName?: string;
  defaultDate?: string;
  defaultTime?: string;
  entrySource?: string;
  sessionId?: string;
  mode?: "create" | "edit";
  startStepOverride?: SessionPlanningStepId;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionScheduled?: () => void;
  onSessionUpdated?: () => void;
}

type SessionRecord = {
  id: string;
  session_name?: string | null;
  session_date?: string | null;
  session_time?: string | null;
  notes?: string | null;
  location?: string | null;
  session_type_id?: string | null;
  lead_id?: string | null;
  project_id?: string | null;
  leads?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
  } | null;
  projects?: {
    id?: string;
    name?: string | null;
  } | null;
  session_types?: {
    id?: string;
    name?: string | null;
  } | null;
};

export const SessionPlanningWizardSheet = (props: SessionPlanningWizardSheetProps) => {
  const derivedEntrySource =
    props.entrySource ??
    (props.projectId ? "project" : props.leadId ? "lead" : undefined);
  const derivedMode = props.mode ?? (props.sessionId ? "edit" : "create");

  const entryContext = useSessionPlanningEntryContext({
    leadId: props.leadId,
    leadName: props.leadName,
    projectId: props.projectId,
    projectName: props.projectName,
    defaultDate: props.defaultDate,
    defaultTime: props.defaultTime,
    entrySource: derivedEntrySource,
    sessionId: props.sessionId,
    mode: derivedMode,
    startStepOverride: props.startStepOverride
  });

  const providerKey = useMemo(() => JSON.stringify(entryContext), [entryContext]);

  return (
    <SessionPlanningProvider key={providerKey} entryContext={entryContext}>
      <SessionWorkflowProvider>
        <SessionPlanningWizardSheetInner {...props} entryContext={entryContext} />
      </SessionWorkflowProvider>
    </SessionPlanningProvider>
  );
};

const SessionPlanningWizardSheetInner = ({
  isOpen,
  onOpenChange,
  onSessionScheduled,
  onSessionUpdated,
  entryContext
}: Pick<
  SessionPlanningWizardSheetProps,
  "isOpen" | "onOpenChange" | "onSessionScheduled" | "onSessionUpdated"
> & {
  entryContext: SessionPlanningEntryContext;
}) => {
  const { state } = useSessionPlanningContext();
  const { reset, markSaving, markSaved, applyState, loadEntryContext } = useSessionPlanningActions();
  const { toast } = useToast();
  const [isCompleting, setIsCompleting] = useState(false);
  const { t } = useTranslation("sessionPlanning");
  const { t: tCommon } = useTranslation("common");
  const { triggerSessionScheduled } = useWorkflowTriggers();
  const { scheduleSessionReminders, rescheduleSessionReminders, cancelSessionReminders } =
    useSessionReminderScheduling();
  const workflowCatalog = useSessionWorkflowCatalog();
  const isEditing = state.meta.mode === "edit" || entryContext.mode === "edit" || Boolean(entryContext.sessionId);
  const [showGuardDialog, setShowGuardDialog] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<SessionPlanningDraft | null>(null);
  const [isResolvingEntryContext, setIsResolvingEntryContext] = useState(false);
  const [completionSummary, setCompletionSummary] = useState<CompletionSummary | null>(null);
  const draftKeyRef = useRef<string | null>(null);
  const skipNextSaveRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const contextHydratedRef = useRef(false);
  const wizardOpenedRef = useRef(false);
  const successTrackedRef = useRef(false);
  const initialSessionSnapshotRef = useRef<SessionPlanningState | null>(null);
  const pendingSessionPrefillRef = useRef(false);
  const contextResolutionRequestIdRef = useRef(0);
  const sessionHydrationRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const navigate = useNavigate();
  const needsProjectLookup = useMemo(
    () =>
      !isEditing &&
      Boolean(entryContext.projectId) &&
      (!entryContext.projectName || !entryContext.leadId),
    [entryContext.projectId, entryContext.projectName, entryContext.leadId, isEditing]
  );
  const needsLeadLookup = useMemo(
    () =>
      !isEditing &&
      (Boolean(entryContext.leadId && !entryContext.leadName) ||
        (!entryContext.leadId && Boolean(entryContext.projectId))),
    [entryContext.leadId, entryContext.leadName, entryContext.projectId, isEditing]
  );
  const shouldShowContextLoader =
    isOpen &&
    ((needsLeadLookup || needsProjectLookup) && !contextHydratedRef.current || isResolvingEntryContext);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setCompletionSummary(null);
      wizardOpenedRef.current = false;
      successTrackedRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || shouldShowContextLoader || completionSummary) {
      return;
    }
    if (wizardOpenedRef.current) return;
    wizardOpenedRef.current = true;
    trackEvent("session_wizard_opened", {
      entrySource: entryContext.entrySource ?? "direct",
    });
  }, [isOpen, shouldShowContextLoader, entryContext.entrySource, completionSummary]);

  useEffect(() => {
    if (!completionSummary) {
      successTrackedRef.current = false;
      return;
    }
    if (successTrackedRef.current) return;
    successTrackedRef.current = true;
    trackEvent("session_wizard_success_shown", {
      sessionId: completionSummary.sessionId,
      entrySource: completionSummary.entrySource ?? "direct",
    });
  }, [completionSummary]);

  useEffect(() => {
    let cancelled = false;
    const resolveDraftKey = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        const key = buildDraftKey(user?.id ?? null, entryContext);
        draftKeyRef.current = key;
        const draft = parseDraft(localStorage.getItem(key));
        if (draft) {
          setResumeDraft(draft);
        }
      } catch (error) {
        console.error("Unable to initialise session planning draft", error);
      }
    };

    resolveDraftKey();
    return () => {
      cancelled = true;
    };
  }, [entryContext]);

  useEffect(() => {
    if (!isOpen) {
      contextHydratedRef.current = false;
      setIsResolvingEntryContext(false);
      initialSessionSnapshotRef.current = null;
      pendingSessionPrefillRef.current = false;
      return;
    }
    contextHydratedRef.current = false;
    pendingSessionPrefillRef.current = false;
  }, [
    isOpen,
    entryContext.leadId,
    entryContext.projectId,
    entryContext.defaultDate,
    entryContext.defaultTime,
    entryContext.entrySource
  ]);

  useEffect(() => {
    if (!isOpen || contextHydratedRef.current) {
      return;
    }

    if (isEditing) {
      return;
    }

    if (!needsProjectLookup && !needsLeadLookup) {
      contextHydratedRef.current = true;
      setIsResolvingEntryContext(false);
      return;
    }

    const requestId = ++contextResolutionRequestIdRef.current;
    setIsResolvingEntryContext(true);

    const resolveContext = async () => {
      try {
        const nextContext: SessionPlanningEntryContext = { ...entryContext };
        let leadIdForLookup = nextContext.leadId;

        if (needsProjectLookup && entryContext.projectId) {
          const { data: projectData, error: projectError } = await supabase
            .from("projects")
            .select("id, name, lead_id")
            .eq("id", entryContext.projectId)
            .limit(1)
            .maybeSingle();

          if (projectError) {
            throw projectError;
          }

          if (projectData) {
            nextContext.projectName =
              nextContext.projectName ?? (projectData as { name?: string }).name ?? nextContext.projectName;
            const derivedLeadId = (projectData as { lead_id?: string | null }).lead_id;
            if (!nextContext.leadId && derivedLeadId) {
              nextContext.leadId = derivedLeadId;
              leadIdForLookup = derivedLeadId;
            }
          }
        }

        if ((needsLeadLookup || !nextContext.leadName) && leadIdForLookup) {
          const { data: leadData, error: leadError } = await supabase
            .from("leads")
            .select("id, name")
            .eq("id", leadIdForLookup)
            .limit(1)
            .maybeSingle();

          if (leadError) {
            throw leadError;
          }

          if (leadData) {
            nextContext.leadName = nextContext.leadName ?? (leadData as { name?: string }).name ?? nextContext.leadName;
          }
        }

        if (!nextContext.entrySource) {
          nextContext.entrySource = nextContext.projectId
            ? "project"
            : nextContext.leadId
              ? "lead"
              : "direct";
        }

        if (!isMountedRef.current || contextResolutionRequestIdRef.current !== requestId) {
          return;
        }

        skipNextSaveRef.current = true;
        loadEntryContext(nextContext);
        contextHydratedRef.current = true;
      } catch (error) {
        if (!isMountedRef.current || contextResolutionRequestIdRef.current !== requestId) {
          return;
        }
        console.error("Failed to resolve session planning entry context", error);
        contextHydratedRef.current = true;
      } finally {
        if (isMountedRef.current && contextResolutionRequestIdRef.current === requestId) {
          setIsResolvingEntryContext(false);
        }
      }
    };

    resolveContext();
  }, [
    isOpen,
    entryContext,
    entryContext.entrySource,
    entryContext.leadId,
    entryContext.leadName,
    entryContext.projectId,
    entryContext.projectName,
    loadEntryContext,
    needsLeadLookup,
    needsProjectLookup,
    isEditing
  ]);

  useEffect(() => {
    if (!isOpen || !isEditing || !entryContext.sessionId) {
      return;
    }

    if (contextHydratedRef.current && initialSessionSnapshotRef.current) {
      return;
    }

    if (pendingSessionPrefillRef.current) {
      return;
    }

    const requestId = ++sessionHydrationRequestIdRef.current;
    pendingSessionPrefillRef.current = true;
    setIsResolvingEntryContext(true);

    const hydrateExistingSession = async () => {
      try {
        const { data, error } = await supabase
          .from("sessions")
          .select(
            `id,
            session_name,
            session_date,
            session_time,
            notes,
            location,
            session_type_id,
            lead_id,
            project_id,
            leads:lead_id ( id, name, email, phone, notes ),
            projects:project_id ( id, name ),
            session_types:session_type_id ( id, name )`
          )
          .eq("id", entryContext.sessionId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error("Session not found");
        }

        if (!isMountedRef.current || sessionHydrationRequestIdRef.current !== requestId) {
          return;
        }

        const record = data as SessionRecord;
        const resolvedLeadId: string | undefined = record.lead_id ?? entryContext.leadId ?? undefined;
        const resolvedLeadName: string = record.leads?.name ?? entryContext.leadName ?? "";
        const resolvedProjectId: string | undefined = record.project_id ?? entryContext.projectId ?? undefined;
        const resolvedProjectName: string | undefined = record.projects?.name ?? entryContext.projectName ?? undefined;

        const nextContext: SessionPlanningEntryContext = {
          ...entryContext,
          leadId: resolvedLeadId,
          leadName: resolvedLeadName,
          projectId: resolvedProjectId,
          projectName: resolvedProjectName,
          sessionId: record.id,
          mode: "edit",
          entrySource:
            entryContext.entrySource ??
            (resolvedProjectId ? "project" : resolvedLeadId ? "lead" : "direct"),
          defaultDate: record.session_date ?? entryContext.defaultDate,
          defaultTime: record.session_time ?? entryContext.defaultTime,
          startStepOverride: entryContext.startStepOverride
        };

        skipNextSaveRef.current = true;
        loadEntryContext(nextContext);

        const nextState: SessionPlanningState = {
          lead: {
            id: resolvedLeadId,
            name: resolvedLeadName,
            email: record.leads?.email ?? undefined,
            phone: record.leads?.phone ?? undefined,
            notes: record.leads?.notes ?? undefined,
            mode: "existing"
          },
          project: {
            id: resolvedProjectId,
            name: resolvedProjectName ?? "",
            description: "",
            mode: resolvedProjectId ? "existing" : "existing",
            isSkipped: !resolvedProjectId
          },
          sessionTypeId: record.session_type_id ?? undefined,
          sessionTypeLabel: record.session_types?.name ?? undefined,
          sessionName: record.session_name ?? "",
          locationId: undefined,
          locationLabel: undefined,
          location: record.location ?? "",
          schedule: {
            date: record.session_date ?? entryContext.defaultDate,
            time: record.session_time ?? entryContext.defaultTime,
            timezone: undefined
          },
          notes: record.notes ?? "",
          notifications: { ...state.notifications },
          meta: {
            currentStep: entryContext.startStepOverride ?? "summary",
            isDirty: false,
            isSavingDraft: false,
            lastSavedAt: undefined,
            entrySource: nextContext.entrySource,
            mode: "edit",
            sessionId: record.id
          }
        };

        initialSessionSnapshotRef.current = nextState;
        applyState(nextState);
        contextHydratedRef.current = true;
      } catch (error) {
        if (!isMountedRef.current || sessionHydrationRequestIdRef.current !== requestId) {
          return;
        }
        console.error("Failed to load session for editing", error);
        contextHydratedRef.current = true;
        const message = getErrorMessage(error);
        toast({
          title: t("toast.sessionLoadFailedTitle"),
          description: message || t("toast.sessionLoadFailedDescription"),
          variant: "destructive"
        });
        onOpenChange(false);
      } finally {
        if (isMountedRef.current && sessionHydrationRequestIdRef.current === requestId) {
          setIsResolvingEntryContext(false);
          pendingSessionPrefillRef.current = false;
        }
      }
    };

    hydrateExistingSession();
  }, [
    isOpen,
    isEditing,
    entryContext,
    entryContext.sessionId,
    entryContext.entrySource,
    entryContext.leadId,
    entryContext.leadName,
    entryContext.projectId,
    entryContext.projectName,
    entryContext.defaultDate,
    entryContext.defaultTime,
    loadEntryContext,
    applyState,
    toast,
    t,
    onOpenChange,
    state.notifications
  ]);

  const handleClose = () => {
    if (state.meta.isDirty) {
      setShowGuardDialog(true);
      return;
    }
    const entrySource = entryContext.entrySource ?? "direct";
    if (completionSummary) {
      trackEvent("session_wizard_success_closed", {
        entrySource,
        sessionId: completionSummary.sessionId,
      });
    } else {
      trackEvent("session_wizard_abandoned", {
        entrySource,
        reason: "closed",
      });
    }
    if (draftKeyRef.current) {
      localStorage.removeItem(draftKeyRef.current);
    }
    reset(entryContext);
    setCompletionSummary(null);
    onOpenChange(false);
  };

  const handleDiscardDraft = () => {
    setShowGuardDialog(false);
    trackEvent("session_wizard_abandoned", {
      entrySource: entryContext.entrySource ?? "direct",
      reason: "discard_draft",
    });
    if (draftKeyRef.current) {
      localStorage.removeItem(draftKeyRef.current);
    }
    reset(entryContext);
    onOpenChange(false);
  };

  const handleSuccessClose = () => {
    if (completionSummary) {
      trackEvent("session_wizard_success_closed", {
        entrySource: completionSummary.entrySource ?? "direct",
        sessionId: completionSummary.sessionId,
      });
    }
    setCompletionSummary(null);
    reset(entryContext);
    onOpenChange(false);
  };

  const handleScheduleAnother = () => {
    if (completionSummary) {
      trackEvent("session_wizard_schedule_another", {
        entrySource: completionSummary.entrySource ?? "direct",
        sessionId: completionSummary.sessionId,
      });
    }
    setCompletionSummary(null);
    successTrackedRef.current = false;
    wizardOpenedRef.current = false;
    reset(entryContext);
  };

  useEffect(() => {
    const key = draftKeyRef.current;
    if (!key) return;
    if (!state.meta.isDirty) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    markSaving(true);

    saveTimerRef.current = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const stateForDraft = prepareStateForDraft(state, savedAt);
      const draft: SessionPlanningDraft = {
        state: stateForDraft,
        updatedAt: savedAt,
        version: DRAFT_VERSION
      };

      try {
        localStorage.setItem(key, JSON.stringify(draft));
      } catch (error) {
        console.error("Failed to persist session planning draft", error);
      }

      markSaved(savedAt);
      saveTimerRef.current = null;
    }, 800);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        markSaving(false);
      }
    };
  }, [state, markSaving, markSaved]);

  const handleComplete = async () => {
    const entrySource = entryContext.entrySource ?? "direct";
    const sessionTypeId = state.sessionTypeId;
    const sessionTypeLabel = state.sessionTypeLabel;
    const sessionIdForEdit = entryContext.sessionId || state.meta.sessionId;
    const originalSnapshot = initialSessionSnapshotRef.current;

    let leadId =
      state.lead.mode === "existing" ? state.lead.id || entryContext.leadId : undefined;
    let leadName = state.lead.name || entryContext.leadName || "";

    if (state.lead.mode === "new") {
      if (!state.lead.name?.trim()) {
        toast({ title: t("validation.missingLead"), variant: "destructive" });
        return;
      }
      try {
        const newLead = await createLead({
          name: state.lead.name,
          email: state.lead.email,
          phone: state.lead.phone,
          notes: state.lead.notes,
        });
        leadId = newLead.id;
        leadName = newLead.name;
      } catch (error) {
        const message = getErrorMessage(error);
        toast({
          title: t("steps.lead.createErrorTitle"),
          description: message,
          variant: "destructive",
        });
        return;
      }
    }

    if (!leadId) {
      toast({
        title: t("validation.missingLead"),
        variant: "destructive",
      });
      return;
    }

    let projectId =
      state.project.mode === "existing" ? state.project.id || entryContext.projectId : undefined;
    let projectName = state.project.name || entryContext.projectName || "";

    if (state.project.mode === "new") {
      if (!state.project.name?.trim()) {
        toast({
          title: t("steps.project.missingName"),
          variant: "destructive",
        });
        return;
      }
      try {
        const newProject = await createProject({
          leadId,
          name: state.project.name,
          description: state.project.description,
        });
        projectId = newProject.id;
        projectName = state.project.name ?? projectName;
      } catch (error) {
        const message = getErrorMessage(error);
        toast({
          title: t("steps.project.createErrorTitle"),
          description: message,
          variant: "destructive",
        });
        return;
      }
    }

    if (state.project.isSkipped) {
      projectId = undefined;
      projectName = "";
    }

    const sessionDate =
      state.schedule.date ||
      entryContext.defaultDate ||
      originalSnapshot?.schedule.date ||
      "";
    const sessionTime =
      state.schedule.time ||
      entryContext.defaultTime ||
      originalSnapshot?.schedule.time ||
      "";

    if (!sessionDate || !sessionTime) {
      toast({
        title: t("validation.missingSchedule"),
        variant: "destructive",
      });
      return;
    }

    const sessionName =
      (state.sessionName || "").trim() ||
      sessionTypeLabel ||
      (leadName ? `${leadName} Session` : undefined) ||
      originalSnapshot?.sessionName ||
      t("summary.untitled");

    const locationSummary = state.locationLabel || state.location || state.meetingUrl || "";

    if (isEditing && sessionIdForEdit) {
      setIsCompleting(true);
      try {
        const { organizationId } = await updateSession({
          sessionId: sessionIdForEdit,
          leadId,
          projectId,
          sessionName,
          sessionDate,
          sessionTime,
          notes: state.notes,
          location: state.location,
          meetingUrl: state.meetingUrl,
          sessionTypeId,
        });

        const previousDate = originalSnapshot?.schedule.date ?? sessionDate;
        const previousTime = originalSnapshot?.schedule.time ?? sessionTime;
        const dateTimeChanged = previousDate !== sessionDate || previousTime !== sessionTime;

        if (dateTimeChanged) {
          try {
            await triggerSessionRescheduled(
              sessionIdForEdit,
              organizationId,
              `${previousDate} ${previousTime}`.trim(),
              `${sessionDate} ${sessionTime}`.trim(),
              {
                lead_id: leadId,
                project_id: projectId,
                session_type_id: sessionTypeId,
                location: locationSummary,
                client_name: leadName,
              }
            );
          } catch (workflowError) {
            console.error("Error triggering session rescheduled workflow", workflowError);
          }
        }

        try {
          if (state.notifications.sendReminder) {
            await rescheduleSessionReminders(sessionIdForEdit);
          } else {
            await cancelSessionReminders(sessionIdForEdit);
          }
        } catch (reminderError) {
          console.error("Error updating session reminders", reminderError);
        }

        toast({
          title: t("toast.sessionUpdatedTitle"),
          description: t("toast.sessionUpdatedDescription"),
        });

        trackEvent("session_wizard_updated", {
          entrySource,
          sessionId: sessionIdForEdit,
          leadId,
          projectId,
          hasProject: Boolean(projectId),
          notifications: { ...state.notifications },
          scheduleChanged: dateTimeChanged,
          sessionTypeChanged: sessionTypeId !== originalSnapshot?.sessionTypeId,
        });

        onSessionUpdated?.();
        if (draftKeyRef.current) {
          localStorage.removeItem(draftKeyRef.current);
        }
        initialSessionSnapshotRef.current = null;
        reset(entryContext);
        setCompletionSummary(null);
        onOpenChange(false);
      } catch (error) {
        const message = getErrorMessage(error);
        console.error("Error updating session via wizard", error);
        toast({
          title: t("toast.sessionUpdateFailedTitle"),
          description: message || t("toast.sessionUpdateFailedDescription"),
          variant: "destructive",
        });
      } finally {
        setIsCompleting(false);
      }
      return;
    }

    setIsCompleting(true);
    try {
      const { sessionId, organizationId } = await createSession(
        {
          leadId,
          leadName,
          sessionName,
          sessionDate,
          sessionTime,
          notes: state.notes,
          location: state.location,
          meetingUrl: state.meetingUrl,
          projectId,
          sessionTypeId,
          status: "planned",
        },
        {
          updateLeadStatus: !projectId,
          createActivity: !projectId,
        }
      );

      const reminderWorkflowIds = workflowCatalog.reminderWorkflows.map((workflow) => workflow.id);
      const summaryWorkflowIds = workflowCatalog.summaryEmailWorkflows
        .filter((workflow) => workflow.triggerType === "session_scheduled")
        .map((workflow) => workflow.id);
      const otherSessionScheduledWorkflowIds = workflowCatalog.otherWorkflows
        .filter((workflow) => workflow.triggerType === "session_scheduled")
        .map((workflow) => workflow.id);

      const workflowPreferences = {
        reminderWorkflowIds,
        summaryWorkflowIds,
        otherWorkflowIds: workflowCatalog.otherWorkflows.map((workflow) => workflow.id),
      };

      const selectedWorkflowIdsSet = new Set<string>(otherSessionScheduledWorkflowIds);
      if (state.notifications.sendSummaryEmail) {
        summaryWorkflowIds.forEach((id) => selectedWorkflowIdsSet.add(id));
      }
      const selectedWorkflowIds = Array.from(selectedWorkflowIdsSet);

      const triggerData = {
        session_date: sessionDate,
        session_time: sessionTime,
        location: locationSummary,
        client_name: leadName,
        lead_id: leadId,
        project_id: projectId,
        session_type_id: sessionTypeId,
        status: "planned",
        notifications: state.notifications,
        workflow_preferences: {
          ...workflowPreferences,
          selectedWorkflowIds,
        },
        skip_reminders: !state.notifications.sendReminder,
        ...(selectedWorkflowIds.length > 0 ? { workflow_ids: selectedWorkflowIds } : {}),
      };

      try {
        await triggerSessionScheduled(sessionId, organizationId, triggerData, selectedWorkflowIds);
      } catch (workflowError) {
        console.error("Error triggering session workflow", workflowError);
        toast({
          title: t("toast.sessionWorkflowWarningTitle"),
          description: t("toast.sessionWorkflowWarningDescription"),
        });
      }

      if (state.notifications.sendReminder) {
        try {
          await scheduleSessionReminders(sessionId);
        } catch (reminderError) {
          console.error("Error scheduling session reminders", reminderError);
        }
      }

      toast({
        title: t("toast.sessionCreatedTitle"),
        description: (
          <div className="space-y-2">
            <p>{t("toast.sessionCreatedDescription")}</p>
            <button
              type="button"
              className="text-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none"
              onClick={() => navigate(`/sessions/${sessionId}`)}
            >
              {tCommon("buttons.view_session")}
            </button>
          </div>
        ),
        className: "flex-col items-start",
      });

      trackEvent("session_wizard_confirmed", {
        entrySource,
        sessionId,
        leadId,
        projectId,
        hasProject: Boolean(projectId),
        notifications: { ...state.notifications },
        workflows: {
          triggered: selectedWorkflowIds,
          reminderIds: workflowPreferences.reminderWorkflowIds,
          summaryIds: workflowPreferences.summaryWorkflowIds,
          otherIds: workflowPreferences.otherWorkflowIds,
        },
      });

      setCompletionSummary({
        sessionId,
        sessionName,
        sessionDate,
        sessionTime,
        leadName,
        projectId,
        projectName,
        location: locationSummary,
        entrySource,
        notifications: { ...state.notifications },
      });
      wizardOpenedRef.current = false;
      successTrackedRef.current = false;

      onSessionScheduled?.();
      if (draftKeyRef.current) {
        localStorage.removeItem(draftKeyRef.current);
      }
      reset(entryContext);
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error creating session via wizard", error);
      toast({
        title: t("toast.sessionCreationFailedTitle"),
        description: message || t("toast.sessionCreationFailedDescription"),
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <>
      <AppSheetModal
        title={t("wizard.title")}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="xl"
        dirty={state.meta.isDirty}
        onDirtyClose={handleClose}
      >
        {shouldShowContextLoader ? (
          <div className="flex h-[360px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span>{t("wizard.preparingEntry")}</span>
          </div>
        ) : completionSummary ? (
          <SessionPlanningSuccess
            summary={completionSummary}
            onClose={handleSuccessClose}
            onScheduleAnother={handleScheduleAnother}
          />
        ) : (
          <SessionPlanningOriginalStateProvider value={initialSessionSnapshotRef.current}>
            <SessionSavedResourcesProvider>
              <SessionPlanningWizard onCancel={handleClose} onComplete={handleComplete} isCompleting={isCompleting} />
            </SessionSavedResourcesProvider>
          </SessionPlanningOriginalStateProvider>
        )}
      </AppSheetModal>

      <AlertDialog open={showGuardDialog} onOpenChange={setShowGuardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("guardrail.unsavedTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("guardrail.unsavedDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("guardrail.stay")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscardDraft}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("guardrail.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!resumeDraft} onOpenChange={(open) => !open && setResumeDraft(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("draft.resumeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("draft.resumeDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (draftKeyRef.current) {
                  localStorage.removeItem(draftKeyRef.current);
                }
                setResumeDraft(null);
              }}
            >
              {t("draft.discard")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!resumeDraft) return;
                skipNextSaveRef.current = true;
                applyState(resumeDraft.state);
                markSaved(resumeDraft.updatedAt);
                setResumeDraft(null);
              }}
            >
              {t("draft.resume")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const SessionPlanningSuccess = ({
  summary,
  onClose,
  onScheduleAnother,
}: {
  summary: CompletionSummary;
  onClose: () => void;
  onScheduleAnother: () => void;
}) => {
  const { t } = useTranslation("sessionPlanning");
  const scheduleText = useMemo(() => {
    const parts = [
      summary.sessionDate || t("summary.values.dateTbd"),
      summary.sessionTime || t("summary.values.timeTbd"),
    ];
    return parts.join(" · ");
  }, [summary.sessionDate, summary.sessionTime, t]);

  const locationText = summary.location?.trim()
    ? summary.location
    : t("summary.values.notSet");

  const projectText = summary.projectName?.trim()
    ? summary.projectName
    : t("summary.values.notLinked");

  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-900">{t("wizard.successTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("wizard.successSubtitle", { name: summary.sessionName })}
        </p>
      </div>
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm">
        <SuccessDetail
          icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
          label={t("summary.labels.schedule")}
          value={scheduleText}
        />
        <SuccessDetail
          icon={<User className="h-4 w-4" aria-hidden="true" />}
          label={t("summary.labels.lead")}
          value={summary.leadName}
        />
        <SuccessDetail
          icon={<Briefcase className="h-4 w-4" aria-hidden="true" />}
          label={t("summary.labels.project")}
          value={projectText}
        />
        <SuccessDetail
          icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
          label={t("summary.labels.location")}
          value={locationText}
        />
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-muted-foreground">
          {t("wizard.successNotifications", {
            reminders: t(summary.notifications.sendReminder ? "summary.status.on" : "summary.status.off"),
            summaryEmail: t(summary.notifications.sendSummaryEmail ? "summary.status.on" : "summary.status.off"),
          })}
        </p>
      </div>
      <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
        <Button className="w-full sm:flex-1" onClick={onScheduleAnother}>
          {t("wizard.successScheduleAnother")}
        </Button>
        <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
          {t("wizard.successClose")}
        </Button>
      </div>
    </div>
  );
};

const SuccessDetail = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
      {icon}
    </div>
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value}</p>
    </div>
  </div>
);
