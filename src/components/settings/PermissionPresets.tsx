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
    <div className="space-y-6">
      <div className="text-center">
        <h4 className="text-lg font-semibold text-foreground mb-2">Choose a Role Template</h4>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          Select a predefined role template to quickly assign appropriate permissions, or customize individual permissions for more granular control
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {presets.map((preset) => {
          const isSelected = matchingPreset?.id === preset.id;
          
          return (
            <Card 
              key={preset.id}
              className={`group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${
                isSelected 
                  ? 'ring-2 ring-primary shadow-lg bg-primary/5 border-primary/20' 
                  : 'hover:border-primary/30 bg-background'
              }`}
              onClick={() => handlePresetSelect(preset)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                      {preset.name}
                    </CardTitle>
                    <CardDescription className="text-sm mt-1 leading-relaxed">
                      {preset.description}
                    </CardDescription>
                  </div>
                  {isSelected && (
                    <div className="flex-shrink-0 ml-3">
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <Badge 
                    variant={isSelected ? "default" : "secondary"} 
                    className="text-xs font-medium"
                  >
                    {preset.permissions.length} {preset.permissions.length === 1 ? 'permission' : 'permissions'}
                  </Badge>
                  {!isSelected && (
                    <div className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to select
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!matchingPreset && selectedPermissions.length > 0 && (
        <Card className="border-dashed border-2 border-muted-foreground/30 bg-muted/20">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  Custom Role
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                </CardTitle>
                <CardDescription className="text-sm mt-1">
                  Custom permissions configuration that doesn't match any preset template
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Badge variant="outline" className="text-xs font-medium border-primary/50 text-primary">
              {selectedPermissions.length} custom {selectedPermissions.length === 1 ? 'permission' : 'permissions'}
            </Badge>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center pt-4 border-t border-border">
        <Button 
          variant="outline" 
          onClick={handleCustomPermissions}
          className="px-6 py-2 text-sm font-medium hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all"
        >
          <span>Customize Individual Permissions</span>
        </Button>
      </div>
    </div>
  );
}
