import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { FormLoadingSkeleton } from "@/components/ui/loading-presets";
import { PackageCreationProvider } from "../context/PackageCreationProvider";
import { PackageCreationWizard } from "./PackageCreationWizard";
import { PackageCreationEntryContext, PackageCreationStepId } from "../types";
import { usePackageCreationActions } from "../hooks/usePackageCreationActions";
import { usePackageCreationContext } from "../hooks/usePackageCreationContext";
import { NavigationGuardDialog } from "@/components/settings/NavigationGuardDialog";
import { useTranslation } from "react-i18next";
import { usePackageCreationSnapshot } from "../hooks/usePackageCreationSnapshot";
import {
  buildPackageHydrationFromRecord,
  buildPackageUpdatePayload,
} from "../services/packageCreationSnapshot";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

interface PackageCreationWizardSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  entrySource?: string;
  startStepOverride?: PackageCreationStepId;
  onPackageCreated?: () => void;
  packageId?: string | null;
  onPackageUpdated?: () => void;
}

export const PackageCreationWizardSheet = ({
  isOpen,
  onOpenChange,
  entrySource,
  startStepOverride,
  onPackageCreated,
  packageId,
  onPackageUpdated,
}: PackageCreationWizardSheetProps) => {
  const entryContext = useMemo<PackageCreationEntryContext>(() => {
    const context: PackageCreationEntryContext = {
      entrySource,
      mode: packageId ? "edit" : "create",
    };
    const explicitOverride = startStepOverride ?? (packageId ? "summary" : undefined);
    if (explicitOverride) {
      context.startStepOverride = explicitOverride;
    }
    return context;
  }, [entrySource, packageId, startStepOverride]);

  const providerKey = useMemo(
    () => JSON.stringify({ entryContext, packageId: packageId ?? null }),
    [entryContext, packageId]
  );

  return (
    <PackageCreationProvider key={providerKey} entryContext={entryContext}>
      <PackageCreationWizardSheetInner
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        onPackageCreated={onPackageCreated}
        packageId={packageId ?? undefined}
        onPackageUpdated={onPackageUpdated}
      />
    </PackageCreationProvider>
  );
};

