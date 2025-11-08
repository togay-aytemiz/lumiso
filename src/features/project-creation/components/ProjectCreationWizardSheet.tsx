import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { ProjectCreationProvider } from "../context/ProjectCreationProvider";
import { ProjectCreationWizard } from "./ProjectCreationWizard";
import { useProjectCreationActions } from "../hooks/useProjectCreationActions";
import { useProjectCreationContext } from "../hooks/useProjectCreationContext";
import { ProjectCreationStepId, type ProjectServiceLineItem } from "../types";
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
import { useNavigate } from "react-router-dom";
import { calculateLineItemPricing } from "@/features/package-creation/utils/lineItemPricing";
import { computeDepositAmount, type ProjectDepositConfig } from "@/lib/payments/depositUtils";

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
  const allServiceItems = useMemo(
    () => [...state.services.includedItems, ...state.services.extraItems],
    [state.services.includedItems, state.services.extraItems]
  );
  const { reset } = useProjectCreationActions();
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const { t: tProject } = useTranslation("projectCreation");
  const { t: tForms } = useTranslation("forms");
  const { t: tCommon } = useTranslation("common");
  const { currentStep, shouldLockNavigation, completeCurrentStep } = useOnboarding();
  const openedRef = useRef(false);
  const [showGuardDialog, setShowGuardDialog] = useState(false);
  const navigate = useNavigate();

  const forceClose = useCallback(() => {
    onOpenChange(false);
    reset(state.meta.initialEntryContext);
    setIsCreating(false);
    openedRef.current = false;
    setShowGuardDialog(false);
  }, [onOpenChange, reset, state.meta.initialEntryContext]);

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
      const manualDepositAmount = parseManualDepositAmount(state.details.depositAmount);
      let packageDepositConfig: ProjectDepositConfig | null = null;

      if (!manualDepositAmount && state.services.packageId) {
        const { data: packageRecord, error: packageError } = await supabase
          .from("packages")
          .select("pricing_metadata")
          .eq("id", state.services.packageId)
          .single();
        if (packageError) {
          console.error("Error fetching package deposit metadata:", packageError);
        } else {
          packageDepositConfig = buildDepositConfigFromPackageMetadata(
            packageRecord?.pricing_metadata ?? null
          );
        }
      }

      const projectDepositConfig = manualDepositAmount
        ? { mode: "fixed", value: manualDepositAmount }
        : packageDepositConfig;

      const extrasTotalGross = computeExtraServicesTotal(state.services.extraItems);
      const calculatedDepositAmount =
        projectDepositConfig != null
          ? computeDepositAmount(projectDepositConfig, {
              basePrice: basePriceValue,
              extrasTotal: extrasTotalGross,
              contractTotal: basePriceValue + extrasTotalGross,
            })
          : 0;

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
          deposit_config: projectDepositConfig ?? null,
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

      if (projectDepositConfig && calculatedDepositAmount > 0) {
        const depositDescription =
          projectDepositConfig.due_label ??
          tForms("payments.types.deposit_due", { defaultValue: "Deposit (due)" });
        const { error: depositDueError } = await supabase.from("payments").insert({
          project_id: newProject.id,
          user_id: user.id,
          organization_id: organizationId,
          amount: calculatedDepositAmount,
          description: depositDescription,
          status: "due",
          type: "deposit_due",
        });

        if (depositDueError) throw depositDueError;
      }

      const catalogLineItems = allServiceItems.filter(
        (item) => item.type === "existing" && item.serviceId
      );

      if (catalogLineItems.length > 0) {
        const servicePayload = catalogLineItems.map((item) => ({
          project_id: newProject.id,
          service_id: item.serviceId!,
          user_id: user.id,
        }));

        const { error: servicesError } = await supabase
          .from("project_services")
          .insert(servicePayload);

        if (servicesError) throw servicesError;
      }

      toast({
        title: tCommon("actions.success"),
        description: (
          <div className="space-y-2">
            <p>{tCommon("messages.success.project_created")}</p>
            <button
              type="button"
              className="text-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none"
              onClick={() => navigate(`/projects/${newProject.id}`)}
            >
              {tCommon("buttons.view_project")}
            </button>
          </div>
        ),
        className: "flex-col items-start",
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
        serviceCount: catalogLineItems.length,
        basePrice: basePriceValue,
      });
      onProjectCreated?.({
        id: newProject.id,
        name: state.details.name?.trim(),
      });
      forceClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : undefined;
      trackEvent("project_wizard_error", {
        message,
        entrySource,
      });
      toast({
        title: tCommon("labels.error"),
        description:
          message ??
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
    state.details.depositAmount,
    state.details.description,
    state.details.name,
    state.details.projectTypeId,
    state.details.statusId,
    state.lead.id,
    state.meta.defaultStatusId,
    state.meta.entrySource,
    allServiceItems,
    state.services.extraItems,
    state.services.packageId,
    tCommon,
    tForms,
    tProject,
    toast,
    navigate,
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

const parseManualDepositAmount = (value?: string): number | null =>
  normalizePositiveNumber(value);

const normalizePositiveNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    return Math.round(value * 100) / 100;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const normalized = Number.parseFloat(trimmed.replace(",", "."));
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return null;
    }
    return Math.round(normalized * 100) / 100;
  }
  return null;
};

const mapPackageDepositMode = (raw: unknown): ProjectDepositConfig["mode"] | null => {
  if (raw === "fixed") return "fixed";
  if (raw === "percent_base") return "percent_base";
  if (raw === "percent_subtotal" || raw === "percent_total") return "percent_total";
  return null;
};

const buildDepositConfigFromPackageMetadata = (
  metadata: unknown
): ProjectDepositConfig | null => {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const record = metadata as Record<string, unknown>;
  if (!record["enableDeposit"]) {
    return null;
  }
  const mode = mapPackageDepositMode(record["depositMode"]);
  if (!mode) {
    return null;
  }

  if (mode === "fixed") {
    const fixedValue =
      normalizePositiveNumber(record["depositValue"]) ??
      normalizePositiveNumber(record["depositAmount"]);
    return fixedValue ? { mode, value: fixedValue } : null;
  }

  const percentValue = normalizePositiveNumber(record["depositValue"]);
  if (percentValue) {
    return { mode, value: percentValue };
  }

  const fallbackAmount = normalizePositiveNumber(record["depositAmount"]);
  if (fallbackAmount) {
    return { mode: "fixed", value: fallbackAmount };
  }

  return null;
};

const computeExtraServicesTotal = (items: ProjectServiceLineItem[]): number =>
  items.reduce((sum, item) => {
    const pricing = calculateLineItemPricing(item);
    return sum + pricing.gross;
  }, 0);
