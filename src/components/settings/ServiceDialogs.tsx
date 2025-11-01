import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Users, Package } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "./NavigationGuardDialog";
import { cn } from "@/lib/utils";

type ServiceType = "coverage" | "deliverable";

interface ServiceFormState {
  name: string;
  description: string;
  category: string;
  price: string;
  cost_price: string;
  selling_price: string;
  extra: boolean;
  service_type: ServiceType;
  vendor_name: string;
  is_active: boolean;
}

const DEFAULT_CATEGORIES: Record<ServiceType, string[]> = {
  coverage: ["Lead Photographer", "Second Shooter", "Videographer", "Assistant", "Production Crew", "Styling"],
  deliverable: ["Albums", "Prints", "Digital", "Retouching", "Frames", "Extras", "Packages"],
};

const createFormState = (serviceType: ServiceType, overrides: Partial<ServiceFormState> = {}): ServiceFormState => ({
  name: "",
  description: "",
  category: "",
  price: "",
  cost_price: "",
  selling_price: "",
  extra: false,
  service_type: serviceType,
  vendor_name: "",
  is_active: true,
  ...overrides,
});

const useServiceCategories = (open: boolean) => {
  const [categoriesByType, setCategoriesByType] = useState<Record<ServiceType, string[]>>({
    coverage: [...DEFAULT_CATEGORIES.coverage],
    deliverable: [...DEFAULT_CATEGORIES.deliverable],
  });

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const fetchCategories = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const organizationId = await getUserOrganizationId();
        if (!organizationId) return;

        const { data, error } = await supabase
          .from("services")
          .select("category, service_type")
          .eq("organization_id", organizationId)
          .not("category", "is", null);

        if (error) throw error;

        if (!cancelled) {
          const next: Record<ServiceType, Set<string>> = {
            coverage: new Set(DEFAULT_CATEGORIES.coverage),
            deliverable: new Set(DEFAULT_CATEGORIES.deliverable),
          };

          (data || []).forEach((item) => {
            const category = typeof item.category === "string" ? item.category.trim() : "";
            if (!category) return;
            const type = item.service_type === "coverage" ? "coverage" : "deliverable";
            next[type].add(category);
          });

          setCategoriesByType({
            coverage: Array.from(next.coverage).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
            deliverable: Array.from(next.deliverable).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
          });
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };

    fetchCategories();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const addCategory = (type: ServiceType, category: string) => {
    const normalized = category.trim();
    if (!normalized) return;

    setCategoriesByType((prev) => {
      const updated = new Set(prev[type] ?? []);
      updated.add(normalized);
      return {
        ...prev,
        [type]: Array.from(updated).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
      };
    });
  };

  return { categoriesByType, addCategory };
};

interface AddServiceDialogProps {
  open: boolean;
  initialType: ServiceType;
  onOpenChange: (open: boolean) => void;
  onServiceAdded: () => void;
}


