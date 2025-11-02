import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Plus, Trash2, ChevronDown, ChevronRight, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AddServiceDialog, EditServiceDialog } from "./settings/ServiceDialogs";
import SettingsSection from "./SettingsSection";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { IconActionButtonGroup } from "@/components/ui/icon-action-button-group";
import { Switch } from "@/components/ui/switch";
// Permissions removed for single photographer mode
import { useServices } from "@/hooks/useOrganizationData";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  useFormsTranslation,
  useCommonTranslation,
} from "@/hooks/useTypedTranslation";
import { cn } from "@/lib/utils";
import { calculateVatPortion } from "@/lib/accounting/vat";

type ServiceType = "coverage" | "deliverable";

interface Service {
  id: string;
  name: string;
  category?: string;
  description?: string;
  cost_price?: number;
  selling_price?: number;
  price?: number | null;
  service_type?: ServiceType;
  is_people_based?: boolean;
  default_unit?: string | null;
  is_active?: boolean;
  vendor_name?: string | null;
  vat_rate?: number | null;
  price_includes_vat?: boolean | null;
}

const ServicesSection = () => {
  const [showNewServiceDialog, setShowNewServiceDialog] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showEditServiceDialog, setShowEditServiceDialog] = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [activeType, setActiveType] = useState<ServiceType>("coverage");
  const [showInactive, setShowInactive] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t: tForms } = useFormsTranslation();
  const { t: tCommon } = useCommonTranslation();
  const passiveBadgeLabel = tCommon("status.passive_badge");
  // Permissions removed for single photographer mode - always allow
  const { activeOrganizationId } = useOrganization();

  // Use cached services data
  const { data: services = [], isLoading } = useServices();

  // Delete service mutation
  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", serviceId);

      if (error) throw error;
    },
    onSuccess: (_, serviceId) => {
      queryClient.invalidateQueries({
        queryKey: ["services", activeOrganizationId],
      });
      const serviceName =
        services.find((service) => service.id === serviceId)?.name ?? "";
      toast({
        title: tForms("services.service_deleted"),
        description: tForms("services.service_deleted_desc", {
          name: serviceName,
        }),
      });
      setDeleteConfirmOpen(false);
      setServiceToDelete(null);
    },
    onError: (error) => {
      toast({
        title: tCommon("labels.error"),
        description: tForms("services.error_deleting"),
        variant: "destructive",
      });
      console.error("Delete service error:", error);
    },
  });

  const markServiceInactiveMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await supabase
        .from("services")
        .update({ is_active: false })
        .eq("id", serviceId);

      if (error) throw error;
    },
    onSuccess: (_, serviceId) => {
      queryClient.invalidateQueries({
        queryKey: ["services", activeOrganizationId],
      });
      const serviceName =
        services.find((service) => service.id === serviceId)?.name ?? "";
      toast({
        title: tForms("services.service_marked_inactive"),
        description: tForms("services.service_marked_inactive_desc", {
          name: serviceName,
        }),
      });
      setDeleteConfirmOpen(false);
      setServiceToDelete(null);
    },
    onError: (error) => {
      toast({
        title: tCommon("labels.error"),
        description: tForms("services.error_marking_inactive"),
        variant: "destructive",
      });
      console.error("Deactivate service error:", error);
    },
  });

  const normalizedServices = useMemo(() => {
    return services.map((service) => {
      const serviceType = (service.service_type ??
        "deliverable") as ServiceType;
      return {
        ...service,
        service_type: serviceType,
        is_people_based: service.is_people_based ?? serviceType === "coverage",
      };
    });
  }, [services]);

  const formatCount = useCallback((value: number) => {
    return new Intl.NumberFormat("tr-TR").format(value);
  }, []);

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
    }).format(value);
  }, []);

  const formatRate = useCallback((value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) {
      return "0";
    }
    return new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
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

  const renderServiceCard = (service: Service) => {
    const isInactive = service.is_active === false;
    const costPrice = Number(service.cost_price ?? 0) || 0;
    const sellingPrice =
      Number(service.selling_price ?? service.price ?? 0) || 0;
    const vatRateValue =
      typeof service.vat_rate === "number" && Number.isFinite(service.vat_rate)
        ? service.vat_rate
        : 0;
    const vatAmountValue =
      sellingPrice > 0 && vatRateValue > 0
        ? calculateVatPortion(
            sellingPrice,
            vatRateValue,
            service.price_includes_vat ? "inclusive" : "exclusive"
          )
        : 0;
    const totalPrice = service.price_includes_vat
      ? sellingPrice
      : sellingPrice + vatAmountValue;
    const pricingRows = [
      {
        key: "cost",
        label: tForms("services.cost"),
        value: formatCurrency(costPrice),
        valueClassName: "text-foreground",
      },
      {
        key: "selling",
        label: tForms("services.selling"),
        value: formatCurrency(sellingPrice),
        valueClassName: "text-foreground",
      },
      {
        key: "vat",
        label: tForms("services.vat_label_compact", {
          rate: formatRate(vatRateValue),
        }),
        value: formatCurrency(vatAmountValue),
        valueClassName: "text-foreground",
      },
      {
        key: "total",
        label: tForms("services.total_price"),
        value: formatCurrency(totalPrice),
        valueClassName: "text-emerald-500",
      },
    ];

    return (
      <div
        key={service.id}
        className={cn(
          "flex h-full flex-col gap-4 rounded-xl border bg-background p-4 shadow-sm transition-opacity",
          isInactive && "opacity-75"
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-base font-semibold leading-tight text-foreground break-words">
                {service.name}
              </h4>
              {isInactive && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold uppercase tracking-wide"
                >
                  {passiveBadgeLabel}
                </Badge>
              )}
            </div>
            {service.description && (
              <p className="text-sm text-muted-foreground leading-snug break-words">
                {service.description}
              </p>
            )}
            {service.vendor_name && (
              <p className="text-xs italic text-muted-foreground/80 break-words">
                {tForms("services.vendor_label", {
                  name: service.vendor_name,
                })}
              </p>
            )}
          </div>
          {canManageServices ? (
            <IconActionButtonGroup className="flex-shrink-0 self-start">
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
                onClick={() => openDeleteDialog(service)}
                disabled={
                  deleteServiceMutation.isPending ||
                  markServiceInactiveMutation.isPending
                }
                aria-label={`Delete service ${service.name}`}
                variant="danger"
              >
                <Trash2 className="h-4 w-4" />
              </IconActionButton>
            </IconActionButtonGroup>
          ) : (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {tForms("services.view_only")}
            </span>
          )}
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/30 p-4 text-sm">
          <div className="space-y-3">
            {pricingRows.map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-4"
              >
                <span className="font-medium text-muted-foreground">
                  {row.label}
                </span>
                <span
                  className={cn(
                    "tabular-nums text-right font-semibold",
                    row.valueClassName
                  )}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (normalizedServices.length === 0) {
      setActiveType("coverage");
      return;
    }
    const hasActiveType = normalizedServices.some(
      (service) => service.service_type === activeType
    );
    if (!hasActiveType) {
      const fallback = normalizedServices.some(
        (service) => service.service_type === "coverage"
      )
        ? "coverage"
        : "deliverable";
      if (fallback !== activeType) {
        setActiveType(fallback);
      }
    }
  }, [normalizedServices, activeType]);

  const filteredServices = useMemo(
    () =>
      normalizedServices.filter(
        (service) =>
          service.service_type === activeType &&
          (showInactive || service.is_active !== false)
      ),
    [normalizedServices, activeType, showInactive]
  );

  // Group services by category for selected type
  const groupedServices = filteredServices.reduce((acc, service) => {
    const category = service.category || tForms("services.uncategorized");
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

  const openDeleteDialog = (service: Service) => {
    setServiceToDelete(service);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteService = () => {
    if (!serviceToDelete) return;
    deleteServiceMutation.mutate(serviceToDelete.id);
  };

  const handleMarkServiceInactive = () => {
    if (!serviceToDelete) return;
    markServiceInactiveMutation.mutate(serviceToDelete.id);
  };

  // Track modal state and ensure sheets close cleanly
  const handleDialogChange = (open: boolean) => {
    setShowNewServiceDialog(open);
  };

  // Always show services in single photographer mode
  // if (!hasPermission('view_services')) {
  //   return null;
  // }

  const canManageServices = true; // Always allow in single photographer mode

  const sectionActions = (
    <div className="flex items-center gap-3">
      <label
        htmlFor="services-show-inactive"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Switch
          id="services-show-inactive"
          checked={showInactive}
          onCheckedChange={setShowInactive}
        />
        <span>{tCommon("labels.show_inactive")}</span>
      </label>
      {canManageServices && (
        <Button
          onClick={() => setShowNewServiceDialog(true)}
          className="flex items-center gap-2 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          {tForms("services.add_service")}
        </Button>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <SettingsSection
        title={tForms("services.title")}
        description={tForms("services.description")}
        actions={sectionActions}
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

  return (
    <>
      <SettingsSection
        title={tForms("services.title")}
        description={tForms("services.description")}
        actions={sectionActions}
      >
        <div className="mb-6 space-y-2">
          <SegmentedControl
            value={activeType}
            onValueChange={(value) => setActiveType(value as ServiceType)}
            options={[
              {
                value: "coverage",
                label: renderSegmentLabel(
                  tForms("services.types.coverage"),
                  typeCounts.coverage
                ),
                tooltip: tForms("services.types.coverage_hint"),
              },
              {
                value: "deliverable",
                label: renderSegmentLabel(
                  tForms("services.types.deliverable"),
                  typeCounts.deliverable
                ),
                tooltip: tForms("services.types.deliverable_hint"),
              },
            ]}
            className="w-full sm:w-auto"
          />
          <p className="text-sm text-muted-foreground max-w-2xl">
            {activeType === "coverage"
              ? tForms("services.types.coverage_hint")
              : tForms("services.types.deliverable_hint")}
          </p>
        </div>

        {Object.keys(groupedServices).length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {activeType === "coverage"
                ? tForms("services.empty.coverage")
                : tForms("services.empty.deliverable")}
            </p>
            {canManageServices && (
              <Button
                onClick={() => setShowNewServiceDialog(true)}
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                {tForms("services.add_first_service")}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2.5">
              {Object.entries(groupedServices).map(
                ([category, categoryServices]) => (
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
                        <span className="font-medium text-base md:text-sm">
                          {category}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ({categoryServices.length})
                        </span>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="mt-2.5 grid grid-rows-[0fr] transition-[grid-template-rows,opacity] duration-250 ease-out data-[state=open]:grid-rows-[1fr] data-[state=closed]:opacity-0 data-[state=open]:opacity-100">
                      <div className="overflow-hidden space-y-4">
                        <div className="hidden md:block space-y-4 pl-3">
                          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                            {categoryServices.map((service) => renderServiceCard(service))}
                          </div>
                        </div>

                        {/* Mobile view */}
                        <div className="md:hidden space-y-4 pl-3">
                          {categoryServices.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground">
                              <p className="text-sm">
                                {tForms("services.no_services_in_category")}
                              </p>
                            </div>
                          ) : (
                            categoryServices.map((service) =>
                              renderServiceCard(service)
                            )
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              )}
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
              queryClient.invalidateQueries({
                queryKey: ["services", activeOrganizationId],
              });
              handleDialogChange(false);
            }}
          />

          <EditServiceDialog
            service={editingService}
            open={showEditServiceDialog}
            onOpenChange={setShowEditServiceDialog}
            onServiceUpdated={() => {
              queryClient.invalidateQueries({
                queryKey: ["services", activeOrganizationId],
              });
              setShowEditServiceDialog(false);
            }}
          />

          <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{tForms("services.delete_title")}</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2 text-sm text-muted-foreground">
                  <p className="text-foreground">
                    {tForms("services.delete_confirm", {
                      name: serviceToDelete?.name ?? "",
                    })}
                  </p>
                  <p>{tForms("services.delete_consider_inactive")}</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  disabled={
                    deleteServiceMutation.isPending ||
                    markServiceInactiveMutation.isPending
                  }
                >
                  {tCommon("buttons.cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleMarkServiceInactive}
                  disabled={
                    markServiceInactiveMutation.isPending ||
                    deleteServiceMutation.isPending
                  }
                  className="border border-input bg-background text-foreground hover:bg-muted"
                >
                  {tForms("services.mark_inactive")}
                </AlertDialogAction>
                <AlertDialogAction
                  onClick={handleConfirmDeleteService}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={
                    deleteServiceMutation.isPending ||
                    markServiceInactiveMutation.isPending
                  }
                >
                  {tCommon("buttons.delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </>
  );
};

export default ServicesSection;
