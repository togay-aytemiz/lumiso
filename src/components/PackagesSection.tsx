import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useI18nToast } from "@/lib/toastHelpers";
import { supabase } from "@/integrations/supabase/client";
import SettingsSection from "./SettingsSection";
import { FormLoadingSkeleton } from "@/components/ui/loading-presets";
// Permissions removed for single photographer mode
import { usePackages, useServices } from "@/hooks/useOrganizationData";
import { useQueryClient } from "@tanstack/react-query";
import { useCommonTranslation } from "@/hooks/useTypedTranslation";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useTranslation } from "react-i18next";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { IconActionButtonGroup } from "@/components/ui/icon-action-button-group";
import { Switch } from "@/components/ui/switch";
import { PackageCreationWizardSheet } from "@/features/package-creation";

interface Package {
  id: string;
  name: string;
  description?: string;
  price: number;
  client_total?: number | null;
  applicable_types: string[];
  default_add_ons: string[] | null;
  is_active: boolean;
  include_addons_in_price?: boolean | null;
  line_items: unknown;
  pricing_metadata?: {
    enableDeposit?: boolean;
    depositAmount?: number;
    depositMode?: "percent_subtotal" | "percent_base" | "fixed";
    depositValue?: number;
    depositTarget?: "subtotal" | "base" | null;
  } | null;
}

type LineItemLookup = {
  byId: Map<string, number>;
  byName: Map<string, number>;
};

const normalizeQuantity = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value);
    return rounded > 0 ? rounded : undefined;
  }

  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      const rounded = Math.round(parsed);
      return rounded > 0 ? rounded : undefined;
    }
  }

  return undefined;
};

const buildLineItemLookup = (
  lineItems: unknown,
  serviceIdByNameMap: Map<string, string>
): LineItemLookup => {
  const lookup: LineItemLookup = {
    byId: new Map<string, number>(),
    byName: new Map<string, number>(),
  };

  if (!Array.isArray(lineItems)) {
    return lookup;
  }

  for (const entry of lineItems as unknown[]) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;

    const quantity = normalizeQuantity(record.quantity);
    if (!quantity) continue;

    const rawServiceId =
      typeof record.serviceId === "string" && record.serviceId.trim().length
        ? record.serviceId.trim()
        : undefined;

    if (rawServiceId) {
      lookup.byId.set(rawServiceId, quantity);
      continue;
    }

    const rawNameCandidate =
      typeof record.name === "string" && record.name.trim().length
        ? record.name.trim()
        : typeof record.service === "string" && record.service.trim().length
        ? record.service.trim()
        : undefined;

    if (!rawNameCandidate) continue;

    const resolvedId = serviceIdByNameMap.get(rawNameCandidate);
    if (resolvedId) {
      lookup.byId.set(resolvedId, quantity);
    } else {
      lookup.byName.set(rawNameCandidate, quantity);
    }
  }

  return lookup;
};

