import { useState, useEffect } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

const durationOptions = [
  { value: "30m", label: "30 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "2h", label: "2 hours" },
  { value: "3h", label: "3 hours" },
  { value: "Half-day", label: "Half day" },
  { value: "Full-day", label: "Full day" },
  { value: "Custom", label: "Custom" }
];

// Mock data for project types and services
const mockProjectTypes = ["Wedding", "Portrait", "Family", "Event", "Commercial", "Engagement"];
const mockServices = ["Print Package", "Extra Hour", "Second Photographer", "USB Delivery", "Album", "Canvas Print"];

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

  const toggleDefaultAddon = (addon: string) => {
    setPackageData(prev => ({
      ...prev,
      defaultAddons: prev.defaultAddons.includes(addon)
        ? prev.defaultAddons.filter(a => a !== addon)
        : [...prev.defaultAddons, addon]
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
          <Textarea
            id="includes"
            value={packageData.includes}
            onChange={(e) => setPackageData(prev => ({ ...prev, includes: e.target.value }))}
            placeholder="e.g., 20 retouched photos, online gallery"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">List what's included in this package</p>
        </div>

        {/* Applicable Types */}
        <div className="space-y-2">
          <Label>Applicable Types</Label>
          <p className="text-xs text-muted-foreground mb-3">Select which project types this package applies to (none = all types)</p>
          <div className="flex flex-wrap gap-2">
            {mockProjectTypes.map((type) => (
              <Badge
                key={type}
                variant={packageData.applicableTypes.includes(type) ? "default" : "outline"}
                className="cursor-pointer hover:bg-accent"
                onClick={() => toggleApplicableType(type)}
              >
                {type}
                {packageData.applicableTypes.includes(type) && (
                  <X className="ml-1 h-3 w-3" />
                )}
              </Badge>
            ))}
          </div>
        </div>

        {/* Default Add-ons */}
        <div className="space-y-2">
          <Label>Default Add-ons</Label>
          <p className="text-xs text-muted-foreground mb-3">Select services that are commonly added with this package</p>
          <div className="flex flex-wrap gap-2">
            {mockServices.map((service) => (
              <Badge
                key={service}
                variant={packageData.defaultAddons.includes(service) ? "default" : "outline"}
                className="cursor-pointer hover:bg-accent"
                onClick={() => toggleDefaultAddon(service)}
              >
                {service}
                {packageData.defaultAddons.includes(service) && (
                  <X className="ml-1 h-3 w-3" />
                )}
              </Badge>
            ))}
          </div>
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

  const toggleDefaultAddon = (addon: string) => {
    setPackageData(prev => ({
      ...prev,
      defaultAddons: prev.defaultAddons.includes(addon)
        ? prev.defaultAddons.filter(a => a !== addon)
        : [...prev.defaultAddons, addon]
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
          <Textarea
            id="includes"
            value={packageData.includes}
            onChange={(e) => setPackageData(prev => ({ ...prev, includes: e.target.value }))}
            placeholder="e.g., 20 retouched photos, online gallery"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">List what's included in this package</p>
        </div>

        {/* Applicable Types */}
        <div className="space-y-2">
          <Label>Applicable Types</Label>
          <p className="text-xs text-muted-foreground mb-3">Select which project types this package applies to (none = all types)</p>
          <div className="flex flex-wrap gap-2">
            {mockProjectTypes.map((type) => (
              <Badge
                key={type}
                variant={packageData.applicableTypes.includes(type) ? "default" : "outline"}
                className="cursor-pointer hover:bg-accent"
                onClick={() => toggleApplicableType(type)}
              >
                {type}
                {packageData.applicableTypes.includes(type) && (
                  <X className="ml-1 h-3 w-3" />
                )}
              </Badge>
            ))}
          </div>
        </div>

        {/* Default Add-ons */}
        <div className="space-y-2">
          <Label>Default Add-ons</Label>
          <p className="text-xs text-muted-foreground mb-3">Select services that are commonly added with this package</p>
          <div className="flex flex-wrap gap-2">
            {mockServices.map((service) => (
              <Badge
                key={service}
                variant={packageData.defaultAddons.includes(service) ? "default" : "outline"}
                className="cursor-pointer hover:bg-accent"
                onClick={() => toggleDefaultAddon(service)}
              >
                {service}
                {packageData.defaultAddons.includes(service) && (
                  <X className="ml-1 h-3 w-3" />
                )}
              </Badge>
            ))}
          </div>
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