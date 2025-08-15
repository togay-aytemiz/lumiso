import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SettingsSection from "./SettingsSection";
import { AddPackageDialog, EditPackageDialog } from "./settings/PackageDialogs";

interface Package {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  duration: string;
  includes?: string;
  applicableTypes: string[];
  defaultAddons: string[];
  isActive: boolean;
}

const PackagesSection = () => {
  const [showNewPackageDialog, setShowNewPackageDialog] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [showEditPackageDialog, setShowEditPackageDialog] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<Package | null>(null);
  const { toast } = useToast();

  // Mock data for now since no backend is required yet
  const [packages] = useState<Package[]>([
    {
      id: "1",
      name: "Wedding Standard",
      description: "Complete wedding coverage with essentials",
      basePrice: 15000,
      duration: "Full-day",
      includes: "300 edited photos\nOnline gallery\n1 photographer\nUSB delivery",
      applicableTypes: ["Wedding", "Engagement"],
      defaultAddons: ["Extra Hour", "Second Photographer"],
      isActive: true
    },
    {
      id: "2", 
      name: "Portrait Session",
      description: "Professional portrait photography",
      basePrice: 2500,
      duration: "1h",
      includes: "20 retouched photos\nOnline gallery",
      applicableTypes: ["Portrait", "Family"],
      defaultAddons: ["Print Package"],
      isActive: true
    }
  ]);

  const handleDeleteClick = (pkg: Package) => {
    setPackageToDelete(pkg);
    setDeleteConfirmOpen(true);
  };

  const handleDeletePackage = () => {
    if (packageToDelete) {
      toast({
        title: "Package deleted",
        description: `Package "${packageToDelete.name}" has been removed successfully.`,
      });
      setDeleteConfirmOpen(false);
      setPackageToDelete(null);
    }
  };

  const formatDuration = (duration: string) => {
    switch (duration) {
      case "30m": return "30 minutes";
      case "1h": return "1 hour";
      case "2h": return "2 hours";
      case "3h": return "3 hours";
      case "Half-day": return "Half day";
      case "Full-day": return "Full day";
      default: return duration;
    }
  };

  return (
    <>
      <SettingsSection 
        title="Packages" 
        description="Create comprehensive packages that bundle services together for your clients."
        action={(packages.length > 0) ? {
          label: "Add Package",
          onClick: () => setShowNewPackageDialog(true),
          icon: <Plus className="h-4 w-4" />
        } : undefined}
      >
        {packages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No packages yet</p>
            <Button onClick={() => setShowNewPackageDialog(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create your first package
            </Button>
          </div>
        ) : (
          <>
            {/* Mobile Add Button */}
            <div className="md:hidden mb-4">
              <Button 
                onClick={() => setShowNewPackageDialog(true)} 
                className="w-full h-12"
                size="lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Package
              </Button>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block space-y-4">
              <div className="rounded-lg border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left text-sm font-medium">Package</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Price</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Duration</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Applicable Types</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Default Add-ons</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Visibility</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
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
                            <span className="font-medium">TRY {pkg.basePrice.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm">{formatDuration(pkg.duration)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {pkg.applicableTypes.length === 0 ? (
                                <Badge variant="outline" className="text-xs">All types</Badge>
                              ) : (
                                pkg.applicableTypes.map((type) => (
                                  <Badge key={type} variant="secondary" className="text-xs">
                                    {type}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {pkg.defaultAddons.length === 0 ? (
                                <span className="text-sm text-muted-foreground">None</span>
                              ) : (
                                <>
                                  <Badge variant="outline" className="text-xs">
                                    {pkg.defaultAddons.length} add-on{pkg.defaultAddons.length !== 1 ? 's' : ''}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={pkg.isActive ? "default" : "secondary"}>
                              {pkg.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingPackage(pkg);
                                  setShowEditPackageDialog(true);
                                }}
                                className="text-muted-foreground hover:text-foreground"
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
                      TRY {pkg.basePrice.toLocaleString()}
                    </Badge>

                    {/* Duration badge */}
                    <Badge variant="secondary" className="text-xs">
                      {formatDuration(pkg.duration)}
                    </Badge>

                    {/* Add-ons count badge */}
                    <Badge variant="outline" className="text-xs">
                      {pkg.defaultAddons.length === 0 
                        ? "No add-ons" 
                        : `${pkg.defaultAddons.length} add-on${pkg.defaultAddons.length !== 1 ? 's' : ''}`
                      }
                    </Badge>

                    {/* Visibility pill */}
                    <Badge variant={pkg.isActive ? "default" : "secondary"} className="text-xs">
                      {pkg.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {/* Applicable Types (separate row for better wrapping) */}
                  {pkg.applicableTypes.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Applicable Types:</span>
                      <div className="flex flex-wrap gap-1">
                        {pkg.applicableTypes.map((type) => (
                          <Badge key={type} variant="secondary" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                   {/* Actions row */}
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
                </div>
              ))}
            </div>
          </>
        )}
      </SettingsSection>

      <AddPackageDialog
        open={showNewPackageDialog}
        onOpenChange={setShowNewPackageDialog}
        onPackageAdded={() => {
          setShowNewPackageDialog(false);
        }}
      />

      <EditPackageDialog
        package={editingPackage}
        open={showEditPackageDialog}
        onOpenChange={setShowEditPackageDialog}
        onPackageUpdated={() => {
          setShowEditPackageDialog(false);
        }}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Package</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{packageToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePackage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Package
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PackagesSection;