const PackagesSection = () => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<Package | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const toast = useI18nToast();
  const { t } = useTranslation('forms');
  const { t: tCommon } = useCommonTranslation();
  const unknownServiceLabel = t('packages.unknown_service');
  // Permissions removed for single photographer mode - always allow
  const { activeOrganizationId } = useOrganization();
  const queryClient = useQueryClient();
  const passiveBadgeLabel = tCommon('status.passive_badge');
  
  // Use cached data
  const { data: packages = [], isLoading, error } = usePackages();
  const { data: services = [] } = useServices();

  const serviceNameMap = useMemo(() => {
    const map = new Map<string, string>();
    services.forEach((service) => {
      if (service?.id && service?.name) {
        map.set(service.id, service.name);
      }
    });
    return map;
  }, [services]);

  const serviceIdByNameMap = useMemo(() => {
    const map = new Map<string, string>();
    services.forEach((service) => {
      if (service?.id && service?.name) {
        map.set(service.name, service.id);
        const trimmed = service.name.trim();
        if (trimmed !== service.name) {
          map.set(trimmed, service.id);
        }
      }
    });
    return map;
  }, [services]);

  const handleDeleteClick = (pkg: Package) => {
    setPackageToDelete(pkg);
    setDeleteConfirmOpen(true);
  };

  const handleDeletePackage = async () => {
    if (!packageToDelete) return;

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('packages')
        .delete()
        .eq('id', packageToDelete.id);

      if (error) throw error;

      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: ['packages', activeOrganizationId] });
      
      toast.success(t('packages.package_deleted_desc', { name: packageToDelete.name }));
      
      setDeleteConfirmOpen(false);
      setPackageToDelete(null);
    } catch (error) {
      console.error('Error deleting package:', error);
      toast.error(t('packages.error_deleting'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeactivatePackage = async () => {
    if (!packageToDelete) return;

    try {
      setIsDeactivating(true);
      const { error } = await supabase
        .from("packages")
        .update({ is_active: false })
        .eq("id", packageToDelete.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['packages', activeOrganizationId] });
      toast.success(t('packages.package_marked_inactive', { name: packageToDelete.name }));

      setDeleteConfirmOpen(false);
      setPackageToDelete(null);
    } catch (error) {
      console.error("Error deactivating package:", error);
      toast.error(t('packages.error_marking_inactive'));
    } finally {
      setIsDeactivating(false);
    }
  };

  const [isPackageWizardOpen, setPackageWizardOpen] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const filteredPackages = useMemo(
    () => (showInactive ? packages : packages.filter((pkg) => pkg.is_active)),
    [packages, showInactive]
  );

  const packageLineItemQuantities = useMemo(() => {
    const lookups = new Map<string, LineItemLookup>();

    filteredPackages.forEach((pkg) => {
      if (!pkg?.id) return;
      lookups.set(
        pkg.id,
        buildLineItemLookup(pkg.line_items, serviceIdByNameMap)
      );
    });

    return lookups;
  }, [filteredPackages, serviceIdByNameMap]);

  const handleWizardOpenChange = (open: boolean) => {
    setPackageWizardOpen(open);
    if (!open) {
      setEditingPackageId(null);
    }
  };

  const handlePackageCreatedViaWizard = () => {
    handleWizardOpenChange(false);
    queryClient.invalidateQueries({ queryKey: ['packages', activeOrganizationId] });
  };

  const handlePackageUpdatedViaWizard = () => {
    handleWizardOpenChange(false);
    queryClient.invalidateQueries({ queryKey: ['packages', activeOrganizationId] });
  };

  const openCreatePackage = () => {
    setEditingPackageId(null);
    handleWizardOpenChange(true);
  };

  const openEditPackage = (pkg: Package) => {
    setEditingPackageId(pkg.id);
    handleWizardOpenChange(true);
  };

  if (isLoading) {
    return (
      <SettingsSection 
        title={t('packages.title')} 
        description={t('packages.description')}
      >
        <FormLoadingSkeleton rows={2} />
      </SettingsSection>
    );
  }

  if (error) {
    return (
      <SettingsSection 
        title={t('packages.title')} 
        description={t('packages.description')}
      >
        <div className="text-center py-8">
          <p className="text-destructive">{t('packages.failed_to_load')}</p>
        </div>
      </SettingsSection>
    );
  }

  // Always show packages in single photographer mode
  // if (!hasPermission('view_packages')) {
  //   return null;
  // }

  const canManagePackages = true; // Always allow in single photographer mode

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "—";
    }
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const renderPricingHelper = (pkg: Package) => {
    const clientTotal = pkg.client_total ?? pkg.price;
    const basePrice = pkg.price ?? 0;
    const includeAddOns = pkg.include_addons_in_price ?? true;
    const addOnDelta = Math.max(0, (pkg.client_total ?? basePrice) - basePrice);

    if (includeAddOns) {
      return t("packages.price_inclusive_helper", {
        package: formatCurrency(basePrice),
      });
    }

    if (addOnDelta <= 0.5) {
      return t("packages.price_addons_none", {
        package: formatCurrency(basePrice),
      });
    }

    return t("packages.price_addons_helper", {
      package: formatCurrency(basePrice),
      addons: formatCurrency(addOnDelta),
    });
  };

  const resolvePricingBadge = (pkg: Package) =>
    pkg.include_addons_in_price
      ? t("packages.pricing_mode_inclusive")
      : t("packages.pricing_mode_addons");

  const extractDepositSummary = (pkg: Package) => {
    const metadata = pkg.pricing_metadata ?? undefined;
    if (!metadata || !metadata.enableDeposit) {
      return { label: "—", helper: t("packages.deposit_none") };
    }

    const amount = metadata.depositAmount ?? 0;
    if (amount <= 0) {
      return { label: "—", helper: t("packages.deposit_none") };
    }

    const formattedAmount = formatCurrency(amount);
    if (metadata.depositMode === "fixed") {
      return {
        label: formattedAmount,
        helper: t("packages.deposit_fixed_helper"),
      };
    }

    const percent = metadata.depositValue ?? 0;
    const target =
      metadata.depositTarget === "base"
        ? t("packages.deposit_target_base")
        : t("packages.deposit_target_subtotal");

    return {
      label: formattedAmount,
      helper: t("packages.deposit_percent_helper", {
        percent: percent,
        target,
      }),
    };
  };

  return (
    <>
      <SettingsSection 
        title={t('packages.title')} 
        description={t('packages.description')}
        actions={
          <div className="flex items-center gap-3">
            <label htmlFor="packages-show-inactive" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch
                id="packages-show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <span>{tCommon('labels.show_inactive')}</span>
            </label>
            {canManagePackages && (
              <Button
                onClick={openCreatePackage}
                className="flex items-center gap-2 whitespace-nowrap"
                data-testid="add-package-button"
              >
                <Plus className="h-4 w-4" />
                {t('packages.add_package')}
              </Button>
            )}
          </div>
        }
      >
        {filteredPackages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {packages.length === 0
                ? t('packages.no_packages')
                : t('packages.no_active_packages')}
            </p>
            {canManagePackages && packages.length === 0 && (
              <Button onClick={openCreatePackage} variant="outline" data-testid="add-package-button">
                <Plus className="h-4 w-4 mr-2" />
                {t('packages.create_first')}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredPackages.map((pkg) => {
              const depositSummary = extractDepositSummary(pkg);
              const quantityLookup = packageLineItemQuantities.get(pkg.id);
              const defaultAddOns = Array.isArray(pkg.default_add_ons) ? pkg.default_add_ons : [];
              const addOnBadges = defaultAddOns
                .map((rawServiceId, index) => {
                  const fallbackLabel =
                    typeof rawServiceId === "string" && rawServiceId.trim().length
                      ? rawServiceId.trim()
                      : unknownServiceLabel;
                  const serviceLabelFromId =
                    typeof rawServiceId === "string"
                      ? serviceNameMap.get(rawServiceId)
                      : undefined;
                  const baseLabel = serviceLabelFromId ?? fallbackLabel;
                  const normalizedLabel =
                    baseLabel && baseLabel.trim().length ? baseLabel.trim() : unknownServiceLabel;

                  const byId = quantityLookup?.byId;
                  const byName = quantityLookup?.byName;

                  let quantity: number | undefined;
                  if (typeof rawServiceId === "string") {
                    quantity = byId?.get(rawServiceId);
                  }
                  if (quantity === undefined) {
                    quantity =
                      byName?.get(normalizedLabel) ??
                      (fallbackLabel !== normalizedLabel
                        ? byName?.get(fallbackLabel)
                        : undefined);
                  }

                  const label =
                    quantity && quantity > 1
                      ? `${normalizedLabel} x${quantity}`
                      : normalizedLabel;

                  return {
                    key: `${pkg.id}-${typeof rawServiceId === "string" ? rawServiceId : index}`,
                    label,
                  };
                })
                .filter((entry) => Boolean(entry.label));
              const displayedAddOns = addOnBadges.slice(0, 4);
              const remainingAddOnCount = addOnBadges.length - displayedAddOns.length;
              const showAllTypes = pkg.applicable_types.length === 0;

              return (
                <Card
                  key={pkg.id}
                  className="flex h-full flex-col border-slate-200/80 bg-white/95 shadow-sm transition-shadow hover:shadow-md"
                >
                  <CardHeader className="space-y-3 pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <CardTitle className="text-lg font-semibold text-slate-900">
                          {pkg.name}
                        </CardTitle>
                        {pkg.description && (
                          <p className="text-sm text-muted-foreground">
                            {pkg.description}
                          </p>
                        )}
                      </div>
                      {!pkg.is_active && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold uppercase tracking-wide"
                        >
                          {passiveBadgeLabel}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 pt-4 text-sm">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t('packages.client_price')}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-lg font-semibold text-slate-900">
                            {formatCurrency(pkg.client_total ?? pkg.price)}
                          </span>
                          <Badge variant="outline" className="text-[11px] font-semibold uppercase tracking-wide">
                            {resolvePricingBadge(pkg)}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {renderPricingHelper(pkg)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t('packages.deposit')}
                        </p>
                        <div className="mt-2 text-lg font-semibold text-slate-900">
                          {depositSummary.label}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {depositSummary.helper}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('packages.applicable_types')}
                      </p>
                      {showAllTypes ? (
                        <Badge variant="outline" className="text-xs">
                          {t('packages.all_types')}
                        </Badge>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {pkg.applicable_types.map((type) => (
                            <Badge key={type} variant="secondary" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('packages.default_addons')}
                      </p>
                      {addOnBadges.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {t('packages.none')}
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {displayedAddOns.map((entry) => (
                            <Badge key={entry.key} variant="secondary" className="text-xs">
                              {entry.label}
                            </Badge>
                          ))}
                          {remainingAddOnCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {t('packages.addons_count', { count: addOnBadges.length })}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="mt-auto flex items-center justify-end gap-2 border-t border-dashed border-slate-200/70 pt-4">
                    {canManagePackages ? (
                      <IconActionButtonGroup>
                        <IconActionButton
                          onClick={() => openEditPackage(pkg)}
                          aria-label={`Edit package ${pkg.name}`}
                        >
                          <Edit className="h-4 w-4" />
                        </IconActionButton>
                        <IconActionButton
                          onClick={() => handleDeleteClick(pkg)}
                          aria-label={`Delete package ${pkg.name}`}
                          variant="danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconActionButton>
                      </IconActionButtonGroup>
                    ) : (
                      <span className="text-sm text-muted-foreground">{t('packages.view_only')}</span>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </SettingsSection>

      {canManagePackages && (
        <>
          <PackageCreationWizardSheet
            isOpen={isPackageWizardOpen}
            onOpenChange={handleWizardOpenChange}
            entrySource="settings_packages"
            onPackageCreated={handlePackageCreatedViaWizard}
            packageId={editingPackageId ?? undefined}
            onPackageUpdated={handlePackageUpdatedViaWizard}
          />
        </>
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('packages.delete_package')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm text-muted-foreground">
              <p className="text-foreground">
                {t('packages.delete_confirm', { name: packageToDelete?.name ?? '' })}
              </p>
              <p>{t('packages.delete_consider_inactive')}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting || isDeactivating}>
              {tCommon('buttons.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivatePackage}
              disabled={isDeactivating || isDeleting}
              className="border border-input bg-background text-foreground hover:bg-muted"
            >
              {t('packages.mark_inactive')}
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleDeletePackage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting || isDeactivating}
            >
              {tCommon('buttons.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PackagesSection;
