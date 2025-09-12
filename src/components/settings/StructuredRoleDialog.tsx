import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  FileText, 
  Calendar, 
  Settings as SettingsIcon, 
  Shield, 
  Building,
  Eye,
  Edit,
  Plus,
  Trash2,
  CheckCircle2,
  Zap,
  DollarSign,
  UserCheck
} from 'lucide-react';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface CustomRole {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

interface StructuredRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: Permission[];
  editingRole?: CustomRole | null;
  onSave: (name: string, description: string, permissionIds: string[]) => Promise<void>;
  loading?: boolean;
}

// Organize permissions with better structure and descriptions
const PERMISSION_CATEGORIES = {
  'Leads': {
    icon: Users,
    description: 'Manage potential clients and prospects',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    permissions: ['view_assigned_leads', 'manage_all_leads', 'create_leads', 'edit_assigned_leads', 'delete_leads']
  },
  'Projects': {
    icon: FileText,
    description: 'Handle client projects and deliverables',
    color: 'bg-green-100 text-green-800 border-green-200',
    permissions: ['view_assigned_projects', 'manage_all_projects', 'create_projects', 'edit_assigned_projects', 'delete_projects']
  },
  'Sessions': {
    icon: Calendar,
    description: 'Schedule and manage photo sessions',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    permissions: ['view_session_statuses', 'manage_session_statuses']
  },
  'Organization': {
    icon: Building,
    description: 'Configure business settings and data',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    permissions: [
      'view_lead_statuses', 'manage_lead_statuses',
      'view_project_statuses', 'manage_project_statuses', 
      'view_project_types', 'manage_project_types',
      'view_services', 'manage_services',
      'view_packages', 'manage_packages'
    ]
  },
  'Automation': {
    icon: Zap,
    description: 'Workflow automation and templates',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    permissions: ['view_workflows', 'manage_workflows', 'execute_workflows', 'view_templates', 'manage_templates']
  },
  'Financial': {
    icon: DollarSign,
    description: 'Payment management and financial data',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    permissions: ['view_payments', 'manage_payments']
  },
  'Team': {
    icon: UserCheck,
    description: 'Team member and role management',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    permissions: ['manage_team']
  },
  'Administration': {
    icon: Shield,
    description: 'Full system access and administration',
    color: 'bg-red-100 text-red-800 border-red-200',
    permissions: ['manage_roles', 'admin', 'manage_integrations', 'manage_contracts', 'manage_billing', 'manage_client_messaging']
  }
};

// Permission level descriptions
const PERMISSION_LEVELS = {
  'view_': { icon: Eye, label: 'View', description: 'Can see but not modify' },
  'edit_assigned_': { icon: Edit, label: 'Edit Assigned', description: 'Can edit items assigned to them' },
  'create_': { icon: Plus, label: 'Create', description: 'Can create new items' },
  'manage_all_': { icon: CheckCircle2, label: 'Manage All', description: 'Full control over all items' },
  'manage_': { icon: SettingsIcon, label: 'Manage', description: 'Full management access' },
  'delete_': { icon: Trash2, label: 'Delete', description: 'Can delete items' },
  'admin': { icon: Shield, label: 'Admin', description: 'System administrator access' }
};

