import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

interface AddServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onServiceAdded: () => void;
}

export function AddServiceDialog({ open, onOpenChange, onServiceAdded }: AddServiceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    cost_price: "",
    selling_price: "",
    extra: false,
  });

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Service name is required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('services')
        .insert({
          user_id: user.id,
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
        title: "Success",
        description: "Service added successfully"
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
        title: "Error adding service",
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
    if (window.confirm("Discard changes?")) {
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
      label: "Cancel",
      onClick: () => onOpenChange(false),
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? "Adding..." : "Add Service",
      onClick: handleSubmit,
      disabled: loading || !formData.name.trim(),
      loading: loading
    }
  ];

  return (
    <AppSheetModal
      title="Add Service"
      isOpen={open}
      onOpenChange={onOpenChange}
      size="default"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Service Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Photo Editing, Album Design"
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            placeholder="e.g., Photography, Editing, Products"
            maxLength={50}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Service description..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">Price (TRY)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_price">Cost Price (TRY)</Label>
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
            <Label htmlFor="selling_price">Selling Price (TRY)</Label>
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

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="extra"
            checked={formData.extra}
            onChange={(e) => setFormData(prev => ({ ...prev, extra: e.target.checked }))}
            className="h-4 w-4"
          />
          <Label htmlFor="extra">This is an extra/add-on service</Label>
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
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    cost_price: "",
    selling_price: "",
    extra: false,
  });

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
        title: "Error",
        description: "Service name is required",
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
        title: "Success",
        description: "Service updated successfully"
      });

      onOpenChange(false);
      onServiceUpdated();
    } catch (error: any) {
      toast({
        title: "Error updating service",
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
    if (window.confirm("Discard changes?")) {
      onOpenChange(false);
    }
  };

  const footerActions = [
    {
      label: "Cancel",
      onClick: () => onOpenChange(false),
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? "Updating..." : "Update Service",
      onClick: handleSubmit,
      disabled: loading || !formData.name.trim(),
      loading: loading
    }
  ];

  return (
    <AppSheetModal
      title="Edit Service"
      isOpen={open}
      onOpenChange={onOpenChange}
      size="default"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Service Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Photo Editing, Album Design"
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            placeholder="e.g., Photography, Editing, Products"
            maxLength={50}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Service description..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">Price (TRY)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_price">Cost Price (TRY)</Label>
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
            <Label htmlFor="selling_price">Selling Price (TRY)</Label>
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

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="extra"
            checked={formData.extra}
            onChange={(e) => setFormData(prev => ({ ...prev, extra: e.target.checked }))}
            className="h-4 w-4"
          />
          <Label htmlFor="extra">This is an extra/add-on service</Label>
        </div>
      </div>
    </AppSheetModal>
  );
}