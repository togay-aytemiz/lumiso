import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, ChevronDown, ChevronRight, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AddServiceDialog, EditServiceDialog } from "./settings/ServiceDialogs";
import SettingsSection from "./SettingsSection";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { IconActionButtonGroup } from "@/components/ui/icon-action-button-group";
// Permissions removed for single photographer mode
import { useServices } from "@/hooks/useOrganizationData";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useFormsTranslation, useCommonTranslation } from "@/hooks/useTypedTranslation";

type ServiceType = "coverage" | "deliverable";

interface Service {
  id: string;
  name: string;
  category?: string;
  description?: string;
  cost_price?: number;
  selling_price?: number;
  service_type?: ServiceType;
  is_people_based?: boolean;
  default_unit?: string | null;
}

const ServicesSection = () => {
  const [showNewServiceDialog, setShowNewServiceDialog] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showEditServiceDialog, setShowEditServiceDialog] = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [activeType, setActiveType] = useState<ServiceType>("coverage");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t: tForms } = useFormsTranslation();
  const { t: tCommon } = useCommonTranslation();
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
        title: tForms('services.service_deleted'),
        description: tForms('services.service_deleted_desc'),
      });
    },
    onError: (error) => {
      toast({
        title: tCommon('labels.error'),
        description: tForms('services.error_deleting'),
        variant: "destructive",
      });
      console.error('Delete service error:', error);
    },
  });

  const normalizedServices = useMemo(() => {
    return services.map((service) => {
      const serviceType = (service.service_type ?? "deliverable") as ServiceType;
      return {
        ...service,
        service_type: serviceType,
        is_people_based: service.is_people_based ?? (serviceType === "coverage"),
      };
    });
  }, [services]);

  const formatCount = useCallback((value: number) => {
    return new Intl.NumberFormat("tr-TR").format(value);
  }, []);

  const typeCounts = useMemo(
    () =>
      normalizedServices.reduce(
        (acc, service) => {
          if (service.service_type === "coverage") {
            acc.coverage += 1;
          } else {
            acc.deliverable += 1;
          }
          return acc;
        },
        { coverage: 0, deliverable: 0 }
      ),
    [normalizedServices]
  );

  const renderSegmentLabel = useCallback(
    (label: string, count: number) => (
      <span className="inline-flex items-center gap-1.5">
        <span className="font-medium leading-tight">{label}</span>
        <span className="inline-flex min-w-[1.75rem] justify-center rounded-full border border-border/60 bg-background px-1.5 py-0.5 text-[11px] font-semibold leading-none text-current shadow-sm">
          {formatCount(count)}
        </span>
      </span>
    ),
    [formatCount]
  );

  useEffect(() => {
    if (normalizedServices.length === 0) {
      setActiveType("coverage");
      return;
    }
    const hasActiveType = normalizedServices.some((service) => service.service_type === activeType);
    if (!hasActiveType) {
      const fallback = normalizedServices.some((service) => service.service_type === "coverage")
        ? "coverage"
        : "deliverable";
      if (fallback !== activeType) {
        setActiveType(fallback);
      }
    }
  }, [normalizedServices, activeType]);

  const filteredServices = useMemo(
    () => normalizedServices.filter((service) => service.service_type === activeType),
    [normalizedServices, activeType]
  );

  // Group services by category for selected type
  const groupedServices = filteredServices.reduce((acc, service) => {
    const category = service.category || tForms('services.uncategorized');
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

  // Track modal state and ensure sheets close cleanly
  const handleDialogChange = (open: boolean) => {
    setShowNewServiceDialog(open);
  };

  if (isLoading) {
    return (
      <SettingsSection 
        title={tForms('services.title')}
        description={tForms('services.description')}
        action={{
          label: tForms('services.add_service'),
          onClick: () => setShowNewServiceDialog(true),
          icon: <Plus className="h-4 w-4" />
        }}
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
        title={tForms('services.title')}
        description={tForms('services.description')}
        action={canManageServices ? {
          label: tForms('services.add_service'),
          onClick: () => setShowNewServiceDialog(true),
          icon: <Plus className="h-4 w-4" />
        } : undefined}
      >

        <div className="mb-6 space-y-2">
          <SegmentedControl
            value={activeType}
            onValueChange={(value) => setActiveType(value as ServiceType)}
            options={[
              {
                value: "coverage",
                label: renderSegmentLabel(tForms('services.types.coverage'), typeCounts.coverage),
                tooltip: tForms('services.types.coverage_hint'),
              },
              {
                value: "deliverable",
                label: renderSegmentLabel(tForms('services.types.deliverable'), typeCounts.deliverable),
                tooltip: tForms('services.types.deliverable_hint'),
              },
            ]}
            className="w-full sm:w-auto"
          />
          <p className="text-sm text-muted-foreground max-w-2xl">
            {activeType === "coverage"
              ? tForms('services.types.coverage_hint')
              : tForms('services.types.deliverable_hint')}
          </p>
        </div>

        {Object.keys(groupedServices).length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {activeType === "coverage"
                ? tForms('services.empty.coverage')
                : tForms('services.empty.deliverable')}
            </p>
            {canManageServices && (
              <Button onClick={() => setShowNewServiceDialog(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                {tForms('services.add_first_service')}
              </Button>
            )}
          </div>
        ) : (
          <>
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
                  
                  <CollapsibleContent className="mt-3 grid grid-rows-[0fr] transition-[grid-template-rows,opacity] duration-250 ease-out data-[state=open]:grid-rows-[1fr] data-[state=closed]:opacity-0 data-[state=open]:opacity-100">
                    <div className="overflow-hidden space-y-3">
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
                                  {tForms('services.cost')}: TRY {service.cost_price}
                                </span>
                              )}
                              {(service.selling_price || 0) > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {tForms('services.selling')}: TRY {service.selling_price}
                                </span>
                              )}
                            </div>
                           </div>
                           
                            {canManageServices ? (
                              <IconActionButtonGroup>
                                <IconActionButton
                                  onClick={() => {
                                    setEditingService(service);
                                    setShowEditServiceDialog(true);
                                  }}
                                  aria-label={`Edit service ${service.name}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </IconActionButton>
                                <IconActionButton
                                  onClick={() => handleDeleteService(service.id)}
                                  disabled={deleteServiceMutation.isPending}
                                  aria-label={`Delete service ${service.name}`}
                                  variant="danger"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </IconActionButton>
                              </IconActionButtonGroup>
                            ) : (
                              <span className="text-sm text-muted-foreground">{tForms('services.view_only')}</span>
                            )}
                        </div>
                      ))}
                    </div>

                    {/* Mobile view - card layout */}
                    <div className="md:hidden space-y-3 pl-3">
                       {categoryServices.length === 0 ? (
                         <div className="text-center py-6 text-muted-foreground">
                           <p className="text-sm">{tForms('services.no_services_in_category')}</p>
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
                                     {tForms('services.cost')}: TRY {service.cost_price}
                                   </div>
                                 )}
                                 {(service.selling_price || 0) > 0 && (
                                   <div className="text-sm font-medium">
                                     {tForms('services.selling')}: TRY {service.selling_price}
                                   </div>
                                 )}
                              </div>
                            )}

                             {/* Actions row */}
                             {canManageServices && (
                               <IconActionButtonGroup className="border-t pt-2 w-full">
                                 <IconActionButton
                                   onClick={() => {
                                     setEditingService(service);
                                     setShowEditServiceDialog(true);
                                   }}
                                   className="flex-1 h-10 min-w-0"
                                   aria-label={`Edit service ${service.name}`}
                                 >
                                   <Edit className="h-4 w-4" />
                                 </IconActionButton>
                                 <IconActionButton
                                   onClick={() => handleDeleteService(service.id)}
                                   disabled={deleteServiceMutation.isPending}
                                   className="flex-1 h-10 min-w-0"
                                   aria-label={`Delete service ${service.name}`}
                                   variant="danger"
                                 >
                                   <Trash2 className="h-4 w-4" />
                                 </IconActionButton>
                               </IconActionButtonGroup>
                             )}
                          </div>
                        ))
                      )}
                    </div>
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
            initialType={activeType}
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