export function StructuredRoleDialog({
  open,
  onOpenChange,
  permissions,
  editingRole,
  onSave,
  loading = false
}: StructuredRoleDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Reset form when dialog opens/closes or editing role changes
  useEffect(() => {
    if (open) {
      if (editingRole) {
        setName(editingRole.name);
        setDescription(editingRole.description);
        setSelectedPermissions(editingRole.permissions.map(p => p.id));
      } else {
        setName('');
        setDescription('');
        setSelectedPermissions([]);
      }
    }
  }, [open, editingRole]);

  const handleSave = async () => {
    if (!name.trim()) return;
    
    await onSave(name.trim(), description.trim(), selectedPermissions);
    onOpenChange(false);
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const toggleCategoryPermissions = (categoryPermissions: Permission[]) => {
    const categoryIds = categoryPermissions.map(p => p.id);
    const allSelected = categoryIds.every(id => selectedPermissions.includes(id));
    
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(id => !categoryIds.includes(id)));
    } else {
      setSelectedPermissions(prev => [...new Set([...prev, ...categoryIds])]);
    }
  };

  const getPermissionLevel = (permissionName: string) => {
    for (const [prefix, config] of Object.entries(PERMISSION_LEVELS)) {
      if (permissionName.startsWith(prefix) || permissionName === prefix.replace('_', '')) {
        return config;
      }
    }
    return PERMISSION_LEVELS['view_']; // default
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Role'}
          </SheetTitle>
          <SheetDescription>
            {editingRole 
              ? 'Update the role details and permissions.'
              : 'Create a new role with specific permissions for your team members.'
            }
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid gap-4">
            <div>
              <Label htmlFor="roleName">Role Name</Label>
              <Input
                id="roleName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Project Manager, Editor, Photographer"
              />
            </div>
            
            <div>
              <Label htmlFor="roleDescription">Description</Label>
              <Textarea
                id="roleDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this role can do..."
                rows={2}
              />
            </div>
          </div>

          <Separator />

          {/* Permission Summary */}
          <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
            <div>
              <h4 className="font-medium">Selected Permissions</h4>
              <p className="text-sm text-muted-foreground">
                {selectedPermissions.length} of {permissions.length} permissions selected
              </p>
            </div>
            <Badge variant="outline" className="px-3 py-1">
              {selectedPermissions.length === 0 && 'No Access'}
              {selectedPermissions.length > 0 && selectedPermissions.length < permissions.length / 3 && 'Limited Access'}
              {selectedPermissions.length >= permissions.length / 3 && selectedPermissions.length < permissions.length * 2/3 && 'Standard Access'}
              {selectedPermissions.length >= permissions.length * 2/3 && selectedPermissions.length < permissions.length && 'Advanced Access'}
              {selectedPermissions.length === permissions.length && 'Full Access'}
            </Badge>
          </div>

          {/* Permissions by Category */}
          <div className="space-y-4">
            <h4 className="font-medium text-lg">Permissions by Area</h4>
            
            <div className="grid gap-4">
              {Object.entries(PERMISSION_CATEGORIES).map(([categoryName, categoryConfig]) => {
                const categoryPermissions = permissions.filter(p => 
                  categoryConfig.permissions.some(cp => p.name === cp) ||
                  p.category.toLowerCase() === categoryName.toLowerCase() ||
                  p.category.toLowerCase().replace(/s$/, '') === categoryName.toLowerCase().replace(/s$/, '')
                );
                
                if (categoryPermissions.length === 0) return null;

                const Icon = categoryConfig.icon;
                const allSelected = categoryPermissions.every(p => selectedPermissions.includes(p.id));
                const someSelected = categoryPermissions.some(p => selectedPermissions.includes(p.id));
                const selectedCount = categoryPermissions.filter(p => selectedPermissions.includes(p.id)).length;

                return (
                  <Card key={categoryName} className="border-2 hover:border-primary/20 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${categoryConfig.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{categoryName}</CardTitle>
                            <CardDescription className="text-sm">
                              {categoryConfig.description}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">
                            {selectedCount}/{categoryPermissions.length}
                          </Badge>
                          <Switch
                            checked={allSelected}
                            onCheckedChange={() => toggleCategoryPermissions(categoryPermissions)}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-2">
                      {categoryPermissions.map((permission) => {
                        const isSelected = selectedPermissions.includes(permission.id);
                        const level = getPermissionLevel(permission.name);
                        const LevelIcon = level.icon;
                        
                        return (
                          <div
                            key={permission.id}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                              isSelected 
                                ? 'bg-primary/5 border-primary/20' 
                                : 'hover:bg-muted/50'
                            }`}
                            onClick={() => togglePermission(permission.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-1.5 rounded ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                                <LevelIcon className={`h-3 w-3 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium text-sm ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                    {permission.name.replace(/_/g, ' ').replace(/^./, str => str.toUpperCase())}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {level.label}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {permission.description}
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={isSelected}
                              onCheckedChange={() => togglePermission(permission.id)}
                            />
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || loading}>
            {editingRole ? 'Update Role' : 'Create Role'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}