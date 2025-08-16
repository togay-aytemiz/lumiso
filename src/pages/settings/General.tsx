import { useState } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import SettingsSection from "@/components/SettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload } from "lucide-react";

export default function General() {
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [timeFormat, setTimeFormat] = useState("12-hour");
  const [brandColor, setBrandColor] = useState("#1EB29F");
  const [companyName, setCompanyName] = useState("");

  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="General"
        description="Manage your general application preferences"
      />
      
      <div className="space-y-8">
        <SettingsSection
          title="Branding"
          description="Customize your brand appearance across client-facing materials"
        >
          <div className="space-y-6">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="company-name">Photography Business Name</Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
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
                <Button variant="outline" className="flex items-center gap-2 w-full sm:w-fit">
                  <Upload className="h-4 w-4" />
                  Choose File
                </Button>
                <span className="text-sm text-muted-foreground">
                  No file selected
                </span>
              </div>
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
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-16 h-10 p-1 border rounded"
                />
                <Input
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="flex-1 max-w-xs"
                  placeholder="#1EB29F"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Used in client-facing UI and outgoing messages
              </p>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Regional Settings"
          description="Configure date and time display preferences"
        >
          <div className="space-y-6">
            {/* Date Format */}
            <div className="space-y-2">
              <Label>Date Format</Label>
              <Select value={dateFormat} onValueChange={setDateFormat}>
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
              <RadioGroup value={timeFormat} onValueChange={setTimeFormat}>
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
        </SettingsSection>
      </div>
    </SettingsPageWrapper>
  );
}