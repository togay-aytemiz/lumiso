import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { ProjectCreationProvider } from "../context/ProjectCreationProvider";
import { ProjectCreationWizard } from "./ProjectCreationWizard";
import { useProjectCreationActions } from "../hooks/useProjectCreationActions";
import { useProjectCreationContext } from "../hooks/useProjectCreationContext";
import { ProjectCreationStepId, type ProjectServiceLineItem } from "../types";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { syncProjectOutstandingPayment } from "@/lib/payments/outstanding";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "react-i18next";
import { trackEvent } from "@/lib/telemetry";
import { useOnboarding } from "@/contexts/useOnboarding";
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
import {
  computeDepositAmount,
  parseDepositConfig,
  type ProjectDepositConfig,
} from "@/lib/payments/depositUtils";
import {
  buildProjectPackageSnapshot,
  parseProjectPackageSnapshot,
  type ProjectPackageSnapshot,
} from "@/lib/projects/projectPackageSnapshot";
import {
  fetchProjectServiceRecords,
  type ProjectServiceRecord,
} from "@/lib/services/projectServiceRecords";
import { Loader2 } from "lucide-react";
import {
  buildDeliverySnapshotFromState,
  deriveDeliveryStateFromSnapshot,
  createDefaultProjectDeliveryState,
} from "../state/projectDeliveryState";

interface ProjectCreationWizardSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string;
  leadName?: string;
  entrySource?: string;
  defaultStatusId?: string | null;
  startStepOverride?: ProjectCreationStepId;
  onProjectCreated?: (project?: { id: string; name?: string }) => void;
  projectId?: string;
  mode?: "create" | "edit";
  leadLocked?: boolean;
  onProjectUpdated?: (project?: { id: string; name?: string }) => void;
}

type PackageRow = Database["public"]["Tables"]["packages"]["Row"];

export const ProjectCreationWizardSheet = ({
  isOpen,
  onOpenChange,
  leadId,
  leadName,
  entrySource,
  defaultStatusId,
  startStepOverride,
  onProjectCreated,
  projectId,
  mode,
  leadLocked,
  onProjectUpdated,
}: ProjectCreationWizardSheetProps) => {
  const resolvedMode = mode ?? (projectId ? "edit" : "create");
  const resolvedLeadLocked =
    typeof leadLocked === "boolean" ? leadLocked : resolvedMode === "edit";
  const entryContext = useMemo(
    () => ({
      leadId,
      leadName,
      entrySource,
      defaultStatusId: defaultStatusId ?? undefined,
      startStepOverride,
      projectId,
      mode: resolvedMode,
      leadLocked: resolvedLeadLocked,
    }),
    [
      leadId,
      leadName,
      entrySource,
      defaultStatusId,
      startStepOverride,
      projectId,
      resolvedMode,
      resolvedLeadLocked,
    ]
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
        projectId={projectId}
        onProjectUpdated={onProjectUpdated}
      />
    </ProjectCreationProvider>
  );
};

