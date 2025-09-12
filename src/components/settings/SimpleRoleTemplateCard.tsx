import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, UserCheck, Eye, Settings, Crown } from "lucide-react";

interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  sort_order: number;
  is_system: boolean;
}

interface SimpleRoleTemplateCardProps {
  template: RoleTemplate;
  onCreateRole: (templateId: string) => void;
  loading?: boolean;
}

const getRoleIcon = (name: string) => {
  switch (name.toLowerCase()) {
    case 'full admin':
      return Crown;
    case 'project manager':
      return Settings;
    case 'team member':
      return UserCheck;
    case 'viewer':
      return Eye;
    default:
      return Shield;
  }
};

const getRoleColor = (name: string) => {
  switch (name.toLowerCase()) {
    case 'full admin':
      return 'bg-gradient-to-r from-violet-500 to-purple-500 text-white';
    case 'project manager':
      return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white';
    case 'team member':
      return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white';
    case 'viewer':
      return 'bg-gradient-to-r from-gray-400 to-gray-500 text-white';
    default:
      return 'bg-gradient-to-r from-slate-500 to-slate-600 text-white';
  }
};

const getAccessLevel = (permissions: string[]) => {
  const adminPerms = permissions.filter(p => 
    p.includes('manage_all_') || p.includes('delete_') || p.includes('admin') || p.includes('manage_team')
  ).length;
  
  if (adminPerms >= 5) return 'Full Access';
  if (adminPerms >= 2) return 'High Access';
  if (permissions.some(p => p.includes('manage_'))) return 'Manage Access';
  if (permissions.some(p => p.includes('edit_'))) return 'Edit Access';
  return 'View Only';
};

export function SimpleRoleTemplateCard({ 
  template, 
  onCreateRole, 
  loading = false 
}: SimpleRoleTemplateCardProps) {
  const RoleIcon = getRoleIcon(template.name);
  const accessLevel = getAccessLevel(template.permissions);
  
  return (
    <Card className="hover:shadow-md transition-all duration-200 border-2 hover:border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className={`p-3 rounded-lg ${getRoleColor(template.name)}`}>
            <RoleIcon className="h-6 w-6" />
          </div>
          <Badge variant="outline" className="text-xs">
            {accessLevel}
          </Badge>
        </div>
        <CardTitle className="text-lg">{template.name}</CardTitle>
        <CardDescription className="text-sm">
          {template.description}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Key Capabilities */}
          <div>
            <h4 className="font-medium text-sm mb-2 text-muted-foreground">Key Capabilities</h4>
            <div className="space-y-1">
              {template.permissions.slice(0, 4).map((permission, index) => (
                <div key={index} className="text-xs text-foreground/70">
                  • {permission.replace(/_/g, ' ').replace(/^./, str => str.toUpperCase())}
                </div>
              ))}
              {template.permissions.length > 4 && (
                <div className="text-xs text-muted-foreground">
                  + {template.permissions.length - 4} more permissions
                </div>
              )}
            </div>
          </div>
          
          <Button 
            onClick={() => onCreateRole(template.id)}
            disabled={loading}
            className="w-full"
            size="sm"
          >
            Create Role
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}