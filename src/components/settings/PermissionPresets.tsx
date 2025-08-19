import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface PermissionPreset {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  color: string;
}

interface PermissionPresetsProps {
  permissions: Permission[];
  selectedPermissions: string[];
  onSelectPreset: (permissionIds: string[]) => void;
  onSelectPermissions: (permissionIds: string[]) => void;
}

export function PermissionPresets({ 
  permissions, 
  selectedPermissions, 
  onSelectPreset,
  onSelectPermissions 
}: PermissionPresetsProps) {
  const presets: PermissionPreset[] = [
    {
      id: "basic",
      name: "Basic Access",
      description: "View-only access to assigned projects and leads",
      permissions: [
        "view_assigned_projects",
        "view_assigned_leads", 
        "view_sessions"
      ],
      color: "bg-blue-50 border-blue-200 text-blue-800"
    },
    {
      id: "contributor",
      name: "Contributor",
      description: "Can edit assigned projects and create basic content",
      permissions: [
        "view_assigned_projects",
        "edit_assigned_projects",
        "view_assigned_leads",
        "edit_assigned_leads",
        "view_sessions",
        "create_sessions"
      ],
      color: "bg-green-50 border-green-200 text-green-800"
    },
    {
      id: "manager",
      name: "Project Manager",
      description: "Full project management with team oversight",
      permissions: [
        "manage_all_projects",
        "create_projects",
        "delete_projects",
        "manage_all_leads",
        "create_leads",
        "delete_leads",
        "view_sessions",
        "create_sessions",
        "manage_sessions",
        "manage_team"
      ],
      color: "bg-purple-50 border-purple-200 text-purple-800"
    },
    {
      id: "admin",
      name: "Administrator",
      description: "Full access to all features",
      permissions: permissions.map(p => p.name),
      color: "bg-orange-50 border-orange-200 text-orange-800"
    }
  ];

  const getMatchingPreset = () => {
    for (const preset of presets) {
      const presetPermissionNames = preset.permissions;
      const selectedPermissionNames = permissions
        .filter(p => selectedPermissions.includes(p.id))
        .map(p => p.name);
      
      if (presetPermissionNames.length === selectedPermissionNames.length &&
          presetPermissionNames.every(name => selectedPermissionNames.includes(name))) {
        return preset;
      }
    }
    return null;
  };

  const matchingPreset = getMatchingPreset();

  const handlePresetSelect = (preset: PermissionPreset) => {
    const permissionIds = permissions
      .filter(p => preset.permissions.includes(p.name))
      .map(p => p.id);
    onSelectPreset(permissionIds);
  };

  const handleCustomPermissions = () => {
    // Keep current selections but allow manual editing
    onSelectPermissions(selectedPermissions);
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium mb-2">Permission Templates</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Choose a preset or customize individual permissions below
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {presets.map((preset) => {
          const isSelected = matchingPreset?.id === preset.id;
          
          return (
            <Card 
              key={preset.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => handlePresetSelect(preset)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {preset.name}
                  </CardTitle>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <CardDescription className="text-xs">
                  {preset.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Badge variant="secondary" className="text-xs">
                  {preset.permissions.length} permissions
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!matchingPreset && selectedPermissions.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Custom Permissions
              </CardTitle>
              <Check className="h-4 w-4 text-primary" />
            </div>
            <CardDescription className="text-xs">
              You have selected custom permissions that don't match a preset
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Badge variant="secondary" className="text-xs">
              {selectedPermissions.length} permissions selected
            </Badge>
          </CardContent>
        </Card>
      )}

      <div className="pt-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleCustomPermissions}
          className="text-xs"
        >
          Customize Individual Permissions
        </Button>
      </div>
    </div>
  );
}
