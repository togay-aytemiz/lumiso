import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, ChevronDown, ChevronRight, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AddServiceDialog, EditServiceDialog } from "./settings/ServiceDialogs";
import SettingsSection from "./SettingsSection";
// Permissions removed for single photographer mode
import { useServices } from "@/hooks/useOrganizationData";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Service {
  id: string;
  name: string;
  category?: string;
  description?: string;
  cost_price?: number;
  selling_price?: number;
}

const ServicesSection = () => {
  const [showNewServiceDialog, setShowNewServiceDialog] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showEditServiceDialog, setShowEditServiceDialog] = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [newCategoriesAdded, setNewCategoriesAdded] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Permissions removed for single photographer mode - always allow
  const { activeOrganizationId } = useOrganization();

  // Use cached services data
  const { data: services = [], isLoading } = useServices();

  // Delete service mutation
  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', activeOrganizationId] });
      toast({
        title: "Service deleted",
        description: "The service has been removed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete service. Please try again.",
        variant: "destructive",
      });
      console.error('Delete service error:', error);
    },
  });

  // Group services by category
  const groupedServices = services.reduce((acc, service) => {
    const category = service.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  const toggleCategory = (category: string) => {
    const newOpenCategories = new Set(openCategories);
    if (newOpenCategories.has(category)) {
      newOpenCategories.delete(category);
    } else {
      newOpenCategories.add(category);
    }
    setOpenCategories(newOpenCategories);
  };

  const handleDeleteService = (serviceId: string) => {
    deleteServiceMutation.mutate(serviceId);
  };

  const handleCategoryAdded = (newCategory: string) => {
    // Add the new category to our local state for immediate availability
    // But only if it's not already in existing categories or newCategoriesAdded
    const existingCats = Object.keys(groupedServices).filter(cat => cat !== 'Uncategorized');
    const allExistingCats = [...existingCats, ...newCategoriesAdded];
    
    if (!allExistingCats.some(cat => cat.toLowerCase() === newCategory.toLowerCase())) {
      setNewCategoriesAdded(prev => [...prev, newCategory]);
    }
  };

  // Clear new categories when dialog closes or service is created successfully
  const handleDialogChange = (open: boolean) => {
    setShowNewServiceDialog(open);
    if (!open) {
      // Clear the temporary categories when dialog closes
      setNewCategoriesAdded([]);
    }
  };

  if (isLoading) {
    return (
      <SettingsSection 
        title="Services" 
        description="Define the photography services you offer, like albums, prints, and extras."
      >
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-12 bg-muted rounded-lg mb-3" />
              <div className="pl-6 space-y-2">
                <div className="h-16 bg-muted/50 rounded-lg" />
                <div className="h-16 bg-muted/50 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>
    );
  }

  // Always show services in single photographer mode
  // if (!hasPermission('view_services')) {
  //   return null;
  // }

  const canManageServices = true; // Always allow in single photographer mode

  return (
    <>
      <SettingsSection 
        title="Services" 
        description="Define the photography services you offer, like albums, prints, and extras."
        action={(Object.keys(groupedServices).length > 0 && canManageServices) ? {
          label: "Add Service",
          onClick: () => setShowNewServiceDialog(true),
          icon: <Plus className="h-4 w-4" />
        } : undefined}
      >
        {Object.keys(groupedServices).length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No services defined yet.</p>
            {canManageServices && (
              <Button onClick={() => setShowNewServiceDialog(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add your first service
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Add Button */}
            {canManageServices && (
              <div className="md:hidden mb-4">
                <Button 
                  onClick={() => setShowNewServiceDialog(true)} 
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </div>
            )}

            <div className="space-y-4">
              {Object.entries(groupedServices).map(([category, categoryServices]) => (
                <Collapsible
                  key={category}
                  open={openCategories.has(category)}
                  onOpenChange={() => toggleCategory(category)}
                >
                  {/* Enhanced category header - full-width tap area */}
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 text-left bg-muted rounded-lg hover:bg-muted/80 transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                    <div className="flex items-center gap-3">
                      {openCategories.has(category) ? (
                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 flex-shrink-0" />
                      )}
                      <span className="font-medium text-base md:text-sm">{category}</span>
                      <span className="text-sm text-muted-foreground">
                        ({categoryServices.length})
                      </span>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="mt-3">
                    {/* Desktop view - existing layout */}
                    <div className="hidden md:block space-y-2 pl-6">
                      {categoryServices.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center justify-between p-3 border rounded-lg bg-background"
                        >
                          <div className="flex-1">
                            <h4 className="font-medium">{service.name}</h4>
                            {service.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {service.description}
                              </p>
                            )}
                            <div className="flex gap-4 mt-2">
                              {(service.cost_price || 0) > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  Cost: TRY {service.cost_price}
                                </span>
                              )}
                              {(service.selling_price || 0) > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  Selling: TRY {service.selling_price}
                                </span>
                              )}
                            </div>
                           </div>
                           
                           {canManageServices ? (
                             <div className="flex gap-2">
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={() => {
                                   setEditingService(service);
                                   setShowEditServiceDialog(true);
                                 }}
                                 className="text-muted-foreground hover:text-foreground"
                                 aria-label={`Edit service ${service.name}`}
                               >
                                 <Edit className="h-4 w-4" />
                               </Button>
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={() => handleDeleteService(service.id)}
                                 disabled={deleteServiceMutation.isPending}
                                 className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                 aria-label={`Delete service ${service.name}`}
                               >
                                 <Trash2 className="h-4 w-4" />
                               </Button>
                             </div>
                           ) : (
                             <span className="text-sm text-muted-foreground">View only</span>
                           )}
                        </div>
                      ))}
                    </div>

                    {/* Mobile view - card layout */}
                    <div className="md:hidden space-y-3 pl-3">
                      {categoryServices.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <p className="text-sm">No services in this category</p>
                        </div>
                      ) : (
                        categoryServices.map((service) => (
                          <div
                            key={service.id}
                            className="border rounded-lg p-3 bg-background space-y-3"
                          >
                            {/* Service name */}
                            <div>
                              <h4 className="font-semibold text-base">{service.name}</h4>
                              {service.description && (
                                <p className="text-sm text-muted-foreground mt-1 break-words">
                                  {service.description}
                                </p>
                              )}
                            </div>

                            {/* Pricing information */}
                            {((service.cost_price || 0) > 0 || (service.selling_price || 0) > 0) && (
                              <div className="space-y-1">
                                {(service.cost_price || 0) > 0 && (
                                  <div className="text-sm text-muted-foreground">
                                    Cost: TRY {service.cost_price}
                                  </div>
                                )}
                                {(service.selling_price || 0) > 0 && (
                                  <div className="text-sm font-medium">
                                    Selling: TRY {service.selling_price}
                                  </div>
                                )}
                              </div>
                            )}

                             {/* Actions row */}
                             {canManageServices && (
                               <div className="flex gap-2 pt-2 border-t">
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   onClick={() => {
                                     setEditingService(service);
                                     setShowEditServiceDialog(true);
                                   }}
                                   className="flex-1 h-10 min-w-0"
                                   aria-label={`Edit service ${service.name}`}
                                 >
                                   <Edit className="h-4 w-4" />
                                 </Button>
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   onClick={() => handleDeleteService(service.id)}
                                   disabled={deleteServiceMutation.isPending}
                                   className="flex-1 h-10 min-w-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                   aria-label={`Delete service ${service.name}`}
                                 >
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                               </div>
                             )}
                          </div>
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </>
        )}
      </SettingsSection>

      {canManageServices && (
        <>
          <AddServiceDialog
            open={showNewServiceDialog}
            onOpenChange={handleDialogChange}
            onServiceAdded={() => {
              queryClient.invalidateQueries({ queryKey: ['services', activeOrganizationId] });
              handleDialogChange(false);
            }}
          />

          <EditServiceDialog
            service={editingService}
            open={showEditServiceDialog}
            onOpenChange={setShowEditServiceDialog}
            onServiceUpdated={() => {
              queryClient.invalidateQueries({ queryKey: ['services', activeOrganizationId] });
              setShowEditServiceDialog(false);
            }}
          />
        </>
      )}
    </>
  );
};

export default ServicesSection;