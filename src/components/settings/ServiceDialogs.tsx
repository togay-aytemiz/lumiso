import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
import { useTranslation } from "react-i18next";

interface AddServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onServiceAdded: () => void;
}

export function AddServiceDialog({ open, onOpenChange, onServiceAdded }: AddServiceDialogProps) {
  const { t } = useTranslation('forms');
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    cost_price: "",
    selling_price: "",
    extra: false,
  });

  // Predefined categories and fetch existing ones
  const predefinedCategories = ["Albums", "Prints", "Extras", "Digital", "Packages", "Retouching", "Frames"];
  
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get user's active organization
        const organizationId = await getUserOrganizationId();
        if (!organizationId) {
          return;
        }

        const { data, error } = await supabase
          .from('services')
          .select('category')
          .eq('organization_id', organizationId)
          .not('category', 'is', null);

        if (error) throw error;

        const uniqueCategories = [...new Set(data.map(item => item.category).filter(Boolean))];
        const customCategories = uniqueCategories.filter(cat => !predefinedCategories.includes(cat));
        setCategories(customCategories);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    if (open) {
      fetchCategories();
      setShowNewCategoryInput(false);
      setNewCategoryName("");
    }
  }, [open]);

  const handleCreateNewCategory = () => {
    if (newCategoryName.trim()) {
      setFormData(prev => ({ ...prev, category: newCategoryName.trim() }));
      setCategories(prev => [...prev, newCategoryName.trim()]);
      setShowNewCategoryInput(false);
      setNewCategoryName("");
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: t('common.errors.error'),
        description: t('service.errors.name_required'),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user's active organization
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error("Organization required");
      }

      const { error } = await supabase
        .from('services')
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          category: formData.category.trim() || null,
          price: formData.price ? parseFloat(formData.price) : 0,
          cost_price: formData.cost_price ? parseFloat(formData.cost_price) : 0,
          selling_price: formData.selling_price ? parseFloat(formData.selling_price) : 0,
          extra: formData.extra,
        });

      if (error) throw error;

      toast({
        title: t('common.success.success'),
        description: t('service.success.added')
      });

      setFormData({
        name: "",
        description: "",
        category: "",
        price: "",
        cost_price: "",
        selling_price: "",
        extra: false,
      });
      onOpenChange(false);
      onServiceAdded();
    } catch (error: any) {
      toast({
        title: t('common.errors.error'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isDirty = Boolean(
    formData.name.trim() ||
    formData.description.trim() ||
    formData.category.trim() ||
    formData.price.trim() ||
    formData.cost_price.trim() ||
    formData.selling_price.trim() ||
    formData.extra
  );

  const handleDirtyClose = () => {
    if (window.confirm(t('service.unsaved_changes.description'))) {
      setFormData({
        name: "",
        description: "",
        category: "",
        price: "",
        cost_price: "",
        selling_price: "",
        extra: false,
      });
      onOpenChange(false);
    }
  };

  const footerActions = [
    {
      label: t('common.buttons.cancel'),
      onClick: () => onOpenChange(false),
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? t('common.buttons.saving') : t('common.buttons.save'),
      onClick: handleSubmit,
      disabled: loading || !formData.name.trim(),
      loading: loading
    }
  ];

  return (
    <AppSheetModal
      title={t('service.add_title')}
      isOpen={open}
      onOpenChange={onOpenChange}
      size="default"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('service.description_placeholder')}</p>
        
        <div className="space-y-2">
          <Label htmlFor="category">{t('service.category')} *</Label>
          {showNewCategoryInput ? (
            <div className="flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter new category name"
                className="rounded-xl"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateNewCategory();
                  }
                  if (e.key === 'Escape') {
                    setShowNewCategoryInput(false);
                    setNewCategoryName("");
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleCreateNewCategory}
                disabled={!newCategoryName.trim()}
                className="w-16"
              >
                Add
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
                Cancel
              </Button>
            </div>
          ) : (
            <Select value={formData.category} onValueChange={(value) => {
              if (value === "create-new") {
                setShowNewCategoryInput(true);
              } else {
                setFormData(prev => ({ ...prev, category: value }));
              }
            }}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={t('service.category_placeholder')} />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                {/* Default Categories */}
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Default Categories
                </div>
                {predefinedCategories.map((category) => (
                  <SelectItem key={category} value={category} className="hover:bg-accent hover:text-accent-foreground">
                    {category}
                  </SelectItem>
                ))}
                
                {/* Custom Categories */}
                {categories.length > 0 && (
                  <>
                    <SelectSeparator />
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Custom Categories
                    </div>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category} className="hover:bg-accent hover:text-accent-foreground">
                        {category}
                      </SelectItem>
                    ))}
                  </>
                )}
                
                {/* Create New */}
                <SelectSeparator />
                <SelectItem value="create-new" className="text-primary hover:bg-accent hover:text-accent-foreground">
                  <div className="flex items-center">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('service.new_category')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">{t('service.name')} *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder={t('service.name_placeholder')}
            maxLength={100}
            className="rounded-xl"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cost_price">{t('service.cost_price')} (TRY)</Label>
            <Input
              id="cost_price"
              type="number"
              step="0.01"
              value={formData.cost_price}
              onChange={(e) => setFormData(prev => ({ ...prev, cost_price: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="selling_price">{t('service.selling_price')} (TRY)</Label>
            <Input
              id="selling_price"
              type="number"
              step="0.01"
              value={formData.selling_price}
              onChange={(e) => setFormData(prev => ({ ...prev, selling_price: e.target.value }))}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t('service.description')}</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder={t('service.description_placeholder')}
            rows={4}
            className="resize-none"
          />
        </div>
      </div>
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
  const { t } = useTranslation('forms');
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    cost_price: "",
    selling_price: "",
    extra: false,
  });

  // Predefined categories and fetch existing ones
  const predefinedCategories = ["Albums", "Prints", "Extras", "Digital", "Packages", "Retouching", "Frames"];
  
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get user's organization ID
        const { getUserOrganizationId } = await import('@/lib/organizationUtils');
        const organizationId = await getUserOrganizationId();

        if (!organizationId) {
          return;
        }

        const { data, error } = await supabase
          .from('services')
          .select('category')
          .eq('organization_id', organizationId)
          .not('category', 'is', null);

        if (error) throw error;

        const uniqueCategories = [...new Set(data.map(item => item.category).filter(Boolean))];
        const customCategories = uniqueCategories.filter(cat => !predefinedCategories.includes(cat));
        setCategories(customCategories);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    if (open) {
      fetchCategories();
      setShowNewCategoryInput(false);
      setNewCategoryName("");
    }
  }, [open]);

  const handleCreateNewCategory = () => {
    if (newCategoryName.trim()) {
      setFormData(prev => ({ ...prev, category: newCategoryName.trim() }));
      setCategories(prev => [...prev, newCategoryName.trim()]);
      setShowNewCategoryInput(false);
      setNewCategoryName("");
    }
  };

  useEffect(() => {
    if (service && open) {
      setFormData({
        name: service.name,
        description: service.description || "",
        category: service.category || "",
        price: service.price?.toString() || "",
        cost_price: service.cost_price?.toString() || "",
        selling_price: service.selling_price?.toString() || "",
        extra: service.extra || false,
      });
    }
  }, [service, open]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: t('common.errors.error'),
        description: t('service.errors.name_required'),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('services')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          category: formData.category.trim() || null,
          price: formData.price ? parseFloat(formData.price) : 0,
          cost_price: formData.cost_price ? parseFloat(formData.cost_price) : 0,
          selling_price: formData.selling_price ? parseFloat(formData.selling_price) : 0,
          extra: formData.extra,
        })
        .eq('id', service.id);

      if (error) throw error;

      toast({
        title: t('common.success.success'),
        description: t('service.success.updated')
      });

      onOpenChange(false);
      onServiceUpdated();
    } catch (error: any) {
      toast({
        title: t('common.errors.error'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!service) return null;

  const isDirty = Boolean(
    formData.name !== service.name ||
    formData.description !== (service.description || "") ||
    formData.category !== (service.category || "") ||
    formData.price !== (service.price?.toString() || "") ||
    formData.cost_price !== (service.cost_price?.toString() || "") ||
    formData.selling_price !== (service.selling_price?.toString() || "") ||
    formData.extra !== (service.extra || false)
  );

  const handleDirtyClose = () => {
    if (window.confirm(t('service.unsaved_changes.description'))) {
      onOpenChange(false);
    }
  };

  const footerActions = [
    {
      label: t('common.buttons.cancel'),
      onClick: () => onOpenChange(false),
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? t('common.buttons.updating') : t('common.buttons.update'),
      onClick: handleSubmit,
      disabled: loading || !formData.name.trim(),
      loading: loading
    }
  ];

  return (
    <AppSheetModal
      title={t('service.edit_title')}
      isOpen={open}
      onOpenChange={onOpenChange}
      size="default"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="category">{t('service.category')}</Label>
          {showNewCategoryInput ? (
            <div className="flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter new category name"
                className="rounded-xl"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateNewCategory();
                  }
                  if (e.key === 'Escape') {
                    setShowNewCategoryInput(false);
                    setNewCategoryName("");
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleCreateNewCategory}
                disabled={!newCategoryName.trim()}
                className="w-16"
              >
                Add
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
                Cancel
              </Button>
            </div>
          ) : (
            <Select value={formData.category} onValueChange={(value) => {
              if (value === "create-new") {
                setShowNewCategoryInput(true);
              } else {
                setFormData(prev => ({ ...prev, category: value }));
              }
            }}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={t('service.category_placeholder')} />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                {/* Default Categories */}
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Default Categories
                </div>
                {predefinedCategories.map((category) => (
                  <SelectItem key={category} value={category} className="hover:bg-accent hover:text-accent-foreground">
                    {category}
                  </SelectItem>
                ))}
                
                {/* Custom Categories */}
                {categories.length > 0 && (
                  <>
                    <SelectSeparator />
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Custom Categories
                    </div>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category} className="hover:bg-accent hover:text-accent-foreground">
                        {category}
                      </SelectItem>
                    ))}
                  </>
                )}
                
                {/* Create New */}
                <SelectSeparator />
                <SelectItem value="create-new" className="text-primary hover:bg-accent hover:text-accent-foreground">
                  <div className="flex items-center">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('service.new_category')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">{t('service.name')} *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder={t('service.name_placeholder')}
            maxLength={100}
            className="rounded-xl"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cost_price">{t('service.cost_price')} (TRY)</Label>
            <Input
              id="cost_price"
              type="number"
              step="0.01"
              value={formData.cost_price}
              onChange={(e) => setFormData(prev => ({ ...prev, cost_price: e.target.value }))}
              placeholder="0.00"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="selling_price">{t('service.selling_price')} (TRY)</Label>
            <Input
              id="selling_price"
              type="number"
              step="0.01"
              value={formData.selling_price}
              onChange={(e) => setFormData(prev => ({ ...prev, selling_price: e.target.value }))}
              placeholder="0.00"
              className="rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t('service.description')}</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder={t('service.description_placeholder')}
            rows={4}
            className="resize-none rounded-xl"
          />
        </div>
      </div>
    </AppSheetModal>
  );
}