const PackageCreationWizardSheetInner = ({
  isOpen,
  onOpenChange,
  onPackageCreated,
  packageId,
  onPackageUpdated,
}: Pick<
  PackageCreationWizardSheetProps,
  "isOpen" | "onOpenChange" | "onPackageCreated" | "packageId" | "onPackageUpdated"
>) => {
  const { state } = usePackageCreationContext();
  const { reset, markDirty, setCurrentStep, hydrate } = usePackageCreationActions();
  const [isCompleting, setIsCompleting] = useState(false);
  const [showGuardDialog, setShowGuardDialog] = useState(false);
  const openedRef = useRef(false);
  const { t } = useTranslation("packageCreation");
  const { snapshot, buildPersistencePayload } = usePackageCreationSnapshot();
  const { activeOrganizationId } = useOrganization();
  const { toast } = useToast();
  const isEditing = Boolean(packageId);
  const [isLoadingPackage, setIsLoadingPackage] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [headerActionElement, setHeaderActionElement] = useState<HTMLDivElement | null>(null);
  const handleHeaderActionRef = useCallback((node: HTMLDivElement | null) => {
    setHeaderActionElement(node);
  }, []);

  const forceClose = useCallback(() => {
    onOpenChange(false);
    reset(state.meta.initialEntryContext);
    markDirty(false);
    setIsCompleting(false);
    openedRef.current = false;
    setShowGuardDialog(false);
    setIsLoadingPackage(false);
    setLoadError(null);
  }, [markDirty, onOpenChange, reset, state.meta.initialEntryContext]);

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

  const loadPackage = useCallback(async () => {
    if (!packageId || !activeOrganizationId) {
      return;
    }

    setIsLoadingPackage(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("packages")
        .select("*")
        .eq("id", packageId)
        .eq("organization_id", activeOrganizationId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("PACKAGE_NOT_FOUND");
      }

      const hydration = buildPackageHydrationFromRecord(
        data as Database["public"]["Tables"]["packages"]["Row"]
      );
      hydrate({
        ...hydration,
        meta: { currentStep: "summary" },
      });
      markDirty(false);
      setCurrentStep("summary");
    } catch (error) {
      console.error("Failed to load package", error);
      setLoadError(
        t("wizard.errors.loadFailed", {
          defaultValue: "We couldn’t load this package. Please try again.",
        })
      );
    } finally {
      setIsLoadingPackage(false);
    }
  }, [packageId, activeOrganizationId, hydrate, markDirty, setCurrentStep, t]);

  useEffect(() => {
    if (!isOpen) return;
    if (openedRef.current) return;
    openedRef.current = true;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isEditing) {
      return;
    }
    loadPackage();
  }, [isOpen, isEditing, loadPackage]);

  const handleComplete = useCallback(async () => {
    if (isCompleting) return;

    if (!snapshot.basics.name?.trim()) {
      toast({
        title: t("common:toast.error"),
        description: t("wizard.errors.nameRequired", {
          defaultValue: "Add a package name before finishing.",
        }),
        variant: "destructive",
      });
      setCurrentStep("basics");
      return;
    }

    if (!snapshot.pricing.basePrice || snapshot.pricing.basePrice <= 0) {
      toast({
        title: t("common:toast.error"),
        description: t("wizard.errors.priceRequired", {
          defaultValue: "Enter a package price greater than zero.",
        }),
        variant: "destructive",
      });
      setCurrentStep("pricing");
      return;
    }

    if (!activeOrganizationId) {
      toast({
        title: t("common:toast.error"),
        description: t("wizard.errors.organizationRequired", {
          defaultValue: "Select an organization before creating packages.",
        }),
        variant: "destructive",
      });
      return;
    }

    setIsCompleting(true);
    try {
      if (isEditing && packageId) {
        const updatePayload = buildPackageUpdatePayload(snapshot, packageId);
        const { error: updateError } = await supabase
          .from("packages")
          .update(updatePayload)
          .eq("id", packageId);

        if (updateError) throw updateError;

        toast({
          title: t("common:toast.success"),
          description: t("wizard.toasts.updated", {
            defaultValue: "Package updated successfully.",
          }),
        });

        onPackageUpdated?.();
        forceClose();
        return;
      }

      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      const user = data.user;
      if (!user) {
        throw new Error("AUTH_REQUIRED");
      }

      const { insert } = buildPersistencePayload({
        userId: user.id,
        organizationId: activeOrganizationId,
      });

      const { error: insertError } = await supabase
        .from("packages")
        .insert(insert);

      if (insertError) throw insertError;

      toast({
        title: t("common:toast.success"),
        description: t("wizard.toasts.created", {
          defaultValue: "Package created successfully.",
        }),
      });

      onPackageCreated?.();
      forceClose();
    } catch (error) {
      console.error("Failed to save package", error);
      toast({
        title: t("common:toast.error"),
        description: isEditing
          ? t("wizard.toasts.updateFailed", {
              defaultValue: "We couldn't update the package. Please try again.",
            })
          : t("wizard.toasts.createFailed", {
              defaultValue: "We couldn't create the package. Please try again.",
            }),
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  }, [
    activeOrganizationId,
    buildPersistencePayload,
    forceClose,
    isCompleting,
    isEditing,
    onPackageCreated,
    onPackageUpdated,
    packageId,
    setCurrentStep,
    snapshot,
    t,
    toast,
  ]);

  return (
    <>
      <AppSheetModal
        title={
          isEditing
            ? t("wizard.titleEdit", "Edit package")
            : t("wizard.title", "Build a new package")
        }
        isOpen={isOpen}
        onOpenChange={handleModalOpenChange}
        size="xl"
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
            {isEditing && isLoadingPackage ? (
              <div className="flex flex-1 flex-col justify-center gap-4 py-8">
                <FormLoadingSkeleton rows={6} />
              </div>
            ) : isEditing && loadError ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
                <p className="max-w-sm text-sm text-muted-foreground">{loadError}</p>
                <Button variant="outline" size="sm" onClick={loadPackage}>
                  {t("wizard.actions.retry", { defaultValue: "Retry" })}
                </Button>
              </div>
            ) : (
              <PackageCreationWizard
                key={isEditing ? packageId ?? "edit" : "create"}
                onComplete={handleComplete}
                isCompleting={isCompleting}
                actionPlacement="header"
                headerActionContainer={headerActionElement}
              />
            )}
          </div>
        ) : null}
      </AppSheetModal>

      <NavigationGuardDialog
        open={showGuardDialog}
        onDiscard={forceClose}
        onStay={() => setShowGuardDialog(false)}
        stayLabel={t("wizard.guard.stay", "Continue editing")}
      />
    </>
  );
};