export function AddServiceDialog({ open, onOpenChange, onServiceAdded, initialType }: AddServiceDialogProps) {
  const { t } = useTranslation(["forms", "common"]);
  const [loading, setLoading] = useState(false);
  const { categoriesByType, addCategory } = useServiceCategories(open);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formData, setFormData] = useState<ServiceFormState>(() => createFormState(initialType));
  const [selectedType, setSelectedType] = useState<ServiceType | null>(() => initialType);

  useEffect(() => {
    if (open) {
      setFormData(createFormState(initialType));
      setShowNewCategoryInput(false);
      setNewCategoryName("");
      setSelectedType(initialType);
    }
  }, [open, initialType]);

  const serviceTypeOptions = useMemo(
    () => [
      {
        value: "coverage" as ServiceType,
        label: t("service.service_type_coverage"),
        description: t("service.service_type_coverage_hint"),
        icon: Users,
      },
      {
        value: "deliverable" as ServiceType,
        label: t("service.service_type_deliverable"),
        description: t("service.service_type_deliverable_hint"),
        icon: Package,
      },
    ],
    [t]
  );

  const handleServiceTypeSelect = useCallback((type: ServiceType) => {
    setSelectedType(type);
    setFormData((prev) => ({
      ...prev,
      service_type: type,
      category: "",
    }));
    setShowNewCategoryInput(false);
    setNewCategoryName("");
  }, []);

  const activeType: ServiceType = (selectedType ?? formData.service_type ?? initialType) as ServiceType;
  const defaultCategories = useMemo(() => DEFAULT_CATEGORIES[activeType], [activeType]);
  const customCategories = useMemo(
    () => (categoriesByType[activeType] ?? []).filter((category) => !defaultCategories.includes(category)),
    [categoriesByType, activeType, defaultCategories]
  );

  const hasSelectedType = selectedType !== null;
  const hasSelectedCategory = hasSelectedType && Boolean(formData.category.trim());
  const isSaveDisabled = loading || !hasSelectedCategory || !formData.name.trim();

  const typeCardBase = "group flex flex-col gap-3 rounded-xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

  const handleCreateNewCategory = () => {
    if (!selectedType) return;
    const normalized = newCategoryName.trim();
    if (!normalized) return;
    addCategory(selectedType, normalized);
    setFormData((prev) => ({ ...prev, category: normalized }));
    setShowNewCategoryInput(false);
    setNewCategoryName("");
  };

  const handleSubmit = async () => {
    if (!selectedType || !formData.category.trim()) {
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: t("toast.error", { ns: "common" }),
        description: t("service.errors.name_required"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error("Organization required");

      const isCoverage = selectedType === "coverage";

      const { error } = await supabase.from("services").insert({
        user_id: user.id,
        organization_id: organizationId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        category: formData.category.trim(),
        price: formData.price ? parseFloat(formData.price) : 0,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : 0,
        selling_price: formData.selling_price ? parseFloat(formData.selling_price) : 0,
        extra: formData.extra,
        service_type: selectedType,
        is_people_based: isCoverage,
        is_active: formData.is_active,
        vendor_name: formData.vendor_name.trim() || null,
        default_unit: null,
      });

      if (error) throw error;

      toast({
        title: t("toast.success", { ns: "common" }),
        description: t("service.success.added"),
      });

      setFormData(createFormState(initialType));
      setSelectedType(initialType);
      setShowNewCategoryInput(false);
      setNewCategoryName("");
      onOpenChange(false);
      onServiceAdded();
    } catch (error: any) {
      toast({
        title: t("toast.error", { ns: "common" }),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isDirty = useMemo(() => {
    const baseState = createFormState(initialType);
    return (
      formData.name.trim() !== baseState.name ||
      formData.description.trim() !== baseState.description ||
      formData.category.trim() !== baseState.category ||
      formData.price.trim() !== baseState.price ||
      formData.cost_price.trim() !== baseState.cost_price ||
      formData.selling_price.trim() !== baseState.selling_price ||
      formData.extra !== baseState.extra ||
      formData.service_type !== baseState.service_type ||
      formData.vendor_name.trim() !== baseState.vendor_name.trim() ||
      formData.is_active !== baseState.is_active
    );
  }, [formData, initialType]);

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      setFormData(createFormState(initialType));
      setShowNewCategoryInput(false);
      setNewCategoryName("");
      setSelectedType(initialType);
      onOpenChange(false);
    },
    onSaveAndExit: handleSubmit,
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      setFormData(createFormState(initialType));
      setShowNewCategoryInput(false);
      setNewCategoryName("");
      setSelectedType(initialType);
      onOpenChange(false);
    }
  };

  const footerActions = [
    {
      label: t("buttons.cancel", { ns: "common" }),
      onClick: handleDirtyClose,
      variant: "outline" as const,
      disabled: loading,
    },
    {
      label: loading ? t("actions.saving", { ns: "common" }) : t("buttons.save", { ns: "common" }),
      onClick: handleSubmit,
      disabled: isSaveDisabled,
      loading,
    },
  ];

  return (
    <AppSheetModal
      title={t("service.add_title")}
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("service.intro")}</p>

        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("service.service_type_label")} <span className="text-rose-500">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">{t("service.service_type_hint")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {serviceTypeOptions.map((option) => {
              const isSelected = selectedType === option.value;
              const isOther = hasSelectedType && !isSelected;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleServiceTypeSelect(option.value)}
                  className={cn(
                    typeCardBase,
                    hasSelectedType
                      ? "border border-emerald-200 bg-white/80"
                      : "border-dashed border-emerald-300/70 bg-white/60 hover:border-emerald-400",
                    isSelected && "border-emerald-500 bg-emerald-50 shadow-sm",
                    isOther && "opacity-60 hover:opacity-80",
                    hasSelectedType ? "py-3" : "py-4"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-full text-emerald-600 shadow-sm transition-all",
                      hasSelectedType ? "h-7 w-7 bg-emerald-100" : "h-9 w-9 bg-emerald-50"
                    )}
                  >
                    <option.icon className={cn("transition-transform", hasSelectedType ? "h-4 w-4" : "h-5 w-5")} aria-hidden="true" />
                  </span>
                  <div className={cn("flex-1 space-y-1", hasSelectedType && "space-y-0")}>
                    <div className={cn("font-semibold text-slate-900", hasSelectedType ? "text-sm" : "text-base")}>{option.label}</div>
                    {!hasSelectedType && (
                      <p className="text-xs leading-relaxed text-muted-foreground">{option.description}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {hasSelectedType && (
          <div className="space-y-2 transition-all duration-300">
            <Label htmlFor="category" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("service.category")} <span className="text-rose-500">*</span>
            </Label>
            {showNewCategoryInput ? (
              <div className="flex gap-2">
                <Input
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder={t("service.new_category_placeholder")}
                  className="rounded-xl"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleCreateNewCategory();
                    }
                    if (event.key === "Escape") {
                      setShowNewCategoryInput(false);
                      setNewCategoryName("");
                    }
                  }}
                />
                <Button type="button" size="sm" onClick={handleCreateNewCategory} disabled={!newCategoryName.trim()} className="w-16">
                  {t("buttons.add", { ns: "common" })}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowNewCategoryInput(false);
                    setNewCategoryName("");
                  }}
                  className="w-16"
                >
                  {t("buttons.cancel", { ns: "common" })}
                </Button>
              </div>
            ) : (
              <Select
                value={formData.category}
                onValueChange={(value) => {
                  if (value === "create-new") {
                    setShowNewCategoryInput(true);
                  } else {
                    setFormData((prev) => ({ ...prev, category: value }));
                  }
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={t("service.category_placeholder")} />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg z-50">
                  <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("service.default_categories_label")}
                  </div>
                  {defaultCategories.map((category) => (
                    <SelectItem key={category} value={category} className="hover:bg-accent hover:text-accent-foreground">
                      {category}
                    </SelectItem>
                  ))}

                  {customCategories.length > 0 && (
                    <>
                      <SelectSeparator />
                      <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t("service.custom_categories_label")}
                      </div>
                      {customCategories.map((category) => (
                        <SelectItem key={category} value={category} className="hover:bg-accent hover:text-accent-foreground">
                          {category}
                        </SelectItem>
                      ))}
                    </>
                  )}

                  <SelectSeparator />
                  <SelectItem value="create-new" className="text-primary hover:bg-accent hover:text-accent-foreground">
                    <div className="flex items-center">
                      <Plus className="mr-2 h-4 w-4" />
                      {t("service.new_category")}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {hasSelectedCategory && (
          <div className="space-y-4 transition-all duration-300">
            <div className="space-y-2">
              <Label htmlFor="name">
                {t("service.name")} <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={t("service.name_placeholder")}
                maxLength={100}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("service.description")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                placeholder={t("service.description_placeholder")}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cost_price">{t("service.cost_price")} (TRY)</Label>
                <Input
                  id="cost_price"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(event) => setFormData((prev) => ({ ...prev, cost_price: event.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="selling_price">{t("service.selling_price")} (TRY)</Label>
                <Input
                  id="selling_price"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={formData.selling_price}
                  onChange={(event) => setFormData((prev) => ({ ...prev, selling_price: event.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor_name">
                {t("service.vendor_label")}
                <span className="ml-1 text-xs text-muted-foreground">{t("service.optional_hint")}</span>
              </Label>
              <Input
                id="vendor_name"
                value={formData.vendor_name}
                onChange={(event) => setFormData((prev) => ({ ...prev, vendor_name: event.target.value }))}
                placeholder={t("service.vendor_placeholder")}
              />
            </div>

            <div className="flex items-start justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium leading-none">{t("service.visibility_label")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("service.visibility_help")}</p>
              </div>
              <Switch
                id="service-is-active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
                aria-label={t("service.visibility_label")}
              />
            </div>
          </div>
        )}
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
interface EditServiceDialogProps {
  service: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onServiceUpdated: () => void;
}


export function EditServiceDialog({ service, open, onOpenChange, onServiceUpdated }: EditServiceDialogProps) {
  const { t } = useTranslation(["forms", "common"]);
  const [loading, setLoading] = useState(false);
  const { categoriesByType, addCategory } = useServiceCategories(open);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formData, setFormData] = useState<ServiceFormState>(() => createFormState("deliverable"));
  const [selectedType, setSelectedType] = useState<ServiceType | null>(null);

  useEffect(() => {
    if (service && open) {
      const resolvedType = (service.service_type ?? "deliverable") as ServiceType;
      setFormData(
        createFormState(resolvedType, {
          name: service.name || "",
          description: service.description || "",
          category: service.category || "",
          price: service.price?.toString() || "",
          cost_price: service.cost_price?.toString() || "",
          selling_price: service.selling_price?.toString() || "",
          extra: service.extra ?? false,
          service_type: resolvedType,
          vendor_name: service.vendor_name || "",
          is_active: service.is_active ?? true,
        })
      );
      setShowNewCategoryInput(false);
      setNewCategoryName("");
      setSelectedType(resolvedType);
    }
  }, [service, open]);

  const serviceTypeOptions = useMemo(
    () => [
      {
        value: "coverage" as ServiceType,
        label: t("service.service_type_coverage"),
        description: t("service.service_type_coverage_hint"),
        icon: Users,
      },
      {
        value: "deliverable" as ServiceType,
        label: t("service.service_type_deliverable"),
        description: t("service.service_type_deliverable_hint"),
        icon: Package,
      },
    ],
    [t]
  );

  const handleServiceTypeSelect = useCallback((type: ServiceType) => {
    setSelectedType(type);
    setFormData((prev) => ({
      ...prev,
      service_type: type,
      category: "",
    }));
    setShowNewCategoryInput(false);
    setNewCategoryName("");
  }, []);

  const activeType: ServiceType = (selectedType ?? formData.service_type ?? "deliverable") as ServiceType;
  const defaultCategories = useMemo(() => DEFAULT_CATEGORIES[activeType], [activeType]);
  const customCategories = useMemo(
    () => (categoriesByType[activeType] ?? []).filter((category) => !defaultCategories.includes(category)),
    [categoriesByType, activeType, defaultCategories]
  );

  const hasSelectedType = selectedType !== null;
  const hasSelectedCategory = Boolean(formData.category?.trim());
  const isSaveDisabled =
    loading || !hasSelectedType || !hasSelectedCategory || !formData.name.trim();

  const typeCardBase = "group flex flex-col gap-3 rounded-xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

  const handleCreateNewCategory = () => {
    const typeForCategory = selectedType ?? formData.service_type;
    if (!typeForCategory) return;
    const normalized = newCategoryName.trim();
    if (!normalized) return;
    addCategory(typeForCategory, normalized);
    setFormData((prev) => ({ ...prev, category: normalized }));
    setShowNewCategoryInput(false);
    setNewCategoryName("");
  };

  const handleSubmit = async () => {
    if (!selectedType || !service) {
      return;
    }

    if (!formData.category.trim()) {
      toast({
        title: t("toast.error", { ns: "common" }),
        description: t("service.errors.category_required"),
        variant: "destructive",
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: t("toast.error", { ns: "common" }),
        description: t("service.errors.name_required"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("services")
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          category: formData.category.trim(),
          price: formData.price ? parseFloat(formData.price) : 0,
          cost_price: formData.cost_price ? parseFloat(formData.cost_price) : 0,
          selling_price: formData.selling_price ? parseFloat(formData.selling_price) : 0,
          extra: formData.extra,
          service_type: selectedType,
          is_people_based: selectedType === "coverage" ? (service?.is_people_based ?? true) : false,
          vendor_name: formData.vendor_name.trim() || null,
          is_active: formData.is_active,
        })
        .eq("id", service?.id);

      if (error) throw error;

      toast({
        title: t("toast.success", { ns: "common" }),
        description: t("service.success.updated"),
      });

      onServiceUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: t("toast.error", { ns: "common" }),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isDirty = useMemo(() => {
    if (!service) return false;
    const baseState = createFormState((service.service_type ?? "deliverable") as ServiceType, {
      name: service.name || "",
      description: service.description || "",
      category: service.category || "",
      price: service.price?.toString() || "",
      cost_price: service.cost_price?.toString() || "",
      selling_price: service.selling_price?.toString() || "",
      extra: service.extra ?? false,
      service_type: (service.service_type ?? "deliverable") as ServiceType,
      vendor_name: service.vendor_name || "",
      is_active: service.is_active ?? true,
    });

    return (
      formData.name.trim() !== baseState.name.trim() ||
      formData.description.trim() !== baseState.description?.trim() ||
      formData.category.trim() !== baseState.category?.trim() ||
      formData.price.trim() !== baseState.price.trim() ||
      formData.cost_price.trim() !== baseState.cost_price.trim() ||
      formData.selling_price.trim() !== baseState.selling_price.trim() ||
      formData.extra !== baseState.extra ||
      formData.service_type !== baseState.service_type ||
      formData.vendor_name.trim() !== baseState.vendor_name?.trim() ||
      formData.is_active !== baseState.is_active
    );
  }, [formData, service]);

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      if (!service) {
        onOpenChange(false);
        return;
      }
      const resolvedType = (service.service_type ?? "deliverable") as ServiceType;
      setFormData(
        createFormState(resolvedType, {
          name: service.name || "",
          description: service.description || "",
          category: service.category || "",
          price: service.price?.toString() || "",
          cost_price: service.cost_price?.toString() || "",
          selling_price: service.selling_price?.toString() || "",
          extra: service.extra ?? false,
          service_type: resolvedType,
          vendor_name: service.vendor_name || "",
          is_active: service.is_active ?? true,
        })
      );
      setShowNewCategoryInput(false);
      setNewCategoryName("");
      setSelectedType(resolvedType);
      onOpenChange(false);
    },
    onSaveAndExit: handleSubmit,
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose && service) {
      const resolvedType = (service.service_type ?? "deliverable") as ServiceType;
      setFormData(
        createFormState(resolvedType, {
          name: service.name || "",
          description: service.description || "",
          category: service.category || "",
          price: service.price?.toString() || "",
          cost_price: service.cost_price?.toString() || "",
          selling_price: service.selling_price?.toString() || "",
          extra: service.extra ?? false,
          service_type: resolvedType,
          vendor_name: service.vendor_name || "",
          is_active: service.is_active ?? true,
        })
      );
      setShowNewCategoryInput(false);
      setNewCategoryName("");
      setSelectedType(resolvedType);
      onOpenChange(false);
    }
  };

  const footerActions = [
    {
      label: t("buttons.cancel", { ns: "common" }),
      onClick: handleDirtyClose,
      variant: "outline" as const,
      disabled: loading,
    },
    {
      label: loading ? t("actions.saving", { ns: "common" }) : t("buttons.save", { ns: "common" }),
      onClick: handleSubmit,
      disabled: isSaveDisabled,
      loading,
    },
  ];

  return (
    <AppSheetModal
      title={t("service.edit_title")}
      isOpen={open}
      onOpenChange={onOpenChange}
      size="content"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("service.intro")}</p>

        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("service.service_type_label")} <span className="text-rose-500">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">{t("service.service_type_hint")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {serviceTypeOptions.map((option) => {
              const isSelected = selectedType === option.value;
              const isOther = hasSelectedType && !isSelected;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleServiceTypeSelect(option.value)}
                  className={cn(
                    typeCardBase,
                    hasSelectedType
                      ? "border border-emerald-200 bg-white/80"
                      : "border-dashed border-emerald-300/70 bg-white/60 hover:border-emerald-400",
                    isSelected && "border-emerald-500 bg-emerald-50 shadow-sm",
                    isOther && "opacity-60 hover:opacity-80",
                    hasSelectedType ? "py-3" : "py-4"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-full text-emerald-600 shadow-sm transition-all",
                      hasSelectedType ? "h-7 w-7 bg-emerald-100" : "h-9 w-9 bg-emerald-50"
                    )}
                  >
                    <option.icon className={cn("transition-transform", hasSelectedType ? "h-4 w-4" : "h-5 w-5")} aria-hidden="true" />
                  </span>
                  <div className={cn("flex-1 space-y-1", hasSelectedType && "space-y-0")}>
                    <div className={cn("font-semibold text-slate-900", hasSelectedType ? "text-sm" : "text-base")}>{option.label}</div>
                    {!hasSelectedType && (
                      <p className="text-xs leading-relaxed text-muted-foreground">{option.description}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {hasSelectedType && (
          <div className="space-y-2 transition-all duration-300">
            <Label htmlFor="edit-category" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("service.category")} <span className="text-rose-500">*</span>
            </Label>
            {showNewCategoryInput ? (
              <div className="flex gap-2">
                <Input
                  id="edit-category"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder={t("service.new_category_placeholder")}
                  className="rounded-xl"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleCreateNewCategory();
                    }
                    if (event.key === "Escape") {
                      setShowNewCategoryInput(false);
                      setNewCategoryName("");
                    }
                  }}
                />
                <Button type="button" size="sm" onClick={handleCreateNewCategory} disabled={!newCategoryName.trim()} className="w-16">
                  {t("buttons.add", { ns: "common" })}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowNewCategoryInput(false);
                    setNewCategoryName("");
                  }}
                  className="w-16"
                >
                  {t("buttons.cancel", { ns: "common" })}
                </Button>
              </div>
            ) : (
              <Select
                value={formData.category}
                onValueChange={(value) => {
                  if (value === "create-new") {
                    setShowNewCategoryInput(true);
                  } else {
                    setFormData((prev) => ({ ...prev, category: value }));
                  }
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={t("service.category_placeholder")} />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg z-50">
                  <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("service.default_categories_label")}
                  </div>
                  {defaultCategories.map((category) => (
                    <SelectItem key={category} value={category} className="hover:bg-accent hover:text-accent-foreground">
                      {category}
                    </SelectItem>
                  ))}

                  {customCategories.length > 0 && (
                    <>
                      <SelectSeparator />
                      <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t("service.custom_categories_label")}
                      </div>
                      {customCategories.map((category) => (
                        <SelectItem key={category} value={category} className="hover:bg-accent hover:text-accent-foreground">
                          {category}
                        </SelectItem>
                      ))}
                    </>
                  )}

                  <SelectSeparator />
                  <SelectItem value="create-new" className="text-primary hover:bg-accent hover:text-accent-foreground">
                    <div className="flex items-center">
                      <Plus className="mr-2 h-4 w-4" />
                      {t("service.new_category")}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {hasSelectedCategory && (
          <div className="space-y-4 transition-all duration-300">
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                {t("service.name")} <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={t("service.name_placeholder")}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">{t("service.description")}</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                placeholder={t("service.description_placeholder")}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-cost-price">{t("service.cost_price")} (TRY)</Label>
                <Input
                  id="edit-cost-price"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(event) => setFormData((prev) => ({ ...prev, cost_price: event.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-selling-price">{t("service.selling_price")} (TRY)</Label>
                <Input
                  id="edit-selling-price"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={formData.selling_price}
                  onChange={(event) => setFormData((prev) => ({ ...prev, selling_price: event.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-vendor-name">
                {t("service.vendor_label")}
                <span className="ml-1 text-xs text-muted-foreground">{t("service.optional_hint")}</span>
              </Label>
              <Input
                id="edit-vendor-name"
                value={formData.vendor_name}
                onChange={(event) => setFormData((prev) => ({ ...prev, vendor_name: event.target.value }))}
                placeholder={t("service.vendor_placeholder")}
              />
            </div>

            <div className="flex items-start justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium leading-none">{t("service.visibility_label")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("service.visibility_help")}</p>
              </div>
              <Switch
                id="edit-service-is-active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
                aria-label={t("service.visibility_label")}
              />
            </div>
          </div>
        )}
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
