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
      id: "viewer",
      name: "Viewer",
      description: "Read-only access to assigned work",
      permissions: [],
      color: "bg-gray-50 border-gray-200 text-gray-800"
    },
    {
      id: "assistant",
      name: "Assistant",
      description: "Basic editing of assigned work with view-only settings",
      permissions: [
        "edit_assigned_leads",
        "edit_assigned_projects", 
        "edit_assigned_sessions",
        "view_packages",
        "view_services"
      ],
      color: "bg-blue-50 border-blue-200 text-blue-800"
    },
    {
      id: "photographer",
      name: "Photographer",
      description: "Manage assigned work and sessions with view-only settings",
      permissions: [
        "edit_assigned_leads",
        "edit_assigned_projects",
        "create_sessions",
        "edit_assigned_sessions",
        "manage_all_sessions",
        "view_packages",
        "view_services",
        "view_project_statuses",
        "view_session_statuses"
      ],
      color: "bg-green-50 border-green-200 text-green-800"
    },
    {
      id: "lead_manager",
      name: "Lead Manager",
      description: "Manage leads and create projects with view-only settings",
      permissions: [
        "create_leads",
        "edit_assigned_leads",
        "manage_all_leads",
        "create_projects",
        "edit_assigned_projects",
        "create_sessions",
        "edit_assigned_sessions",
        "view_packages",
        "view_services",
        "view_lead_statuses",
        "view_project_statuses",
        "view_session_statuses",
        "view_project_types"
      ],
      color: "bg-purple-50 border-purple-200 text-purple-800"
    },
    {
      id: "project_manager",
      name: "Project Manager",
      description: "Manage projects and assigned leads with settings access",
      permissions: [
        "create_leads",
        "edit_assigned_leads",
        "manage_all_leads",
        "create_projects",
        "edit_assigned_projects",
        "manage_all_projects",
        "create_sessions",
        "edit_assigned_sessions",
        "manage_all_sessions",
        "view_financial_data",
        "view_organization_settings",
        "view_packages",
        "manage_packages",
        "view_services",
        "manage_services",
        "view_project_statuses",
        "manage_project_statuses",
        "view_session_statuses",
        "manage_session_statuses",
        "view_project_types",
        "manage_project_types"
      ],
      color: "bg-indigo-50 border-indigo-200 text-indigo-800"
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
                Custom Role
              </CardTitle>
              <Check className="h-4 w-4 text-primary" />
            </div>
            <CardDescription className="text-xs">
              Custom permissions that don't match a preset
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Badge variant="secondary" className="text-xs">
              {selectedPermissions.length} permissions
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
