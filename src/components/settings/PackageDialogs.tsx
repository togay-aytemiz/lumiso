import { useState, useEffect, useMemo } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "./NavigationGuardDialog";

interface Package {
  id: string;
  name: string;
  description?: string;
  price: number;
  applicable_types: string[];
  default_add_ons: string[];
  is_active: boolean;
}

interface AddPackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPackageAdded: () => void;
}

interface EditPackageDialogProps {
  package: Package | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPackageUpdated: () => void;
}

// Service picker component for default add-ons
const ServiceAddOnsPicker = ({ services, value, onChange, navigate }: {
  services: any[];
  value: string[];
  onChange: (addons: string[]) => void;
  navigate: (path: string) => void;
}) => {
  const { t } = useTranslation(['forms', 'common']);
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState<string[]>([]);
  const [openItems, setOpenItems] = useState<string[]>([]);

  const groupedServices = useMemo(() => {
    const groups: Record<string, any[]> = {};
    services.forEach((service) => {
      const key = service.category || "Uncategorized";
      if (!groups[key]) groups[key] = [];
      groups[key].push(service);
    });
    // Sort services by name inside each group
    Object.keys(groups).forEach((k) => groups[k].sort((a, b) => a.name.localeCompare(b.name)));
    return groups;
  }, [services]);

  const categories = useMemo(() => Object.keys(groupedServices).sort(), [groupedServices]);

  const selectedServices = useMemo(
    () => services.filter((s) => value.includes(s.id)),
    [services, value]
  );

  const handleEdit = () => {
    setTempValue([...value]);
    setIsEditing(true);
  };

  const handleSave = () => {
    onChange(tempValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempValue([]);
    setIsEditing(false);
  };

  const toggleService = (serviceId: string) => {
    if (tempValue.includes(serviceId)) {
      setTempValue(prev => prev.filter(v => v !== serviceId));
    } else {
      setTempValue(prev => [...prev, serviceId]);
    }
  };

  if (services.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <p className="text-sm">{t('package.no_services_yet', { ns: 'forms' })}</p>
        <button
          type="button"
          onClick={() => navigate("/settings/services")}
          className="text-sm text-primary hover:underline mt-1"
        >
          {t('package.create_service', { ns: 'forms' })}
        </button>
      </div>
    );
  }

  // Edit mode - show accordion
  if (isEditing) {
    return (
      <div className="space-y-3">
        <Accordion
          type="multiple"
          value={openItems}
          onValueChange={(v) => setOpenItems(v as string[])}
          className="w-full"
        >
          {categories.map((category) => {
            const items = groupedServices[category] || [];
            const selectedCount = items.filter((s) => tempValue.includes(s.id)).length;
            return (
              <AccordionItem key={category} value={category} className="border rounded-md mb-3">
                <AccordionTrigger className="px-3 py-2 text-sm">
                  <div className="flex w-full items-center justify-between">
                    <span className="font-medium">{category}</span>
                    <span className="text-xs text-muted-foreground">
                      {selectedCount}/{items.length}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="px-3 pb-3">
                    <div className="flex flex-wrap gap-2">
                      {items.map((service) => {
                        const selected = tempValue.includes(service.id);
                        const costPrice = service.cost_price ?? 0;
                        const sellingPrice = service.selling_price ?? service.price ?? 0;
                        const hasPrices = costPrice > 0 || sellingPrice > 0;
                        return (
                          <Button
                            key={service.id}
                            type="button"
                            variant={selected ? "default" : "secondary"}
                            onClick={() => toggleService(service.id)}
                            className={cn(
                              "h-8 rounded-full px-3 text-xs justify-start whitespace-nowrap",
                              "overflow-hidden text-ellipsis",
                              selected ? "" : "border",
                            )}
                            title={`${service.name}${hasPrices ? ` · Cost: ₺${costPrice} · Selling: ₺${sellingPrice}` : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              {selected && <Check className="h-3 w-3" aria-hidden />}
                              <span>
                                {service.name}
                                {hasPrices && (
                                  <>
                                    <span className="mx-1">·</span>
                                    <span className={selected ? "text-primary-foreground/80" : "text-muted-foreground"}>
                                      ₺{costPrice}/₺{sellingPrice}
                                    </span>
                                  </>
                                )}
                              </span>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Save/Cancel buttons */}
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="h-8"
          >
            {t('buttons.cancel', { ns: 'common' })}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="h-8"
          >
            {t('buttons.save', { ns: 'common' })}
          </Button>
        </div>
      </div>
    );
  }

  // View mode - show selected services or empty state
  return (
    <div className="space-y-3">
      {selectedServices.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground mb-2">{t('package.no_addons_selected', { ns: 'forms' })}</p>
          <Button
            type="button"
            variant="outline"
            onClick={handleEdit}
            className="h-8"
          >
            {t('package.add_services', { ns: 'forms' })}
          </Button>
        </div>
      ) : (
        <div className="rounded-md border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">{t('package.selected_addons', { ns: 'forms', count: selectedServices.length })}</span>
            <Button
              type="button"
              variant="outline"
              onClick={handleEdit}
              className="h-8"
            >
              {t('package.edit_addons', { ns: 'forms' })}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedServices.map((service) => {
              const costPrice = service.cost_price ?? 0;
              const sellingPrice = service.selling_price ?? service.price ?? 0;
              const hasPrices = costPrice > 0 || sellingPrice > 0;
              return (
                <Badge
                  key={service.id}
                  variant="secondary"
                  className="h-7 rounded-full px-3 text-xs"
                >
                  <span>
                    {service.name}
                    {hasPrices && (
                      <>
                        <span className="mx-1">·</span>
                        <span className="text-foreground/70">₺{costPrice}/₺{sellingPrice}</span>
                      </>
                    )}
                  </span>
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Duration options - now provided by translation function

export function AddPackageDialog({ open, onOpenChange, onPackageAdded }: AddPackageDialogProps) {
  const { t } = useTranslation(['forms', 'common']);
  
  const [packageData, setPackageData] = useState({
    name: "",
    description: "",
    price: "",
    applicable_types: [] as string[],
    default_add_ons: [] as string[],
    is_active: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch project types
  const { data: projectTypes = [] } = useQuery({
    queryKey: ['project_types'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get user's active organization  
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        return [];
      }

      const { data, error } = await supabase
        .from('project_types')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch services
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get user's active organization  
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        return [];
      }

      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  const resetForm = () => {
    setPackageData({
      name: "",
      description: "",
      price: "",
      applicable_types: [],
      default_add_ons: [],
      is_active: true
    });
    setErrors({});
  };

  const isDirty = Boolean(
    packageData.name.trim() ||
    packageData.description.trim() ||
    packageData.price.trim() ||
    packageData.applicable_types.length > 0 ||
    packageData.default_add_ons.length > 0
  );

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      resetForm();
      onOpenChange(false);
    },
    onSaveAndExit: async () => {
      await handleSubmit();
    },
    message: t('package.delete_confirmation.description')
  });

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!packageData.name.trim()) {
      newErrors.name = t('package.errors.name_required');
    }

    if (!packageData.price || isNaN(Number(packageData.price)) || Number(packageData.price) <= 0) {
      newErrors.price = t('common.errors.price_required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get user's active organization
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error("Organization required");
      }

      const { error } = await supabase
        .from('packages')
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          name: packageData.name.trim(),
          description: packageData.description.trim() || null,
          price: Number(packageData.price),
          duration: null,
          applicable_types: packageData.applicable_types,
          default_add_ons: packageData.default_add_ons,
          is_active: packageData.is_active
        });

      if (error) throw error;

      toast({
        title: t('common.toast.success'),
        description: t('package.success.added'),
      });

      onPackageAdded();
    } catch (error) {
      console.error('Error creating package:', error);
      toast({
        title: t('common.toast.error'),
        description: t('package.errors.add_failed'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      resetForm();
      onOpenChange(false);
    }
  };

  const footerActions = [
    {
      label: t('buttons.cancel', { ns: 'common' }),
      onClick: handleDirtyClose,
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? t('actions.saving', { ns: 'common' }) : t('buttons.save', { ns: 'common' }),
      onClick: handleSubmit,
      disabled: loading || !packageData.name.trim(),
      loading: loading
    }
  ];

  const toggleApplicableType = (type: string) => {
    setPackageData(prev => ({
      ...prev,
      applicable_types: prev.applicable_types.includes(type)
        ? prev.applicable_types.filter(t => t !== type)
        : [...prev.applicable_types, type]
    }));
  };


  return (
    <AppSheetModal
      title={t('package.add_title')}
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-6">
        {/* Package Name */}
        <div className="space-y-2">
          <Label htmlFor="name">{t('package.name')} *</Label>
          <Input
            id="name"
            value={packageData.name}
            onChange={(e) => setPackageData(prev => ({ ...prev, name: e.target.value }))}
            placeholder={t('package.name_placeholder', { ns: 'forms' })}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">{t('package.description')}</Label>
          <Textarea
            id="description"
            value={packageData.description}
            onChange={(e) => setPackageData(prev => ({ ...prev, description: e.target.value }))}
            placeholder={t('package.description')}
            rows={2}
          />
        </div>

        {/* Price */}
        <div className="space-y-2">
          <Label htmlFor="price">{t('package.price')} *</Label>
          <p className="text-xs text-muted-foreground">{t('package.price_help')}</p>
          <Input
            id="price"
            type="number"
            value={packageData.price}
            onChange={(e) => setPackageData(prev => ({ ...prev, price: e.target.value }))}
            placeholder={t('package.price_placeholder')}
            min="0"
            step="100"
          />
          {errors.price && <p className="text-sm text-destructive">{errors.price}</p>}
        </div>

        {/* Duration */}
        <div className="rounded-md border border-dashed bg-muted/10 p-3 text-xs text-muted-foreground">
          {t('package.session_type_hint')}
        </div>

        {/* Default Add-ons */}
        <div className="space-y-2">
          <Label>{t('package.default_add_ons')}</Label>
          <p className="text-xs text-muted-foreground mb-3">
            {t('package.add_ons_help_1')}{" "}
            <button
              type="button"
              onClick={() => navigate("/settings/services")}
              className="text-primary hover:underline"
            >
              {t('package.services_section')}
            </button>
            {" "}{t('package.add_ons_help_2')}
          </p>
          <ServiceAddOnsPicker
            services={services}
            value={packageData.default_add_ons}
            onChange={(addons) => setPackageData(prev => ({ ...prev, default_add_ons: addons }))}
            navigate={navigate}
          />
        </div>

        {/* Applicable Types */}
        <div className="space-y-2">
          <Label>{t('package.applicable_types')}</Label>
          <p className="text-xs text-muted-foreground mb-3">
            {t('package.applicable_types_help_1')}{" "}
            <button
              type="button"
              onClick={() => navigate("/settings/projects")}
              className="text-primary hover:underline"
            >
              {t('package.project_types')}
            </button>
            {" "}{t('package.applicable_types_help_2')}
          </p>
          {projectTypes.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">{t('package.no_project_types_exist')}</p>
              <button
                type="button"
                onClick={() => navigate("/settings/projects")}
                className="text-sm text-primary hover:underline mt-1"
              >
                {t('package.create_project_types_link')}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {projectTypes.map((type: any) => (
                <Badge
                  key={type.id}
                  variant={packageData.applicable_types.includes(type.name) ? "default" : "outline"}
                  className={`cursor-pointer transition-colors ${
                    packageData.applicable_types.includes(type.name) 
                      ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                  onClick={() => toggleApplicableType(type.name)}
                >
                  {type.name}
                  {packageData.applicable_types.includes(type.name) && (
                    <X className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Visibility */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="isActive">{t('package.visibility')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('package.visibility_help')}
            </p>
          </div>
          <Switch
            id="isActive"
            checked={packageData.is_active}
            onCheckedChange={(checked) => setPackageData(prev => ({ ...prev, is_active: checked }))}
          />
        </div>
      </div>
      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        onSaveAndExit={navigation.handleSaveAndExit}
        message={navigation.message}
      />

    </AppSheetModal>
  );
}

export function EditPackageDialog({ package: pkg, open, onOpenChange, onPackageUpdated }: EditPackageDialogProps) {
  const { t } = useTranslation(['forms', 'common']);
  const [packageData, setPackageData] = useState({
    name: "",
    description: "",
    price: "",
    applicable_types: [] as string[],
    default_add_ons: [] as string[],
    is_active: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch project types
  const { data: projectTypes = [] } = useQuery({
    queryKey: ['project_types'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get user's organization ID
      const { getUserOrganizationId } = await import('@/lib/organizationUtils');
      const organizationId = await getUserOrganizationId();

      if (!organizationId) {
        return [];
      }

      const { data, error } = await supabase
        .from('project_types')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch services
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get user's organization ID
      const { getUserOrganizationId } = await import('@/lib/organizationUtils');
      const organizationId = await getUserOrganizationId();

      if (!organizationId) {
        return [];
      }

      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (pkg && open) {
      setPackageData({
        name: pkg.name,
        description: pkg.description || "",
        price: pkg.price.toString(),
        applicable_types: [...pkg.applicable_types],
        default_add_ons: [...pkg.default_add_ons],
        is_active: pkg.is_active
      });
      setErrors({});
    }
  }, [pkg, open]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!packageData.name.trim()) {
      newErrors.name = t('package.errors.name_required');
    }

    if (!packageData.price || isNaN(Number(packageData.price)) || Number(packageData.price) <= 0) {
      newErrors.price = t('common.errors.price_required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      if (!pkg) return;

      const { error } = await supabase
        .from('packages')
        .update({
          name: packageData.name.trim(),
          description: packageData.description.trim() || null,
          price: Number(packageData.price),
          duration: null,
          applicable_types: packageData.applicable_types,
          default_add_ons: packageData.default_add_ons,
          is_active: packageData.is_active
        })
        .eq('id', pkg.id);

      if (error) throw error;

      toast({
        title: t('common.toast.success'),
        description: t('package.success.updated'),
      });

      onPackageUpdated();
    } catch (error) {
      console.error('Error updating package:', error);
      toast({
        title: t('common.toast.error'),
        description: t('package.errors.update_failed'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleApplicableType = (type: string) => {
    setPackageData(prev => ({
      ...prev,
      applicable_types: prev.applicable_types.includes(type)
        ? prev.applicable_types.filter(t => t !== type)
        : [...prev.applicable_types, type]
    }));
  };

  const resetEditForm = () => {
    if (!pkg) return;
    setPackageData({
      name: pkg.name,
      description: pkg.description || "",
      price: pkg.price.toString(),
      applicable_types: [...pkg.applicable_types],
      default_add_ons: [...pkg.default_add_ons],
      is_active: pkg.is_active
    });
    setErrors({});
  };

  const isDirtyEdit = pkg ? Boolean(
    packageData.name !== pkg.name ||
    packageData.description !== (pkg.description || "") ||
    packageData.price !== pkg.price.toString() ||
    JSON.stringify([...packageData.applicable_types].sort()) !== JSON.stringify([...pkg.applicable_types].sort()) ||
    JSON.stringify([...packageData.default_add_ons].sort()) !== JSON.stringify([...pkg.default_add_ons].sort()) ||
    packageData.is_active !== pkg.is_active
  ) : false;

  const navigationEdit = useModalNavigation({
    isDirty: isDirtyEdit,
    onDiscard: () => {
      resetEditForm();
      onOpenChange(false);
    },
    onSaveAndExit: async () => {
      await handleSubmit();
    },
    message: t('confirm.unsaved_changes', { ns: 'common' })
  });

  const handleDirtyCloseEdit = () => {
    const canClose = navigationEdit.handleModalClose();
    if (canClose) {
      resetEditForm();
      onOpenChange(false);
    }
  };

  const footerActionsEdit = [
    {
      label: t('buttons.cancel', { ns: 'common' }),
      onClick: handleDirtyCloseEdit,
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? t('actions.saving', { ns: 'common' }) : t('buttons.update', { ns: 'common' }),
      onClick: handleSubmit,
      disabled: loading || !packageData.name.trim(),
      loading: loading
    }
  ];


  if (!pkg) return null;

  return (
    <AppSheetModal
      title={t('package.edit_title')}
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirtyEdit}
      onDirtyClose={handleDirtyCloseEdit}
      footerActions={footerActionsEdit}
    >
      <div className="space-y-6">
        {/* Package Name */}
        <div className="space-y-2">
          <Label htmlFor="name">{t('package.name')} *</Label>
          <Input
            id="name"
            value={packageData.name}
            onChange={(e) => setPackageData(prev => ({ ...prev, name: e.target.value }))}
            placeholder={t('package.name_placeholder', { ns: 'forms' })}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">{t('package.description')}</Label>
          <Textarea
            id="description"
            value={packageData.description}
            onChange={(e) => setPackageData(prev => ({ ...prev, description: e.target.value }))}
            placeholder={t('package.description')}
            rows={2}
          />
        </div>

        {/* Price */}
        <div className="space-y-2">
          <Label htmlFor="price">{t('package.price')} *</Label>
          <p className="text-xs text-muted-foreground">{t('package.price_help')}</p>
          <Input
            id="price"
            type="number"
            value={packageData.price}
            onChange={(e) => setPackageData(prev => ({ ...prev, price: e.target.value }))}
            placeholder={t('package.price_placeholder')}
            min="0"
            step="100"
          />
          {errors.price && <p className="text-sm text-destructive">{errors.price}</p>}
        </div>

        <div className="rounded-md border border-dashed bg-muted/10 p-3 text-xs text-muted-foreground">
          {t('package.session_type_hint')}
        </div>

        {/* Default Add-ons */}
        <div className="space-y-2">
          <Label>{t('package.default_add_ons')}</Label>
          <p className="text-xs text-muted-foreground mb-3">
            {t('package.add_ons_help_1')}{" "}
            <button
              type="button"
              onClick={() => navigate("/settings/services")}
              className="text-primary hover:underline"
            >
              {t('package.services_section')}
            </button>
            {" "}{t('package.add_ons_help_2')}
          </p>
          <ServiceAddOnsPicker
            services={services}
            value={packageData.default_add_ons}
            onChange={(addons) => setPackageData(prev => ({ ...prev, default_add_ons: addons }))}
            navigate={navigate}
          />
        </div>

        {/* Applicable Types */}
        <div className="space-y-2">
          <Label>{t('package.applicable_types')}</Label>
          <p className="text-xs text-muted-foreground mb-3">
            {t('package.applicable_types_help_1')}{" "}
            <button
              type="button"
              onClick={() => navigate("/settings/projects")}
              className="text-primary hover:underline"
            >
              {t('package.project_types')}
            </button>
            {" "}{t('package.applicable_types_help_2')}
          </p>
          {projectTypes.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">{t('package.no_project_types_exist')}</p>
              <button
                type="button"
                onClick={() => navigate("/settings/projects")}
                className="text-sm text-primary hover:underline mt-1"
              >
                {t('package.create_project_types_link')}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {projectTypes.map((type: any) => (
                <Badge
                  key={type.id}
                  variant={packageData.applicable_types.includes(type.name) ? "default" : "outline"}
                  className={`cursor-pointer transition-colors ${
                    packageData.applicable_types.includes(type.name) 
                      ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                  onClick={() => toggleApplicableType(type.name)}
                >
                  {type.name}
                  {packageData.applicable_types.includes(type.name) && (
                    <X className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Visibility */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="isActive">{t('package.visibility')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('package.visibility_help')}
            </p>
          </div>
          <Switch
            id="isActive"
            checked={packageData.is_active}
            onCheckedChange={(checked) => setPackageData(prev => ({ ...prev, is_active: checked }))}
          />
        </div>
      </div>

      <NavigationGuardDialog
        open={navigationEdit.showGuard}
        onDiscard={navigationEdit.handleDiscardChanges}
        onStay={navigationEdit.handleStayOnModal}
        onSaveAndExit={navigationEdit.handleSaveAndExit}
        message={navigationEdit.message}
      />

    </AppSheetModal>
  );
}
