import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "./NavigationGuardDialog";

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

const PREDEFINED_CATEGORIES = ["Albums", "Prints", "Extras", "Digital", "Packages", "Retouching", "Frames"];

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
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const fetchCategories = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const organizationId = await getUserOrganizationId();
        if (!organizationId) return;

        const { data, error } = await supabase
          .from("services")
          .select("category")
          .eq("organization_id", organizationId)
          .not("category", "is", null);

        if (error) throw error;

        if (!cancelled) {
          const uniqueCategories = [...new Set((data || []).map((item) => item.category).filter(Boolean))] as string[];
          const customCategories = uniqueCategories.filter((category) => !PREDEFINED_CATEGORIES.includes(category));
          setCategories(customCategories);
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

  return { categories, setCategories };
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
  const { categories, setCategories } = useServiceCategories(open);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formData, setFormData] = useState<ServiceFormState>(() => createFormState(initialType));

  useEffect(() => {
    if (open) {
      setFormData(createFormState(initialType));
      setShowNewCategoryInput(false);
      setNewCategoryName("");
    }
  }, [open, initialType]);

  const serviceTypeOptions = useMemo(
    () => [
      {
        value: "coverage" as ServiceType,
        label: t("service.service_type_coverage"),
        description: t("service.service_type_coverage_hint"),
      },
      {
        value: "deliverable" as ServiceType,
        label: t("service.service_type_deliverable"),
        description: t("service.service_type_deliverable_hint"),
      },
    ],
    [t]
  );

  const handleServiceTypeChange = (type: ServiceType) => {
    setFormData((prev) => ({
      ...prev,
      service_type: type,
    }));
  };

  const handleCreateNewCategory = () => {
    if (!newCategoryName.trim()) return;

    const normalized = newCategoryName.trim();
    setFormData((prev) => ({ ...prev, category: normalized }));
    setCategories((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setShowNewCategoryInput(false);
    setNewCategoryName("");
  };

  const handleSubmit = async () => {
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error("Organization required");

      const serviceType = formData.service_type;
      const isCoverage = serviceType === "coverage";

      const { error } = await supabase.from("services").insert({
        user_id: user.id,
        organization_id: organizationId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        category: formData.category.trim() || null,
        price: formData.price ? parseFloat(formData.price) : 0,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : 0,
        selling_price: formData.selling_price ? parseFloat(formData.selling_price) : 0,
        extra: formData.extra,
        service_type: serviceType,
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
      disabled: loading || !formData.name.trim(),
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
          <Label>{t("service.service_type_label")}</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {serviceTypeOptions.map((option) => {
              const isSelected = formData.service_type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleServiceTypeChange(option.value)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="font-medium">{option.label}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">{t("service.category")} *</Label>
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
                {PREDEFINED_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category} className="hover:bg-accent hover:text-accent-foreground">
                    {category}
                  </SelectItem>
                ))}

                {categories.length > 0 && (
                  <>
                    <SelectSeparator />
                    <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("service.custom_categories_label")}
                    </div>
                    {categories.map((category) => (
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

        <div className="space-y-2">
          <Label htmlFor="name">{t("service.name")} *</Label>
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
            <p className="text-xs text-muted-foreground mt-1">{t("service.visibility_help")}</p>
          </div>
          <Switch
            id="service-is-active"
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
            aria-label={t("service.visibility_label")}
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

interface EditServiceDialogProps {
  service: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onServiceUpdated: () => void;
}

export function EditServiceDialog({ service, open, onOpenChange, onServiceUpdated }: EditServiceDialogProps) {
  const { t } = useTranslation(["forms", "common"]);
  const [loading, setLoading] = useState(false);
  const { categories, setCategories } = useServiceCategories(open);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formData, setFormData] = useState<ServiceFormState>(() => createFormState("deliverable"));

  useEffect(() => {
    if (service && open) {
      setFormData(
        createFormState((service.service_type ?? "deliverable") as ServiceType, {
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
        })
      );
      setShowNewCategoryInput(false);
      setNewCategoryName("");
    }
  }, [service, open]);

  const serviceTypeOptions = useMemo(
    () => [
      {
        value: "coverage" as ServiceType,
        label: t("service.service_type_coverage"),
        description: t("service.service_type_coverage_hint"),
      },
      {
        value: "deliverable" as ServiceType,
        label: t("service.service_type_deliverable"),
        description: t("service.service_type_deliverable_hint"),
      },
    ],
    [t]
  );

  const handleServiceTypeChange = (type: ServiceType) => {
    setFormData((prev) => ({
      ...prev,
      service_type: type,
    }));
  };

  const handleCreateNewCategory = () => {
    if (!newCategoryName.trim()) return;
    const normalized = newCategoryName.trim();
    setFormData((prev) => ({ ...prev, category: normalized }));
    setCategories((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setShowNewCategoryInput(false);
    setNewCategoryName("");
  };

  const handleSubmit = async () => {
    if (!service || !formData.name.trim()) {
      toast({
        title: t("toast.error", { ns: "common" }),
        description: t("service.errors.name_required"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const serviceType = formData.service_type;
      const isCoverage = serviceType === "coverage";
      const resolvedStaffing = isCoverage ? (service?.is_people_based ?? true) : false;
      const preservedUnit = service?.default_unit ?? null;

      const { error } = await supabase
        .from("services")
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          category: formData.category.trim() || null,
          price: formData.price ? parseFloat(formData.price) : 0,
          cost_price: formData.cost_price ? parseFloat(formData.cost_price) : 0,
          selling_price: formData.selling_price ? parseFloat(formData.selling_price) : 0,
          extra: formData.extra,
          service_type: serviceType,
          is_people_based: resolvedStaffing,
          default_unit: preservedUnit,
          is_active: formData.is_active,
          vendor_name: formData.vendor_name.trim() || null,
        })
        .eq("id", service.id);

      if (error) throw error;

      toast({
        title: t("toast.success", { ns: "common" }),
        description: t("service.success.updated"),
      });

      onOpenChange(false);
      onServiceUpdated();
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
      formData.name !== baseState.name ||
      formData.description !== baseState.description ||
      formData.category !== baseState.category ||
      formData.price !== baseState.price ||
      formData.cost_price !== baseState.cost_price ||
      formData.selling_price !== baseState.selling_price ||
      formData.extra !== baseState.extra ||
      formData.service_type !== baseState.service_type ||
      formData.vendor_name !== baseState.vendor_name ||
      formData.is_active !== baseState.is_active
    );
  }, [formData, service]);

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      if (!service) return;
      setFormData(
        createFormState((service.service_type ?? "deliverable") as ServiceType, {
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
        })
      );
      setShowNewCategoryInput(false);
      setNewCategoryName("");
      onOpenChange(false);
    },
    onSaveAndExit: handleSubmit,
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose && service) {
      setFormData(
        createFormState((service.service_type ?? "deliverable") as ServiceType, {
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
        })
      );
      setShowNewCategoryInput(false);
      setNewCategoryName("");
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
      disabled: loading || !formData.name.trim(),
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
          <Label>{t("service.service_type_label")}</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {serviceTypeOptions.map((option) => {
              const isSelected = formData.service_type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleServiceTypeChange(option.value)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="font-medium">{option.label}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-category">{t("service.category")} *</Label>
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
                {PREDEFINED_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category} className="hover:bg-accent hover:text-accent-foreground">
                    {category}
                  </SelectItem>
                ))}

                {categories.length > 0 && (
                  <>
                    <SelectSeparator />
                    <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("service.custom_categories_label")}
                    </div>
                    {categories.map((category) => (
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

        <div className="space-y-2">
          <Label htmlFor="edit-name">{t("service.name")} *</Label>
          <Input
            id="edit-name"
            value={formData.name}
            onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
            placeholder={t("service.name_placeholder")}
            maxLength={100}
            className="rounded-xl"
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
