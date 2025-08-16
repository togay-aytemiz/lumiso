import { useEffect, useRef } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { CategorySettingsSection } from "@/components/settings/CategorySettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, Loader2 } from "lucide-react";
import { useSettingsCategorySection } from "@/hooks/useSettingsCategorySection";
import { useUserSettings } from "@/hooks/useUserSettings";

export default function General() {
  const { settings, loading, uploading, updateSettings, uploadLogo } = useUserSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Branding section state
  const brandingSection = useSettingsCategorySection({
    sectionId: "branding",
    sectionName: "Branding",
    initialValues: {
      companyName: settings?.photography_business_name || "",
      brandColor: settings?.primary_brand_color || "#1EB29F",
      logoFile: null as File | null
    },
    onSave: async (values) => {
      // Handle logo upload first if there's a new file
      if (values.logoFile) {
        const uploadResult = await uploadLogo(values.logoFile);
        if (!uploadResult.success) {
          throw new Error("Failed to upload logo");
        }
      }

      // Then save other branding settings
      const updates: any = {
        photography_business_name: values.companyName,
        primary_brand_color: values.brandColor
      };

      const result = await updateSettings(updates);
      if (!result.success) {
        throw new Error("Failed to save branding settings");
      }
    }
  });

  // Regional settings section state
  const regionalSection = useSettingsCategorySection({
    sectionId: "regional",
    sectionName: "Regional Settings", 
    initialValues: {
      dateFormat: settings?.date_format || "DD/MM/YYYY",
      timeFormat: settings?.time_format || "12-hour"
    },
    onSave: async (values) => {
      const updates = {
        date_format: values.dateFormat,
        time_format: values.timeFormat
      };

      const result = await updateSettings(updates);
      if (!result.success) {
        throw new Error("Failed to save regional settings");
      }
    }
  });

  // Update form values when settings load
  useEffect(() => {
    if (settings) {
      brandingSection.setValues({
        companyName: settings.photography_business_name || "",
        brandColor: settings.primary_brand_color || "#1EB29F",
        logoFile: null
      });

      regionalSection.setValues({
        dateFormat: settings.date_format || "DD/MM/YYYY",
        timeFormat: settings.time_format || "12-hour"
      });
    }
  }, [settings]);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file before setting it
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    // Update the form state to show a file is selected
    brandingSection.updateValue("logoFile", file);
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const validateBrandColor = (color: string) => {
    return /^#[0-9A-F]{6}$/i.test(color);
  };

  const handleBrandColorChange = (value: string) => {
    // Allow any input while typing, validate only for final color picker sync
    brandingSection.updateValue("brandColor", value);
  };

  if (loading) {
    return (
      <SettingsPageWrapper>
        <SettingsHeader
          title="General"
          description="Manage your general application preferences"
        />
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </SettingsPageWrapper>
    );
  }

  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="General"
        description="Manage your general application preferences"
      />
      
      <div className="space-y-8">
        <CategorySettingsSection
          title="Branding"
          description="Customize your brand appearance across client-facing materials"
          sectionId="branding"
        >
          <div className="space-y-6">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="company-name">Photography Business Name</Label>
              <Input
                id="company-name"
                value={brandingSection.values.companyName}
                onChange={(e) => brandingSection.updateValue("companyName", e.target.value)}
                placeholder="Enter your photography business name"
                className="max-w-md"
              />
              <p className="text-sm text-muted-foreground">
                This will appear on invoices, contracts, and client communications
              </p>
            </div>

            {/* Logo Upload */}
            <div className="space-y-2">
              <Label htmlFor="logo-upload">Upload Logo</Label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button 
                  variant="outline" 
                  onClick={handleFileButtonClick}
                  disabled={uploading}
                  className="flex items-center gap-2 w-full sm:w-fit"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading ? "Uploading..." : "Choose File"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {brandingSection.values.logoFile 
                    ? brandingSection.values.logoFile.name
                    : settings?.logo_url 
                      ? "Logo uploaded" 
                      : "No file selected"
                  }
                </span>
              </div>
              {settings?.logo_url && (
                <div className="mt-2">
                  <img 
                    src={settings.logo_url} 
                    alt="Current logo" 
                    className="h-16 w-auto border rounded"
                  />
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Displayed on your client portal and emails. Accepts JPG, PNG, or SVG. Max file size: 2 MB
              </p>
            </div>

            {/* Brand Color */}
            <div className="space-y-2">
              <Label htmlFor="brand-color">Primary Brand Color</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="brand-color"
                  type="color"
                  value={brandingSection.values.brandColor}
                  onChange={(e) => brandingSection.updateValue("brandColor", e.target.value)}
                  className="w-16 h-10 p-1 border rounded"
                />
                <Input
                  value={brandingSection.values.brandColor}
                  onChange={(e) => handleBrandColorChange(e.target.value)}
                  className="flex-1 max-w-xs"
                  placeholder="#1EB29F"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Used in client-facing UI and outgoing messages. Must be a valid hex color (e.g., #1EB29F)
              </p>
            </div>
          </div>
        </CategorySettingsSection>

        <CategorySettingsSection
          title="Regional Settings"
          description="Configure date and time display preferences"
          sectionId="regional"
        >
          <div className="space-y-6">
            {/* Date Format */}
            <div className="space-y-2">
              <Label>Date Format</Label>
              <Select 
                value={regionalSection.values.dateFormat} 
                onValueChange={(value) => regionalSection.updateValue("dateFormat", value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Time Format */}
            <div className="space-y-3">
              <Label>Time Format</Label>
              <RadioGroup 
                value={regionalSection.values.timeFormat} 
                onValueChange={(value) => regionalSection.updateValue("timeFormat", value)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="12-hour" id="12-hour" />
                  <Label htmlFor="12-hour">12-hour (e.g. 2:00 PM)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="24-hour" id="24-hour" />
                  <Label htmlFor="24-hour">24-hour (e.g. 14:00)</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </CategorySettingsSection>
      </div>
    </SettingsPageWrapper>
  );
}