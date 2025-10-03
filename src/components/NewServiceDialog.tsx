import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useI18nToast } from "@/lib/toastHelpers";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFormsTranslation, useCommonTranslation } from "@/hooks/useTypedTranslation";

interface NewServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCategories: string[];
  onCategoryAdded?: (category: string) => void;
}

export const NewServiceDialog = ({ open, onOpenChange, existingCategories, onCategoryAdded }: NewServiceDialogProps) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useI18nToast();
  const queryClient = useQueryClient();
  const { t: tForms } = useFormsTranslation();
  const { t: tCommon } = useCommonTranslation();

  const createServiceMutation = useMutation({
    mutationFn: async (serviceData: { name: string; category?: string; description?: string; costPrice?: number; sellingPrice?: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('User not authenticated');

      const insertData = {
        name: serviceData.name,
        category: serviceData.category || null,
        description: serviceData.description || null,
        cost_price: serviceData.costPrice || 0,
        selling_price: serviceData.sellingPrice || 0,
        user_id: user.id,
      };
      
      const { data, error } = await supabase
        .from('services')
        .insert(insertData)
        .select()
        .single();
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success(tForms('services.service_created_desc'));
      handleClose();
    },
    onError: (error) => {
      toast.error(tForms('services.error_creating'));
      console.error('Create service error:', error);
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Category validation
    if (!category || category.trim().length === 0) {
      newErrors.category = tForms('services.category_required');
    }

    // Name validation
    if (!name || name.trim().length === 0) {
      newErrors.name = tForms('services.name_required');
    } else if (name.trim().length > 100) {
      newErrors.name = tForms('services.name_too_long');
    }

    // Description validation (optional)
    if (description && description.trim().length > 1000) {
      newErrors.description = tForms('services.description_too_long');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    createServiceMutation.mutate({
      name: name.trim(),
      category: category.trim() || undefined,
      description: description.trim() || undefined,
      costPrice: costPrice ? parseFloat(costPrice) : undefined,
      sellingPrice: sellingPrice ? parseFloat(sellingPrice) : undefined,
    });
  };

  const handleCategoryChange = (value: string) => {
    if (value === "__create_new__") {
      setIsCreatingNewCategory(true);
      setNewCategoryInput("");
      setCategory("");
    } else {
      setCategory(value);
      setIsCreatingNewCategory(false);
    }
  };

  const handleNewCategorySubmit = () => {
    const trimmedCategory = newCategoryInput.trim();
    
    if (trimmedCategory) {
      // Check for duplicates (case-insensitive)
      const isDuplicate = existingCategories.some(
        cat => cat.toLowerCase() === trimmedCategory.toLowerCase()
      ) || ['Albums', 'Prints', 'Extras', 'Digital', 'Packages'].some(
        cat => cat.toLowerCase() === trimmedCategory.toLowerCase()
      );
      
      if (!isDuplicate) {
        setCategory(trimmedCategory);
        setIsCreatingNewCategory(false);
        setNewCategoryInput("");
        // Notify parent component about the new category
        onCategoryAdded?.(trimmedCategory);
      } else {
        toast.error(tForms('services.category_exists_desc'));
      }
    }
  };

  const handleNewCategoryCancel = () => {
    setIsCreatingNewCategory(false);
    setNewCategoryInput("");
    setCategory("");
  };

  const handleClose = () => {
    setName("");
    setCategory("");
    setDescription("");
    setCostPrice("");
    setSellingPrice("");
    setIsCreatingNewCategory(false);
    setNewCategoryInput("");
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tForms('services.new_service')}</DialogTitle>
          <DialogDescription>
            {tForms('services.new_service_desc')}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">{tForms('services.category')} *</Label>
            {isCreatingNewCategory ? (
              <div className="space-y-2">
                <Input
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  placeholder={tForms('services.enter_new_category')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleNewCategorySubmit();
                    } else if (e.key === 'Escape') {
                      handleNewCategoryCancel();
                    }
                  }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleNewCategorySubmit}
                    disabled={!newCategoryInput.trim()}
                  >
                    {tForms('services.add_category')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleNewCategoryCancel}
                  >
                    {tCommon('buttons.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder={tForms('services.select_create_category')} />
                </SelectTrigger>
                <SelectContent>
                  {/* Pre-defined common categories */}
                  <SelectItem value="Albums">{tForms('services.predefined_categories.albums')}</SelectItem>
                  <SelectItem value="Prints">{tForms('services.predefined_categories.prints')}</SelectItem>
                  <SelectItem value="Extras">{tForms('services.predefined_categories.extras')}</SelectItem>
                  <SelectItem value="Digital">{tForms('services.predefined_categories.digital')}</SelectItem>
                  <SelectItem value="Packages">{tForms('services.predefined_categories.packages')}</SelectItem>
                  
                  {/* Separator if there are existing categories */}
                  {existingCategories.length > 0 && (
                    <div className="px-2 py-1">
                      <div className="h-px bg-border" />
                    </div>
                  )}
                  
                  {/* Existing categories from database */}
                  {existingCategories
                    .filter(cat => !['Albums', 'Prints', 'Extras', 'Digital', 'Packages'].includes(cat))
                    .map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  
                  {/* Separator before create new option */}
                  <div className="px-2 py-1">
                    <div className="h-px bg-border" />
                  </div>
                  
                  {/* Create new category option */}
                  <SelectItem value="__create_new__" className="text-primary">
                    {tForms('services.create_new_category')}
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">{tCommon('labels.name')} *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tForms('services.placeholder_service_name')}
              required
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="costPrice">{tForms('services.cost_price')}</Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellingPrice">{tForms('services.selling_price')}</Label>
              <Input
                id="sellingPrice"
                type="number"
                step="0.01"
                min="0"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{tCommon('labels.description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tForms('services.placeholder_description')}
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              {tCommon('buttons.cancel')}
            </Button>
            <Button type="submit" disabled={createServiceMutation.isPending}>
              {createServiceMutation.isPending ? tCommon('actions.saving') : tCommon('buttons.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};