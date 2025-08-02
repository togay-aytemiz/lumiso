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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { nameSchema, notesSchema } from "@/lib/validation";

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

    try {
      nameSchema.parse(name);
    } catch (error: any) {
      newErrors.name = error.errors[0]?.message || "Invalid name";
    }

    if (description) {
      try {
        notesSchema.parse(description);
      } catch (error: any) {
        newErrors.description = error.errors[0]?.message || "Description too long";
      }
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
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Albüm, Baskı, Ekstra"
              list="categories"
            />
            <datalist id="categories">
              {existingCategories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
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