const ProjectCreationWizardSheetInner = ({
  isOpen,
  onOpenChange,
  onProjectCreated,
  projectId,
  onProjectUpdated,
}: Pick<
  ProjectCreationWizardSheetProps,
  "isOpen" | "onOpenChange" | "onProjectCreated" | "projectId" | "onProjectUpdated"
>) => {
  const { state } = useProjectCreationContext();
  const { reset, updateLead, updateDetails, updateServices, updateDelivery, markDirty } =
    useProjectCreationActions();
  const [isCreating, setIsCreating] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const { toast } = useToast();
  const { t: tProject } = useTranslation("projectCreation");
  const { t: tCommon } = useTranslation("common");
  const { currentStep, shouldLockNavigation } = useOnboarding();
  const openedRef = useRef(false);
  const [showGuardDialog, setShowGuardDialog] = useState(false);
  const navigate = useNavigate();
  const isEditMode = state.meta.mode === "edit";
  const sheetTitle = isEditMode
    ? tProject("wizard.editTitle", { defaultValue: "Proje düzenle" })
    : tProject("wizard.title");
  const [headerActionElement, setHeaderActionElement] =
    useState<HTMLDivElement | null>(null);
  const handleHeaderActionRef = useCallback((node: HTMLDivElement | null) => {
    setHeaderActionElement(node);
  }, []);

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

  useEffect(() => {
    if (!isOpen || !projectId) {
      setIsHydrating(false);
      return;
    }
    let cancelled = false;
    setIsHydrating(true);

    (async () => {
      try {
        const { data: projectData, error } = await supabase
          .from<Database["public"]["Tables"]["projects"]["Row"]>("projects")
          .select(
            "id, lead_id, name, description, status_id, project_type_id, base_price, deposit_config, package_id, package_snapshot"
          )
          .eq("id", projectId)
          .single();
        if (error) throw error;

        const [serviceRecords, leadResult] = await Promise.all([
          fetchProjectServiceRecords(projectId),
          supabase
            .from<Database["public"]["Tables"]["leads"]["Row"]>("leads")
            .select("id, name")
            .eq("id", projectData.lead_id)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        const snapshot = parseProjectPackageSnapshot(projectData.package_snapshot);
        const includedItems = serviceRecords
          .filter((record) => record.billingType === "included")
          .map(mapServiceRecordToLineItem);
        const extraItems = serviceRecords
          .filter((record) => record.billingType === "extra")
          .map(mapServiceRecordToLineItem);

        updateLead(
          {
            id: projectData.lead_id,
            name: leadResult.data?.name ?? state.meta.initialEntryContext?.leadName,
            mode: "existing",
          },
          { markDirty: false }
        );
        updateDetails(
          {
            name: projectData.name,
            description: projectData.description ?? undefined,
            projectTypeId: projectData.project_type_id ?? undefined,
            statusId: projectData.status_id ?? undefined,
            basePrice:
              typeof projectData.base_price === "number"
                ? String(projectData.base_price)
                : undefined,
            depositAmount: deriveManualDepositInput(projectData.deposit_config),
          },
          { markDirty: false }
        );
        updateServices(
          {
            includedItems,
            extraItems,
            packageId: projectData.package_id ?? undefined,
            packageLabel: snapshot?.name,
            showCustomSetup: !projectData.package_id,
          },
          { markDirty: false }
        );
        updateDelivery(
          snapshot?.delivery
            ? deriveDeliveryStateFromSnapshot(snapshot.delivery)
            : createDefaultProjectDeliveryState(),
          { markDirty: false }
        );
        markDirty(false);
      } catch (error) {
        if (cancelled) return;
        console.error("Error hydrating project wizard:", error);
        toast({
          title: tCommon("labels.error"),
          description:
            error instanceof Error
              ? error.message
              : tCommon("messages.error.generic", {
                  defaultValue: "Something went wrong. Please try again.",
                }),
          variant: "destructive",
        });
        forceClose();
      } finally {
        if (!cancelled) {
          setIsHydrating(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    forceClose,
    isOpen,
    markDirty,
    projectId,
    state.meta.initialEntryContext?.leadName,
    tCommon,
    toast,
    updateDetails,
    updateLead,
    updateServices,
    updateDelivery,
  ]);

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
    const editingProjectId = projectId ?? null;

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
      let packageRecord: PackageRow | null = null;
      let packageSnapshotPayload: ProjectPackageSnapshot | null = null;

      if (state.services.packageId) {
        const { data, error } = await supabase
          .from<PackageRow>("packages")
          .select(
            "id, name, description, price, client_total, line_items, delivery_estimate_type, delivery_photo_count_min, delivery_photo_count_max, delivery_lead_time_unit, delivery_lead_time_value, delivery_methods, include_addons_in_price, pricing_metadata"
          )
          .eq("id", state.services.packageId)
          .single();

        if (error) {
          console.error("Error fetching package metadata:", error);
        } else if (data) {
          packageRecord = data;
          packageSnapshotPayload = buildProjectPackageSnapshot(data);
          if (!manualDepositAmount) {
            packageDepositConfig = buildDepositConfigFromPackageMetadata(
              data.pricing_metadata ?? null
            );
          }
        }
      }

      const projectDepositConfig = manualDepositAmount
        ? { mode: "fixed", value: manualDepositAmount }
        : packageDepositConfig;

      const extrasTotalGross = computeExtraServicesTotal(state.services.extraItems);
      const contractTotal = basePriceValue + extrasTotalGross;
      const deliveryState = state.delivery ?? createDefaultProjectDeliveryState();
      const calculatedDepositAmount =
        projectDepositConfig != null
          ? computeDepositAmount(projectDepositConfig, {
              basePrice: basePriceValue,
              extrasTotal: extrasTotalGross,
              contractTotal,
            })
          : 0;

      const depositConfigPayload =
        projectDepositConfig && calculatedDepositAmount > 0
          ? {
              ...projectDepositConfig,
              snapshot_amount: calculatedDepositAmount,
              snapshot_total: contractTotal,
              snapshot_locked_at: new Date().toISOString(),
              snapshot_acknowledged_amount: calculatedDepositAmount,
            }
          : projectDepositConfig ?? null;

      const toNumberOrNull = (value: unknown) =>
        typeof value === "number" && Number.isFinite(value) ? value : null;

      const buildServicePayloadTemplate = (
        items: ProjectServiceLineItem[],
        billingType: "included" | "extra"
      ) =>
        items
          .filter((item): item is ProjectServiceLineItem & { serviceId: string } => {
            return item.type === "existing" && typeof item.serviceId === "string";
          })
          .map((item) => {
            const quantity = Math.max(1, Number(item.quantity ?? 1));
            return {
              service_id: item.serviceId,
              billing_type: billingType,
              quantity,
              unit_cost_override: toNumberOrNull(item.unitCost),
              unit_price_override: toNumberOrNull(item.unitPrice),
              vat_mode_override: item.vatMode ?? null,
              vat_rate_override: toNumberOrNull(item.vatRate),
            };
          });

      const servicePayloadTemplate = [
        ...buildServicePayloadTemplate(state.services.includedItems, "included"),
        ...buildServicePayloadTemplate(state.services.extraItems, "extra"),
      ];

      const persistProjectServices = async (targetProjectId: string) => {
        const payload = servicePayloadTemplate.map((item) => ({
          ...item,
          project_id: targetProjectId,
          user_id: user.id,
        }));
        await supabase.from("project_services").delete().eq("project_id", targetProjectId);
        if (payload.length > 0) {
          const { error: servicesError } = await supabase.from("project_services").insert(payload);
          if (servicesError) throw servicesError;
        }
      };

      const deliverySnapshot = buildDeliverySnapshotFromState(
        deliveryState,
        packageSnapshotPayload?.delivery ?? null
      );

      if (deliverySnapshot || packageSnapshotPayload) {
        if (!packageSnapshotPayload) {
          const fallbackName =
            state.services.packageLabel ??
            state.details.name ??
            tProject("summary.values.customServices");
          packageSnapshotPayload = {
            id: state.services.packageId ?? "custom-delivery",
            name: fallbackName ?? "Custom delivery",
            description: state.details.description ?? null,
            price: basePriceValue || null,
            clientTotal: contractTotal || null,
            includeAddOnsInPrice: null,
            delivery: deliverySnapshot,
            lineItems: [],
          };
        } else {
          packageSnapshotPayload = {
            ...packageSnapshotPayload,
            delivery: deliverySnapshot,
          };
        }
      }

      if (editingProjectId) {
        const { error: updateError } = await supabase
          .from("projects")
          .update({
            name: state.details.name?.trim(),
            description: state.details.description?.trim() || null,
            status_id: statusId,
            project_type_id: state.details.projectTypeId,
            base_price: basePriceValue,
            deposit_config: depositConfigPayload,
            package_id: packageRecord?.id ?? state.services.packageId ?? null,
            package_snapshot: packageSnapshotPayload,
          })
          .eq("id", editingProjectId);
        if (updateError) throw updateError;

        await persistProjectServices(editingProjectId);

        await syncProjectOutstandingPayment({
          projectId: editingProjectId,
          organizationId,
          userId: user.id,
          contractTotalOverride: contractTotal,
          description: state.details.name ? `Outstanding balance — ${state.details.name}` : undefined,
        });

        toast({
          title: tCommon("actions.success"),
          description: tCommon("messages.success.project_updated", {
            defaultValue: "Project updated successfully.",
          }),
        });

        trackEvent("project_wizard_updated", {
          projectId: editingProjectId,
          entrySource,
          packageId: state.services.packageId ?? null,
          serviceCount: servicePayloadTemplate.length,
          basePrice: basePriceValue,
        });

        onProjectUpdated?.({
          id: editingProjectId,
          name: state.details.name?.trim(),
        });
        forceClose();
        return;
      }

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
          deposit_config: depositConfigPayload,
          package_id: packageRecord?.id ?? state.services.packageId ?? null,
          package_snapshot: packageSnapshotPayload,
        })
        .select("id")
        .single();

      if (projectError) throw projectError;

      await persistProjectServices(newProject.id);

      await syncProjectOutstandingPayment({
        projectId: newProject.id,
        organizationId,
        userId: user.id,
        contractTotalOverride: contractTotal,
        description: state.details.name ? `Outstanding balance — ${state.details.name}` : undefined,
      });

      toast({
        title: tCommon("actions.success"),
        description: (
          <div className="space-y-2">
            <p>{tCommon("messages.success.project_created")}</p>
            <button
              type="button"
              className="text-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none"
              onClick={() => {
                const url =
                  shouldLockNavigation && currentStep >= 2
                    ? `/projects/${newProject.id}?onboarding=project-details`
                    : `/projects/${newProject.id}`;
                navigate(url);
              }}
            >
              {tCommon("buttons.view_project")}
            </button>
          </div>
        ),
        className: "flex-col items-start",
      });

      if (!editingProjectId && shouldLockNavigation && currentStep <= 2) {
        try {
          // Advance through project-related missions without skipping the projects page exploration
          const stepsToComplete = Math.max(0, 3 - currentStep);
          if (stepsToComplete > 0) {
            await completeMultipleSteps(stepsToComplete);
          }
        } catch (error) {
          console.error("Failed to complete onboarding step:", error);
        }
      }

      trackEvent("project_wizard_completed", {
        projectId: newProject.id,
        entrySource,
        packageId: state.services.packageId ?? null,
        serviceCount: servicePayloadTemplate.length,
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
        mode: editingProjectId ? "edit" : "create",
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
    currentStep,
    forceClose,
    onProjectCreated,
    onProjectUpdated,
    projectId,
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
    state.services.includedItems,
    state.services.extraItems,
    state.services.packageId,
    state.services.packageLabel,
    state.delivery,
    tCommon,
    tProject,
    toast,
    navigate,
    validateBeforeSubmit,
  ]);

  return (
    <>
      <AppSheetModal
        title={sheetTitle}
        isOpen={isOpen}
        onOpenChange={handleModalOpenChange}
        size="xl"
        mobileHeightClass="max-h-[95vh]"
        mobileMinHeightClass="min-h-[95vh]"
        dirty={state.meta.isDirty}
        onDirtyClose={requestClose}
        headerAccessory={
          <div
            ref={handleHeaderActionRef}
            className="flex w-full flex-wrap items-center justify-end gap-2"
          />
        }
      >
        {isOpen ? (
          <div className="flex h-full flex-col">
            {isHydrating ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>
                  {tProject("wizard.loadingProject", {
                    defaultValue: "Loading project...",
                  })}
                </span>
              </div>
            ) : (
              <ProjectCreationWizard
                onComplete={handleComplete}
                onCancel={requestClose}
                isCompleting={isCreating}
                actionPlacement="header"
                headerActionContainer={headerActionElement}
              />
            )}
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

const mapServiceRecordToLineItem = (
  record: ProjectServiceRecord
): ProjectServiceLineItem => ({
  id: record.projectServiceId,
  type: "existing",
  serviceId: record.service.id,
  name: record.service.name,
  quantity: record.quantity,
  unitCost: record.overrides.unitCost ?? record.service.cost_price ?? undefined,
  unitPrice:
    record.overrides.unitPrice ??
    record.service.selling_price ??
    record.service.price ??
    undefined,
  vatRate: record.overrides.vatRate ?? record.service.vat_rate ?? undefined,
  vatMode:
    record.overrides.vatMode ??
    (record.service.price_includes_vat === false ? "exclusive" : "inclusive"),
  source: "catalog",
});

const deriveManualDepositInput = (rawConfig: unknown): string | undefined => {
  const parsed = parseDepositConfig(rawConfig as Json | null | undefined);
  if (parsed.mode === "fixed" && typeof parsed.value === "number" && parsed.value > 0) {
    return String(parsed.value);
  }
  return undefined;
};
