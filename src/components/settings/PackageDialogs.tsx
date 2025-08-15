import { useState, useEffect, useMemo } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Package {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  duration: string;
  includes?: string;
  applicableTypes: string[];
  defaultAddons: string[];
  isActive: boolean;
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
    () => services.filter((s) => value.includes(s.name)),
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

  const toggleService = (serviceName: string) => {
    if (tempValue.includes(serviceName)) {
      setTempValue(prev => prev.filter(v => v !== serviceName));
    } else {
      setTempValue(prev => [...prev, serviceName]);
    }
  };

  if (services.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <p className="text-sm">No services yet. Create services to use as add-ons.</p>
        <button
          type="button"
          onClick={() => navigate("/settings/services")}
          className="text-sm text-primary hover:underline mt-1"
        >
          Create a Service
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
            const selectedCount = items.filter((s) => tempValue.includes(s.name)).length;
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
                        const selected = tempValue.includes(service.name);
                        const price = service.selling_price ?? service.price ?? 0;
                        return (
                          <Button
                            key={service.id}
                            type="button"
                            variant={selected ? "default" : "secondary"}
                            onClick={() => toggleService(service.name)}
                            className={cn(
                              "h-8 rounded-full px-3 text-xs justify-start whitespace-nowrap",
                              "overflow-hidden text-ellipsis",
                              selected ? "" : "border",
                            )}
                            title={`${service.name}${price > 0 ? ` · ₺${price}` : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              {selected && <Check className="h-3 w-3" aria-hidden />}
                              <span>
                                {service.name}
                                {price > 0 && (
                                  <>
                                    <span className="mx-1">·</span>
                                    <span className={selected ? "text-primary-foreground/80" : "text-muted-foreground"}>
                                      ₺{price}
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
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="h-8"
          >
            Save
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
          <p className="text-sm text-muted-foreground mb-2">No add-ons selected</p>
          <Button
            type="button"
            variant="outline"
            onClick={handleEdit}
            className="h-8"
          >
            Add Services
          </Button>
        </div>
      ) : (
        <div className="rounded-md border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Selected Add-ons ({selectedServices.length})</span>
            <Button
              type="button"
              variant="outline"
              onClick={handleEdit}
              className="h-8"
            >
              Edit
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedServices.map((service) => {
              const price = service.selling_price ?? service.price ?? 0;
              return (
                <Badge
                  key={service.id}
                  variant="secondary"
                  className="h-7 rounded-full px-3 text-xs"
                >
                  <span>
                    {service.name}
                    {price > 0 && (
                      <>
                        <span className="mx-1">·</span>
                        <span className="text-foreground/70">₺{price}</span>
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

const durationOptions = [
  { value: "30m", label: "30 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "2h", label: "2 hours" },
  { value: "3h", label: "3 hours" },
  { value: "Half-day", label: "Half day" },
  { value: "Full-day", label: "Full day" },
  { value: "Custom", label: "Custom" }
];

export function AddPackageDialog({ open, onOpenChange, onPackageAdded }: AddPackageDialogProps) {
  const [packageData, setPackageData] = useState({
    name: "",
    description: "",
    basePrice: "",
    duration: "",
    customDuration: "",
    includes: "",
    applicableTypes: [] as string[],
    defaultAddons: [] as string[],
    isActive: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch project types
  const { data: projectTypes = [] } = useQuery({
    queryKey: ['project_types'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('project_types')
        .select('*')
        .eq('user_id', user.id)
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

      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  const resetForm = () => {
    setPackageData({
      name: "",
      description: "",
      basePrice: "",
      duration: "",
      customDuration: "",
      includes: "",
      applicableTypes: [],
      defaultAddons: [],
      isActive: true
    });
    setErrors({});
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!packageData.name.trim()) {
      newErrors.name = "Package name is required";
    }

    if (!packageData.basePrice || isNaN(Number(packageData.basePrice)) || Number(packageData.basePrice) <= 0) {
      newErrors.basePrice = "Valid base price is required";
    }

    if (!packageData.duration) {
      newErrors.duration = "Duration is required";
    }

    if (packageData.duration === "Custom" && !packageData.customDuration.trim()) {
      newErrors.customDuration = "Custom duration is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    // Mock submission - in real app this would save to backend
    toast({
      title: "Package created",
      description: `Package "${packageData.name}" has been created successfully.`,
    });

    onPackageAdded();
  };

  const toggleApplicableType = (type: string) => {
    setPackageData(prev => ({
      ...prev,
      applicableTypes: prev.applicableTypes.includes(type)
        ? prev.applicableTypes.filter(t => t !== type)
        : [...prev.applicableTypes, type]
    }));
  };


  return (
    <AppSheetModal
      title="Add Package"
      isOpen={open}
      onOpenChange={onOpenChange}
    >
      <div className="space-y-6">
        {/* Package Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Package Name *</Label>
          <Input
            id="name"
            value={packageData.name}
            onChange={(e) => setPackageData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Wedding Standard"
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={packageData.description}
            onChange={(e) => setPackageData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description of the package"
            rows={2}
          />
        </div>

        {/* Base Price */}
        <div className="space-y-2">
          <Label htmlFor="basePrice">Base Price (TRY) *</Label>
          <p className="text-xs text-muted-foreground">Client-facing base price. You can override per project.</p>
          <Input
            id="basePrice"
            type="number"
            value={packageData.basePrice}
            onChange={(e) => setPackageData(prev => ({ ...prev, basePrice: e.target.value }))}
            placeholder="0"
            min="0"
            step="100"
          />
          {errors.basePrice && <p className="text-sm text-destructive">{errors.basePrice}</p>}
        </div>

        {/* Duration */}
        <div className="space-y-2">
          <Label htmlFor="duration">Duration *</Label>
          <p className="text-xs text-muted-foreground">Used for scheduling availability and calendar blocking.</p>
          <Select value={packageData.duration} onValueChange={(value) => setPackageData(prev => ({ ...prev, duration: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              {durationOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.duration && <p className="text-sm text-destructive">{errors.duration}</p>}
        </div>

        {/* Custom Duration */}
        {packageData.duration === "Custom" && (
          <div className="space-y-2">
            <Label htmlFor="customDuration">Custom Duration *</Label>
            <Input
              id="customDuration"
              value={packageData.customDuration}
              onChange={(e) => setPackageData(prev => ({ ...prev, customDuration: e.target.value }))}
              placeholder="e.g., 2-3 days"
            />
            {errors.customDuration && <p className="text-sm text-destructive">{errors.customDuration}</p>}
          </div>
        )}

        {/* Includes */}
        <div className="space-y-2">
          <Label htmlFor="includes">Includes</Label>
          <p className="text-xs text-muted-foreground">List what's included; shown to clients.</p>
          <Textarea
            id="includes"
            value={packageData.includes}
            onChange={(e) => setPackageData(prev => ({ ...prev, includes: e.target.value }))}
            placeholder="e.g., 20 retouched photos, online gallery"
            rows={3}
          />
        </div>

        {/* Applicable Types */}
        <div className="space-y-2">
          <Label>Applicable Types</Label>
          <p className="text-xs text-muted-foreground mb-3">
            Select which{" "}
            <button
              type="button"
              onClick={() => navigate("/settings/projects")}
              className="text-primary hover:underline"
            >
              Project Types
            </button>
            {" "}this package applies to (none = all types)
          </p>
          {projectTypes.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">No project types exist yet.</p>
              <button
                type="button"
                onClick={() => navigate("/settings/projects")}
                className="text-sm text-primary hover:underline mt-1"
              >
                Create Project Types
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {projectTypes.map((type: any) => (
                <Badge
                  key={type.id}
                  variant={packageData.applicableTypes.includes(type.name) ? "default" : "outline"}
                  className={`cursor-pointer transition-colors ${
                    packageData.applicableTypes.includes(type.name) 
                      ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                  onClick={() => toggleApplicableType(type.name)}
                >
                  {type.name}
                  {packageData.applicableTypes.includes(type.name) && (
                    <X className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Default Add-ons */}
        <div className="space-y-2">
          <Label>Default Add-ons</Label>
          <p className="text-xs text-muted-foreground mb-3">
            These are services from your{" "}
            <button
              type="button"
              onClick={() => navigate("/settings/services")}
              className="text-primary hover:underline"
            >
              Services section
            </button>
            {" "}that can be customized while creating a project
          </p>
          <ServiceAddOnsPicker
            services={services}
            value={packageData.defaultAddons}
            onChange={(addons) => setPackageData(prev => ({ ...prev, defaultAddons: addons }))}
            navigate={navigate}
          />
        </div>

        {/* Visibility */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="isActive">Visibility</Label>
            <p className="text-xs text-muted-foreground">
              Active packages are visible to clients
            </p>
          </div>
          <Switch
            id="isActive"
            checked={packageData.isActive}
            onCheckedChange={(checked) => setPackageData(prev => ({ ...prev, isActive: checked }))}
          />
        </div>
      </div>

      <div className="flex gap-3 pt-6">
        <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleSubmit} className="flex-1">
          Save Package
        </Button>
      </div>
    </AppSheetModal>
  );
}

export function EditPackageDialog({ package: pkg, open, onOpenChange, onPackageUpdated }: EditPackageDialogProps) {
  const [packageData, setPackageData] = useState({
    name: "",
    description: "",
    basePrice: "",
    duration: "",
    customDuration: "",
    includes: "",
    applicableTypes: [] as string[],
    defaultAddons: [] as string[],
    isActive: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch project types
  const { data: projectTypes = [] } = useQuery({
    queryKey: ['project_types'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('project_types')
        .select('*')
        .eq('user_id', user.id)
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

      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('user_id', user.id)
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
        basePrice: pkg.basePrice.toString(),
        duration: pkg.duration,
        customDuration: pkg.duration === "Custom" ? pkg.duration : "",
        includes: pkg.includes || "",
        applicableTypes: [...pkg.applicableTypes],
        defaultAddons: [...pkg.defaultAddons],
        isActive: pkg.isActive
      });
      setErrors({});
    }
  }, [pkg, open]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!packageData.name.trim()) {
      newErrors.name = "Package name is required";
    }

    if (!packageData.basePrice || isNaN(Number(packageData.basePrice)) || Number(packageData.basePrice) <= 0) {
      newErrors.basePrice = "Valid base price is required";
    }

    if (!packageData.duration) {
      newErrors.duration = "Duration is required";
    }

    if (packageData.duration === "Custom" && !packageData.customDuration.trim()) {
      newErrors.customDuration = "Custom duration is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    // Mock submission - in real app this would update backend
    toast({
      title: "Package updated",
      description: `Package "${packageData.name}" has been updated successfully.`,
    });

    onPackageUpdated();
  };

  const toggleApplicableType = (type: string) => {
    setPackageData(prev => ({
      ...prev,
      applicableTypes: prev.applicableTypes.includes(type)
        ? prev.applicableTypes.filter(t => t !== type)
        : [...prev.applicableTypes, type]
    }));
  };


  if (!pkg) return null;

  return (
    <AppSheetModal
      title="Edit Package"
      isOpen={open}
      onOpenChange={onOpenChange}
    >
      <div className="space-y-6">
        {/* Package Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Package Name *</Label>
          <Input
            id="name"
            value={packageData.name}
            onChange={(e) => setPackageData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Wedding Standard"
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={packageData.description}
            onChange={(e) => setPackageData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description of the package"
            rows={2}
          />
        </div>

        {/* Base Price */}
        <div className="space-y-2">
          <Label htmlFor="basePrice">Base Price (TRY) *</Label>
          <p className="text-xs text-muted-foreground">Client-facing base price. You can override per project.</p>
          <Input
            id="basePrice"
            type="number"
            value={packageData.basePrice}
            onChange={(e) => setPackageData(prev => ({ ...prev, basePrice: e.target.value }))}
            placeholder="0"
            min="0"
            step="100"
          />
          {errors.basePrice && <p className="text-sm text-destructive">{errors.basePrice}</p>}
        </div>

        {/* Duration */}
        <div className="space-y-2">
          <Label htmlFor="duration">Duration *</Label>
          <p className="text-xs text-muted-foreground">Used for scheduling availability and calendar blocking.</p>
          <Select value={packageData.duration} onValueChange={(value) => setPackageData(prev => ({ ...prev, duration: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              {durationOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.duration && <p className="text-sm text-destructive">{errors.duration}</p>}
        </div>

        {/* Custom Duration */}
        {packageData.duration === "Custom" && (
          <div className="space-y-2">
            <Label htmlFor="customDuration">Custom Duration *</Label>
            <Input
              id="customDuration"
              value={packageData.customDuration}
              onChange={(e) => setPackageData(prev => ({ ...prev, customDuration: e.target.value }))}
              placeholder="e.g., 2-3 days"
            />
            {errors.customDuration && <p className="text-sm text-destructive">{errors.customDuration}</p>}
          </div>
        )}

        {/* Includes */}
        <div className="space-y-2">
          <Label htmlFor="includes">Includes</Label>
          <p className="text-xs text-muted-foreground">List what's included; shown to clients.</p>
          <Textarea
            id="includes"
            value={packageData.includes}
            onChange={(e) => setPackageData(prev => ({ ...prev, includes: e.target.value }))}
            placeholder="e.g., 20 retouched photos, online gallery"
            rows={3}
          />
        </div>

        {/* Applicable Types */}
        <div className="space-y-2">
          <Label>Applicable Types</Label>
          <p className="text-xs text-muted-foreground mb-3">
            Select which{" "}
            <button
              type="button"
              onClick={() => navigate("/settings/projects")}
              className="text-primary hover:underline"
            >
              Project Types
            </button>
            {" "}this package applies to (none = all types)
          </p>
          {projectTypes.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">No project types exist yet.</p>
              <button
                type="button"
                onClick={() => navigate("/settings/projects")}
                className="text-sm text-primary hover:underline mt-1"
              >
                Create Project Types
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {projectTypes.map((type: any) => (
                <Badge
                  key={type.id}
                  variant={packageData.applicableTypes.includes(type.name) ? "default" : "outline"}
                  className={`cursor-pointer transition-colors ${
                    packageData.applicableTypes.includes(type.name) 
                      ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                  onClick={() => toggleApplicableType(type.name)}
                >
                  {type.name}
                  {packageData.applicableTypes.includes(type.name) && (
                    <X className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Default Add-ons */}
        <div className="space-y-2">
          <Label>Default Add-ons</Label>
          <p className="text-xs text-muted-foreground mb-3">
            These are services from your{" "}
            <button
              type="button"
              onClick={() => navigate("/settings/services")}
              className="text-primary hover:underline"
            >
              Services section
            </button>
            {" "}that can be customized while creating a project
          </p>
          <ServiceAddOnsPicker
            services={services}
            value={packageData.defaultAddons}
            onChange={(addons) => setPackageData(prev => ({ ...prev, defaultAddons: addons }))}
            navigate={navigate}
          />
        </div>

        {/* Visibility */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="isActive">Visibility</Label>
            <p className="text-xs text-muted-foreground">
              Active packages are visible to clients
            </p>
          </div>
          <Switch
            id="isActive"
            checked={packageData.isActive}
            onCheckedChange={(checked) => setPackageData(prev => ({ ...prev, isActive: checked }))}
          />
        </div>
      </div>

      <div className="flex gap-3 pt-6">
        <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleSubmit} className="flex-1">
          Update Package
        </Button>
      </div>
    </AppSheetModal>
  );
}