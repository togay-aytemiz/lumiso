import { useEffect, useMemo, useRef, useState } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { SessionPlanningProvider } from "../context/SessionPlanningProvider";
import { useSessionPlanningEntryContext } from "../hooks/useSessionPlanningEntryContext";
import { SessionPlanningWizard } from "./SessionPlanningWizard";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useToast } from "@/components/ui/use-toast";
import { SessionPlanningDraft, SessionPlanningEntryContext, SessionPlanningState } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { createSession } from "../api/sessionCreation";
import { createLead, createProject } from "../api/leadProjectCreation";
import { useWorkflowTriggers } from "@/hooks/useWorkflowTriggers";
import { useSessionReminderScheduling } from "@/hooks/useSessionReminderScheduling";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const DRAFT_STORAGE_PREFIX = "session-wizard-draft";
const DRAFT_VERSION = 1;

const buildDraftKey = (userId: string | null, context: SessionPlanningEntryContext) => {
  const parts = [userId || "anon", context.leadId || "new", context.projectId || "none", context.entrySource || "default"];
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
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionScheduled?: () => void;
}

export const SessionPlanningWizardSheet = (props: SessionPlanningWizardSheetProps) => {
  const entryContext = useSessionPlanningEntryContext({
    leadId: props.leadId,
    leadName: props.leadName,
    projectId: props.projectId,
    projectName: props.projectName,
    defaultDate: props.defaultDate,
    defaultTime: props.defaultTime,
    entrySource: props.entrySource
  });

  const providerKey = useMemo(() => JSON.stringify(entryContext), [entryContext]);

  return (
    <SessionPlanningProvider key={providerKey} entryContext={entryContext}>
      <SessionPlanningWizardSheetInner {...props} entryContext={entryContext} />
    </SessionPlanningProvider>
  );
};

const SessionPlanningWizardSheetInner = ({
  isOpen,
  onOpenChange,
  onSessionScheduled,
  entryContext
}: Pick<SessionPlanningWizardSheetProps, "isOpen" | "onOpenChange" | "onSessionScheduled"> & {
  entryContext: SessionPlanningEntryContext;
}) => {
  const { state } = useSessionPlanningContext();
  const { reset, markSaving, markSaved, applyState } = useSessionPlanningActions();
  const { toast } = useToast();
  const [isCompleting, setIsCompleting] = useState(false);
  const { t } = useTranslation("sessionPlanning");
  const { triggerSessionScheduled } = useWorkflowTriggers();
  const { scheduleSessionReminders } = useSessionReminderScheduling();
  const [showGuardDialog, setShowGuardDialog] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<SessionPlanningDraft | null>(null);
  const draftKeyRef = useRef<string | null>(null);
  const skipNextSaveRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

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

  const handleClose = () => {
    if (state.meta.isDirty) {
      setShowGuardDialog(true);
      return;
    }
    if (draftKeyRef.current) {
      localStorage.removeItem(draftKeyRef.current);
    }
    reset(entryContext);
    onOpenChange(false);
  };

  const handleDiscardDraft = () => {
    setShowGuardDialog(false);
    if (draftKeyRef.current) {
      localStorage.removeItem(draftKeyRef.current);
    }
    reset(entryContext);
    onOpenChange(false);
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
    let leadId = state.lead.mode === "existing" ? state.lead.id || entryContext.leadId : undefined;
    let leadName = state.lead.name || entryContext.leadName || "";
    const sessionDate = state.schedule.date || entryContext.defaultDate || "";
    const sessionTime = state.schedule.time || entryContext.defaultTime || "";
    let projectId = state.project.mode === "existing" ? state.project.id || entryContext.projectId : undefined;

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
          notes: state.lead.notes
        });
        leadId = newLead.id;
        leadName = newLead.name;
      } catch (error: any) {
        toast({
          title: t("steps.lead.createErrorTitle"),
          description: error.message,
          variant: "destructive"
        });
        return;
      }
    }

    if (!leadId) {
      toast({
        title: t("validation.missingLead"),
        variant: "destructive"
      });
      return;
    }

    if (state.project.mode === "new") {
      if (!state.project.name?.trim()) {
        toast({
          title: t("steps.project.missingName"),
          variant: "destructive"
        });
        return;
      }
      try {
        const newProject = await createProject({
          leadId,
          name: state.project.name,
          description: state.project.description
        });
        projectId = newProject.id;
      } catch (error: any) {
        toast({
          title: t("steps.project.createErrorTitle"),
          description: error.message,
          variant: "destructive"
        });
        return;
      }
    }

    if (!sessionDate || !sessionTime) {
      toast({
        title: t("validation.missingSchedule"),
        variant: "destructive"
      });
      return;
    }

    const sessionName =
      (state.sessionName || "").trim() ||
      state.sessionTypeLabel ||
      (leadName ? `${leadName} Session` : undefined) ||
      t("summary.untitled");

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
          projectId,
          status: "planned"
        },
        {
          updateLeadStatus: !projectId,
          createActivity: !projectId
        }
      );

      try {
        await triggerSessionScheduled(sessionId, organizationId, {
          session_date: sessionDate,
          session_time: sessionTime,
          location: state.location,
          client_name: leadName,
          lead_id: leadId,
          project_id: projectId,
          status: "planned"
        });
      } catch (workflowError) {
        console.error("Error triggering session workflow", workflowError);
        toast({
          title: t("toast.sessionWorkflowWarningTitle"),
          description: t("toast.sessionWorkflowWarningDescription")
        });
      }

      try {
        await scheduleSessionReminders(sessionId);
      } catch (reminderError) {
        console.error("Error scheduling session reminders", reminderError);
      }

      toast({
        title: t("toast.sessionCreatedTitle"),
        description: t("toast.sessionCreatedDescription")
      });

      onSessionScheduled?.();
      if (draftKeyRef.current) {
        localStorage.removeItem(draftKeyRef.current);
      }
      reset(entryContext);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating session via wizard", error);
      toast({
        title: t("toast.sessionCreationFailedTitle"),
        description: error.message || t("toast.sessionCreationFailedDescription"),
        variant: "destructive"
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
        <SessionPlanningWizard onCancel={handleClose} onComplete={handleComplete} isCompleting={isCompleting} />
      </AppSheetModal>

      <AlertDialog open={showGuardDialog} onOpenChange={setShowGuardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("guardrail.unsavedTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("guardrail.unsavedDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("guardrail.stay")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardDraft}>
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
