import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { ProjectCreationProvider } from "../context/ProjectCreationProvider";
import { ProjectCreationWizard } from "./ProjectCreationWizard";
import { useProjectCreationActions } from "../hooks/useProjectCreationActions";
import { useProjectCreationContext } from "../hooks/useProjectCreationContext";
import { ProjectCreationStepId } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "react-i18next";
import { trackEvent } from "@/lib/telemetry";
import { useOnboarding } from "@/contexts/OnboardingContext";
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

interface ProjectCreationWizardSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string;
  leadName?: string;
  entrySource?: string;
  defaultStatusId?: string | null;
  startStepOverride?: ProjectCreationStepId;
  onProjectCreated?: (project?: { id: string; name?: string }) => void;
}

export const ProjectCreationWizardSheet = ({
  isOpen,
  onOpenChange,
  leadId,
  leadName,
  entrySource,
  defaultStatusId,
  startStepOverride,
  onProjectCreated,
}: ProjectCreationWizardSheetProps) => {
  const entryContext = useMemo(
    () => ({
      leadId,
      leadName,
      entrySource,
      defaultStatusId: defaultStatusId ?? undefined,
      startStepOverride,
    }),
    [leadId, leadName, entrySource, defaultStatusId, startStepOverride]
  );

  const providerKey = useMemo(
    () => JSON.stringify(entryContext),
    [entryContext]
  );

  return (
    <ProjectCreationProvider key={providerKey} entryContext={entryContext}>
      <ProjectCreationWizardSheetInner
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        onProjectCreated={onProjectCreated}
      />
    </ProjectCreationProvider>
  );
};

