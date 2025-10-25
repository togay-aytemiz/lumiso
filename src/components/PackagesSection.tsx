import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { useI18nToast } from "@/lib/toastHelpers";
import { supabase } from "@/integrations/supabase/client";
import SettingsSection from "./SettingsSection";
import { FormLoadingSkeleton } from "@/components/ui/loading-presets";
import { AddPackageDialog, EditPackageDialog } from "./settings/PackageDialogs";
// Permissions removed for single photographer mode
import { usePackages, useServices } from "@/hooks/useOrganizationData";
import { useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useTranslation } from "react-i18next";

interface Package {
  id: string;
  name: string;
  description?: string;
  price: number;
  applicable_types: string[];
  default_add_ons: string[];
  is_active: boolean;
}

const PackagesSection = () => {
  const [showNewPackageDialog, setShowNewPackageDialog] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [showEditPackageDialog, setShowEditPackageDialog] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<Package | null>(null);
  const toast = useI18nToast();
  const { t } = useTranslation('forms');
  // Permissions removed for single photographer mode - always allow
  const { activeOrganizationId } = useOrganization();
  const queryClient = useQueryClient();
  
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
    }
  };

  const handlePackageAdded = () => {
    setShowNewPackageDialog(false);
    // Invalidate cache to refresh data
    queryClient.invalidateQueries({ queryKey: ['packages', activeOrganizationId] });
  };

  const handlePackageUpdated = () => {
    setShowEditPackageDialog(false);
    setEditingPackage(null);
    // Invalidate cache to refresh data
    queryClient.invalidateQueries({ queryKey: ['packages', activeOrganizationId] });
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

  return (
    <>
      <SettingsSection 
        title={t('packages.title')} 
        description={t('packages.description')}
        action={(packages.length > 0 && canManagePackages) ? {
          label: t('packages.add_package'),
          onClick: () => setShowNewPackageDialog(true),
          icon: <Plus className="h-4 w-4" />
        } : undefined}
      >
        {packages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">{t('packages.no_packages')}</p>
            {canManagePackages && (
              <Button onClick={() => setShowNewPackageDialog(true)} variant="outline" data-testid="add-package-button">
                <Plus className="h-4 w-4 mr-2" />
                {t('packages.create_first')}
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Add Button */}
            {canManagePackages && (
              <div className="md:hidden mb-4">
                <Button 
                  onClick={() => setShowNewPackageDialog(true)} 
                  className="w-full"
                  data-testid="add-package-button"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('packages.add_package')}
                </Button>
              </div>
            )}

            {/* Desktop Table */}
            <div className="hidden md:block space-y-4">
              <div className="rounded-lg border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left text-sm font-medium">{t('packages.package_name')}</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">{t('packages.price')}</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">{t('packages.applicable_types')}</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">{t('packages.default_addons')}</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">{t('packages.visibility')}</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">{t('packages.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packages.map((pkg, index) => (
                        <tr key={pkg.id} className={`border-b ${index % 2 === 1 ? 'bg-muted/25' : ''} hover:bg-muted/50`}>
                          <td className="px-4 py-3">
                            <div>
                              <div className="font-medium">{pkg.name}</div>
                              {pkg.description && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  {pkg.description}
                                </div>
                              )}
                            </div>
                          </td>
                           <td className="px-4 py-3">
                             <span className="font-medium">TRY {pkg.price.toLocaleString()}</span>
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
                               <div className="flex gap-2">
                                <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => {
                                     setEditingPackage(pkg);
                                     setShowEditPackageDialog(true);
                                   }}
                                   className="text-muted-foreground hover:text-white"
                                 >
                                   <Edit className="h-4 w-4" />
                                 </Button>
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => handleDeleteClick(pkg)}
                                   className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                 >
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                               </div>
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
              {packages.map((pkg) => (
                <div key={pkg.id} className="border rounded-lg p-3 bg-background space-y-3">
                  {/* Package name and description */}
                  <div>
                    <h3 className="font-semibold text-base">{pkg.name}</h3>
                    {pkg.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {pkg.description}
                      </p>
                    )}
                  </div>

                  {/* Key facts row */}
                  <div className="flex flex-wrap gap-2">
                     {/* Price badge */}
                     <Badge variant="default" className="text-xs font-medium">
                       TRY {pkg.price.toLocaleString()}
                    </Badge>

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

                     {/* Visibility pill */}
                     <Badge variant={pkg.is_active ? "default" : "secondary"} className="text-xs">
                       {pkg.is_active ? t('packages.active') : t('packages.inactive')}
                     </Badge>
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

                    {/* Actions row */}
                    {canManagePackages && (
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingPackage(pkg);
                            setShowEditPackageDialog(true);
                          }}
                          className="flex-1 h-10 min-w-0"
                          aria-label={`Edit package ${pkg.name}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(pkg)}
                          className="flex-1 h-10 min-w-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          aria-label={`Delete package ${pkg.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
          <AddPackageDialog
            open={showNewPackageDialog}
            onOpenChange={setShowNewPackageDialog}
            onPackageAdded={handlePackageAdded}
          />

          <EditPackageDialog
            package={editingPackage}
            open={showEditPackageDialog}
            onOpenChange={setShowEditPackageDialog}
            onPackageUpdated={handlePackageUpdated}
          />
        </>
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('packages.delete_package')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('packages.delete_confirm', { name: packageToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePackage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('packages.delete_package')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PackagesSection;
