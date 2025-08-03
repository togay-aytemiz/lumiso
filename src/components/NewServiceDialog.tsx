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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createServiceMutation = useMutation({
    mutationFn: async (serviceData: { name: string; category?: string; description?: string }) => {
      console.log('Creating service with data:', serviceData);
      
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user?.id);
      
      if (!user) throw new Error('User not authenticated');

      const insertData = {
        name: serviceData.name,
        category: serviceData.category || null,
        description: serviceData.description || null,
        user_id: user.id,
      };
      
      console.log('Inserting data:', insertData);

      const { data, error } = await supabase
        .from('services')
        .insert(insertData)
        .select()
        .single();
      
      console.log('Insert result:', { data, error });
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({
        title: "Service created",
        description: "The new service has been added successfully.",
      });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create service. Please try again.",
        variant: "destructive",
      });
      console.error('Create service error:', error);
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!name || name.trim().length === 0) {
      newErrors.name = "Name is required";
    } else if (name.trim().length > 100) {
      newErrors.name = "Name is too long (max 100 characters)";
    }

    // Description validation (optional)
    if (description && description.trim().length > 1000) {
      newErrors.description = "Description is too long (max 1000 characters)";
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
    console.log('handleNewCategorySubmit called:', { trimmedCategory, newCategoryInput });
    
    if (trimmedCategory) {
      // Check for duplicates (case-insensitive)
      const isDuplicate = existingCategories.some(
        cat => cat.toLowerCase() === trimmedCategory.toLowerCase()
      ) || ['Albums', 'Prints', 'Extras', 'Digital', 'Packages'].some(
        cat => cat.toLowerCase() === trimmedCategory.toLowerCase()
      );
      
      console.log('Duplicate check:', { isDuplicate, existingCategories });
      
      if (!isDuplicate) {
        console.log('Setting category:', trimmedCategory);
        setCategory(trimmedCategory);
        setIsCreatingNewCategory(false);
        setNewCategoryInput("");
        // Notify parent component about the new category
        onCategoryAdded?.(trimmedCategory);
      } else {
        console.log('Category is duplicate, showing toast');
        toast({
          title: "Category already exists",
          description: "This category name is already in use. Please choose a different name.",
          variant: "destructive",
        });
      }
    } else {
      console.log('Empty category name');
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
    setIsCreatingNewCategory(false);
    setNewCategoryInput("");
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Service</DialogTitle>
          <DialogDescription>
            Add a new photography service to your offerings.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            {isCreatingNewCategory ? (
              <div className="space-y-2">
                <Input
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  placeholder="Enter new category name"
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
                    Add Category
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleNewCategoryCancel}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select or create a category" />
                </SelectTrigger>
                <SelectContent>
                  {/* Pre-defined common categories */}
                  <SelectItem value="Albums">Albums</SelectItem>
                  <SelectItem value="Prints">Prints</SelectItem>
                  <SelectItem value="Extras">Extras</SelectItem>
                  <SelectItem value="Digital">Digital</SelectItem>
                  <SelectItem value="Packages">Packages</SelectItem>
                  
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
                    + Create new category
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Wedding Album, Photo Prints"
              required
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of the service..."
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createServiceMutation.isPending}>
              {createServiceMutation.isPending ? "Saving..." : "Save Service"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};