const ProjectCreationWizardSheetInner = ({
  isOpen,
  onOpenChange,
  onProjectCreated,
}: Pick<ProjectCreationWizardSheetProps, "isOpen" | "onOpenChange" | "onProjectCreated">) => {
  const { state } = useProjectCreationContext();
  const { reset } = useProjectCreationActions();
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const { t: tProject } = useTranslation("projectCreation");
  const { t: tForms } = useTranslation("forms");
  const { t: tCommon } = useTranslation("common");
  const { currentStep, shouldLockNavigation, completeCurrentStep } = useOnboarding();
  const openedRef = useRef(false);
  const [showGuardDialog, setShowGuardDialog] = useState(false);

  const forceClose = useCallback(() => {
    onOpenChange(false);
    reset();
    setIsCreating(false);
    openedRef.current = false;
    setShowGuardDialog(false);
  }, [onOpenChange, reset]);

  const requestClose = useCallback(() => {
    if (state.meta.isDirty) {
      setShowGuardDialog(true);
      return;
    }
    forceClose();
  }, [forceClose, state.meta.isDirty]);

  const handleModalOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        onOpenChange(true);
        return;
      }
      requestClose();
    },
    [onOpenChange, requestClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (openedRef.current) return;
    openedRef.current = true;
    trackEvent("project_wizard_opened", {
      entrySource: state.meta.entrySource ?? "direct",
    });
  }, [isOpen, state.meta.entrySource]);

  const validateBeforeSubmit = useCallback(() => {
    if (!state.lead.id) {
      toast({
        title: tProject("validation.lead.title"),
        description: tProject("validation.lead.description"),
        variant: "destructive",
      });
      return false;
    }

    if (!state.details.name?.trim() || !state.details.projectTypeId) {
      toast({
        title: tProject("validation.details.title"),
        description: tProject("validation.details.description"),
        variant: "destructive",
      });
      return false;
    }

    return true;
  }, [state.lead.id, state.details.name, state.details.projectTypeId, toast, tProject]);

  const handleComplete = useCallback(async () => {
    if (!validateBeforeSubmit()) {
      return;
    }

    setIsCreating(true);
    const entrySource = state.meta.entrySource ?? "direct";

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error(
          tCommon("messages.error.auth_required", {
            defaultValue: "You need to be signed in to create a project.",
          })
        );
      }

      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error(
          tCommon("messages.error.organization_required", {
            defaultValue: "Select an active organization before creating a project.",
          })
        );
      }

      let statusId = state.details.statusId ?? state.meta.defaultStatusId ?? undefined;
      if (!statusId) {
        const { data: defaultStatus, error: statusError } = await supabase.rpc(
          "get_default_project_status",
          { user_uuid: user.id }
        );
        if (statusError) throw statusError;
        statusId = defaultStatus ?? undefined;
      }

      if (!statusId) {
        throw new Error(
          tProject("validation.details.description", {
            defaultValue: "Enter the required project details before continuing.",
          })
        );
      }

      const basePriceValue = parseFloat(state.details.basePrice ?? "") || 0;

      const { data: newProject, error: projectError } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          lead_id: state.lead.id,
          name: state.details.name?.trim(),
          description: state.details.description?.trim() || null,
          status_id: statusId,
          project_type_id: state.details.projectTypeId,
          base_price: basePriceValue,
        })
        .select("id")
        .single();

      if (projectError) throw projectError;

      if (basePriceValue > 0) {
        const { error: paymentError } = await supabase.from("payments").insert({
          project_id: newProject.id,
          user_id: user.id,
          organization_id: organizationId,
          amount: basePriceValue,
          description: tForms("payments.base_price"),
          status: "due",
          type: "base_price",
        });

        if (paymentError) throw paymentError;
      }

      if (state.services.selectedServiceIds.length > 0) {
        const servicePayload = state.services.selectedServiceIds.map((serviceId) => ({
          project_id: newProject.id,
          service_id: serviceId,
          user_id: user.id,
        }));

        const { error: servicesError } = await supabase
          .from("project_services")
          .insert(servicePayload);

        if (servicesError) throw servicesError;
      }

      toast({
        title: tCommon("actions.success"),
        description: tCommon("messages.success.project_created"),
      });

      if (shouldLockNavigation && currentStep === 3) {
        try {
          await completeCurrentStep();
        } catch (error) {
          console.error("Failed to complete onboarding step:", error);
        }
      }

      trackEvent("project_wizard_completed", {
        projectId: newProject.id,
        entrySource,
        packageId: state.services.packageId ?? null,
        serviceCount: state.services.selectedServiceIds.length,
        basePrice: basePriceValue,
      });
      onProjectCreated?.({
        id: newProject.id,
        name: state.details.name?.trim(),
      });
      forceClose();
    } catch (error: any) {
      trackEvent("project_wizard_error", {
        message: error?.message,
        entrySource,
      });
      toast({
        title: tCommon("labels.error"),
        description:
          error?.message ??
          tCommon("messages.error.generic", {
            defaultValue: "Something went wrong. Please try again.",
          }),
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  }, [
    completeCurrentStep,
    currentStep,
    forceClose,
    onProjectCreated,
    shouldLockNavigation,
    state.details.basePrice,
    state.details.description,
    state.details.name,
    state.details.projectTypeId,
    state.details.statusId,
    state.lead.id,
    state.meta.defaultStatusId,
    state.meta.entrySource,
    state.services.packageId,
    state.services.selectedServiceIds,
    tCommon,
    tForms,
    tProject,
    toast,
    validateBeforeSubmit,
  ]);

  return (
    <>
      <AppSheetModal
        title={tProject("wizard.title")}
        isOpen={isOpen}
        onOpenChange={handleModalOpenChange}
        size="xl"
        dirty={state.meta.isDirty}
        onDirtyClose={requestClose}
      >
        {isOpen ? (
          <div className="flex h-full flex-col">
            <ProjectCreationWizard onComplete={handleComplete} isCompleting={isCreating} />
          </div>
        ) : null}
      </AppSheetModal>

      <AlertDialog open={showGuardDialog} onOpenChange={setShowGuardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tProject("guardrail.unsavedTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{tProject("guardrail.unsavedDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tProject("guardrail.stay")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={forceClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tProject("guardrail.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
