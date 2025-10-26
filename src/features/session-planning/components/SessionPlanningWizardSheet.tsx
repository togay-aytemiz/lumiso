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

  const handleClose = () => {
    if (state.meta.isDirty && typeof window !== "undefined") {
      const shouldDiscard = window.confirm(t("wizard.discardPrompt"));
      if (!shouldDiscard) {
        return;
      }
    }
    reset(entryContext);
    onOpenChange(false);
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      console.log("Session planning draft", state);
      toast({
        title: t("toast.draftCapturedTitle"),
        description: t("toast.draftCapturedDescription")
      });
      onSessionScheduled?.();
      reset(entryContext);
      onOpenChange(false);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <AppSheetModal
      title={t("wizard.title")}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="wide"
      dirty={state.meta.isDirty}
      onDirtyClose={handleClose}
    >
      <SessionPlanningWizard onCancel={handleClose} onComplete={handleComplete} isCompleting={isCompleting} />
    </AppSheetModal>
  );
};
