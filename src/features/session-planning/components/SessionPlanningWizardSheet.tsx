import { useMemo, useState } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { SessionPlanningProvider } from "../context/SessionPlanningProvider";
import { useSessionPlanningEntryContext } from "../hooks/useSessionPlanningEntryContext";
import { SessionPlanningWizard } from "./SessionPlanningWizard";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useToast } from "@/components/ui/use-toast";
import { SessionPlanningEntryContext } from "../types";
import { useTranslation } from "react-i18next";
import { createSession } from "../api/sessionCreation";
import { createLead, createProject } from "../api/leadProjectCreation";
import { useWorkflowTriggers } from "@/hooks/useWorkflowTriggers";
import { useSessionReminderScheduling } from "@/hooks/useSessionReminderScheduling";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  const { reset } = useSessionPlanningActions();
  const { toast } = useToast();
  const [isCompleting, setIsCompleting] = useState(false);
  const { t } = useTranslation("sessionPlanning");
  const { triggerSessionScheduled } = useWorkflowTriggers();
  const { scheduleSessionReminders } = useSessionReminderScheduling();
  const [showGuardDialog, setShowGuardDialog] = useState(false);

  const handleClose = () => {
    if (false) {
      return;
    }
    reset(entryContext);
    onOpenChange(false);
  };

  const handleDiscardDraft = () => {
    setShowGuardDialog(false);
    reset(entryContext);
    onOpenChange(false);
  };

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
        dirty={false}
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
            <AlertDialogAction
              
              onClick={handleDiscardDraft}
            >
              {t("guardrail.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
