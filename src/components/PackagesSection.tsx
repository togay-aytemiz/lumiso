import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  default_add_ons: string[];
  is_active: boolean;
  include_addons_in_price?: boolean | null;
  pricing_metadata?: {
    enableDeposit?: boolean;
    depositAmount?: number;
    depositMode?: "percent_subtotal" | "percent_base" | "fixed";
    depositValue?: number;
    depositTarget?: "subtotal" | "base" | null;
  } | null;
}

const PackagesSection = () => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<Package | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const toast = useI18nToast();
  const { t } = useTranslation('forms');
  const { t: tCommon } = useCommonTranslation();
  // Permissions removed for single photographer mode - always allow
  const { activeOrganizationId } = useOrganization();
  const queryClient = useQueryClient();
  const passiveBadgeLabel = tCommon('status.passive_badge');
  
  // Use cached data
  const { data: packages = [], isLoading, error } = usePackages();
  const { data: services = [] } = useServices();

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
          <>
            {/* Desktop Table */}
            <div className="hidden md:block space-y-4">
              <div className="rounded-lg border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left text-sm font-medium">{t('packages.package_name')}</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">{t('packages.client_price')}</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">{t('packages.deposit')}</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">{t('packages.applicable_types')}</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">{t('packages.default_addons')}</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">{t('packages.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPackages.map((pkg, index) => (
                        <tr key={pkg.id} className={`border-b ${index % 2 === 1 ? 'bg-muted/25' : ''} hover:bg-muted/50`}>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{pkg.name}</span>
                                {!pkg.is_active && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-semibold uppercase tracking-wide"
                                  >
                                    {passiveBadgeLabel}
                                  </Badge>
                                )}
                              </div>
                              {pkg.description && (
                                <div className="text-sm text-muted-foreground">
                                  {pkg.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-slate-900">
                                  {formatCurrency(pkg.client_total ?? pkg.price)}
                                </span>
                                <Badge variant="outline" className="text-[11px] font-semibold">
                                  {resolvePricingBadge(pkg)}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {renderPricingHelper(pkg)}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            {(() => {
                              const { label, helper } = extractDepositSummary(pkg);
                              return (
                                <div className="space-y-1.5">
                                  <span className="font-medium text-slate-900">{label}</span>
                                  <p className="text-xs text-muted-foreground">{helper}</p>
                                </div>
                              );
                            })()}
                          </td>
                             <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {pkg.applicable_types.length === 0 ? (
                                  <Badge variant="outline" className="text-xs">{t('packages.all_types')}</Badge>
                                ) : (
                                  pkg.applicable_types.map((type) => (
                                    <Badge key={type} variant="secondary" className="text-xs">
                                      {type}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </td>
                             <td className="px-4 py-3">
                               <div className="flex flex-wrap gap-1">
                                 {pkg.default_add_ons.length === 0 ? (
                                   <span className="text-sm text-muted-foreground">{t('packages.none')}</span>
                                 ) : (
                                   <TooltipProvider>
                                     <Tooltip>
                                       <TooltipTrigger asChild>
                                         <div className="cursor-help">
                                           <Badge variant="outline" className="text-xs">
                                             {t('packages.addons_count', { count: pkg.default_add_ons.length })}
                                           </Badge>
                                         </div>
                                       </TooltipTrigger>
                                       <TooltipContent>
                                         <div className="max-w-xs">
                                           <p className="font-medium">{t('packages.default_addons_tooltip')}</p>
                                           {pkg.default_add_ons.length > 0 ? (
                                             <ul className="mt-1 text-sm">
                                               {pkg.default_add_ons.map(serviceId => {
                                                 const service = services.find(s => s.id === serviceId);
                                                 return (
                                                   <li key={serviceId}>
                                                     • {service?.name || t('packages.unknown_service')}
                                                   </li>
                                                 );
                                               })}
                                             </ul>
                                           ) : (
                                             <p className="text-sm text-muted-foreground">{t('packages.no_services_selected')}</p>
                                           )}
                                         </div>
                                       </TooltipContent>
                                     </Tooltip>
                                   </TooltipProvider>
                                 )}
                               </div>
                             </td>
                            <td className="px-4 py-3">
                              <Badge variant={pkg.is_active ? "default" : "secondary"}>
                                {pkg.is_active ? t('packages.active') : t('packages.inactive')}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
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
                            </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredPackages.map((pkg) => (
                <div key={pkg.id} className="border rounded-lg p-3 bg-background space-y-3">
                  {/* Package name and description */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base">{pkg.name}</h3>
                      {!pkg.is_active && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold uppercase tracking-wide"
                        >
                          {passiveBadgeLabel}
                        </Badge>
                      )}
                    </div>
                    {pkg.description && (
                      <p className="text-sm text-muted-foreground">
                        {pkg.description}
                      </p>
                    )}
                  </div>

                  {/* Key facts row */}
                  <div className="flex flex-wrap gap-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-xs font-semibold">
                          {formatCurrency(pkg.client_total ?? pkg.price)}
                        </Badge>
                        <Badge variant="outline" className="text-[11px] font-semibold">
                          {resolvePricingBadge(pkg)}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {renderPricingHelper(pkg)}
                      </span>
                    </div>

                     {/* Add-ons count badge */}
                      <div 
                        className="cursor-help inline-block"
                        title={pkg.default_add_ons.length > 0 ? `Services: ${pkg.default_add_ons.join(', ')}` : t('packages.no_addons')}
                      >
                        <Badge variant="outline" className="text-xs">
                          {pkg.default_add_ons.length === 0 
                            ? t('packages.no_addons')
                            : t('packages.addons_count', { count: pkg.default_add_ons.length })
                          }
                        </Badge>
                      </div>

                  </div>

                    {/* Applicable Types (separate row for better wrapping) */}
                    {pkg.applicable_types.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">{t('packages.applicable_types')}:</span>
                        <div className="flex flex-wrap gap-1">
                          {pkg.applicable_types.map((type) => (
                            <Badge key={type} variant="secondary" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">{t('packages.deposit')}:</span>
                      {(() => {
                        const { label, helper } = extractDepositSummary(pkg);
                        return (
                          <div className="space-y-0.5">
                            <span className="text-sm font-semibold text-slate-900">{label}</span>
                            <p className="text-xs text-muted-foreground">{helper}</p>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">{t('packages.deposit')}:</span>
                      {(() => {
                        const { label, helper } = extractDepositSummary(pkg);
                        return (
                          <div className="space-y-0.5">
                            <span className="text-sm font-semibold text-slate-900">{label}</span>
                            <p className="text-xs text-muted-foreground">{helper}</p>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Actions row */}
                    {canManagePackages && (
                      <div className="flex gap-2 pt-2 border-t">
                        <IconActionButtonGroup className="w-full">
                          <IconActionButton
                            onClick={() => openEditPackage(pkg)}
                            className="flex-1 h-10 min-w-0"
                            aria-label={`Edit package ${pkg.name}`}
                          >
                            <Edit className="h-4 w-4" />
                          </IconActionButton>
                          <IconActionButton
                            onClick={() => handleDeleteClick(pkg)}
                            className="flex-1 h-10 min-w-0"
                            aria-label={`Delete package ${pkg.name}`}
                            variant="danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconActionButton>
                        </IconActionButtonGroup>
                      </div>
                    )}
                </div>
              ))}
            </div>
          </>
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
