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
}

export const NewServiceDialog = ({ open, onOpenChange, existingCategories }: NewServiceDialogProps) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
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

  const handleClose = () => {
    setName("");
    setCategory("");
    setDescription("");
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
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="e.g., Albums, Prints, Extras" />
              </SelectTrigger>
              <SelectContent>
                {/* Pre-defined common categories */}
                <SelectItem value="Albums">Albums</SelectItem>
                <SelectItem value="Prints">Prints</SelectItem>
                <SelectItem value="Extras">Extras</SelectItem>
                <SelectItem value="Digital">Digital</SelectItem>
                <SelectItem value="Packages">Packages</SelectItem>
                
                {/* Existing categories from database */}
                {existingCategories
                  .filter(cat => !['Albums', 'Prints', 'Extras', 'Digital', 'Packages'].includes(cat))
                  .map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            
            {/* Alternative: Allow custom category input */}
            <div className="text-xs text-muted-foreground">
              Or enter a custom category:
            </div>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Custom category name"
              className="h-8 text-sm"
            />
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