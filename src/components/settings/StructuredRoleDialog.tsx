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

interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  permissions?: string[];
}

interface StructuredRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: Permission[];
  editingRole?: CustomRole | null;
  editingSystemRole?: RoleTemplate | null;
  onSave: (name: string, description: string, permissionIds: string[]) => Promise<void>;
  loading?: boolean;
}

// Improved permission descriptions
const PERMISSION_DESCRIPTIONS = {
  'view_assigned_leads': 'View leads that are assigned to you or that you created',
  'manage_all_leads': 'View, edit, and manage all leads in the organization',
  'create_leads': 'Add new potential clients to the system',
  'edit_assigned_leads': 'Edit leads that are assigned to you',
  'delete_leads': 'Remove leads from the system permanently',
  'view_assigned_projects': 'View projects that are assigned to you or that you created',
  'manage_all_projects': 'View, edit, and manage all projects in the organization',
  'create_projects': 'Start new projects for clients',
  'edit_assigned_projects': 'Edit projects that are assigned to you',
  'delete_projects': 'Remove projects from the system permanently',
  'view_session_statuses': 'See the different stages sessions can be in (Planned, Confirmed, etc.)',
  'manage_session_statuses': 'Create, edit, and delete session status categories',
  'view_lead_statuses': 'See the different stages leads can be in (New, Contacted, etc.)',
  'manage_lead_statuses': 'Create, edit, and delete lead status categories and workflow stages',
  'view_project_statuses': 'See the different stages projects can be in (Planning, In Progress, etc.)',
  'manage_project_statuses': 'Create, edit, and delete project status categories',
  'view_project_types': 'See available project categories (Wedding, Portrait, etc.)',
  'manage_project_types': 'Create, edit, and delete project type categories',
  'view_services': 'See available services and add-ons for projects',
  'manage_services': 'Create, edit, and delete services and pricing',
  'view_packages': 'See available photography packages and pricing',
  'manage_packages': 'Create, edit, and delete photography packages',
  'view_workflows': 'See automated workflows and their status',
  'manage_workflows': 'Create, edit, and configure automated workflows',
  'execute_workflows': 'Trigger and run workflow automations',
  'view_templates': 'See message and email templates',
  'manage_templates': 'Create, edit, and delete communication templates',
  'view_payments': 'See payment records and financial summaries',
  'manage_payments': 'Record payments and manage financial data',
  'manage_team': 'Invite team members and manage user accounts',
  'manage_roles': 'Create and modify custom roles and permissions',
  'admin': 'Full administrative access with complete control over all organization features',
  'manage_integrations': 'Configure third-party integrations and API connections',
  'manage_contracts': 'Handle contract templates and client agreements',
  'manage_billing': 'Manage subscription and billing settings',
  'manage_client_messaging': 'Configure client communication preferences and channels'
};

// Organize permissions with better structure
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
  'Administration': {
    icon: Shield,
    description: 'Full system access and team management',
    color: 'bg-red-100 text-red-800 border-red-200',
    permissions: ['manage_roles', 'admin', 'manage_integrations', 'manage_contracts', 'manage_billing', 'manage_client_messaging', 'manage_team']
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
  editingSystemRole,
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
      } else if (editingSystemRole) {
        setName(editingSystemRole.name);
        setDescription(editingSystemRole.description);
        setSelectedPermissions(editingSystemRole.permissions || []);
      } else {
        setName('');
        setDescription('');
        setSelectedPermissions([]);
      }
    }
  }, [open, editingRole, editingSystemRole]);

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
            {editingRole ? `Edit Role: ${editingRole.name}` : 
             editingSystemRole ? `Edit System Role: ${editingSystemRole.name}` : 
             'Create New Role'}
          </SheetTitle>
          <SheetDescription>
            {editingRole ? 'Update the role details and permissions.' :
             editingSystemRole ? 'Update the permissions for this system role.' :
             'Create a new role with specific permissions for your team members.'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Basic Information - Only show for custom roles */}
          {!editingSystemRole && (
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
          )}

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
                                <span className={`font-medium text-sm ${isSelected ? 'text-primary' : 'text-foreground'} block`}>
                                  {permission.name.replace(/_/g, ' ').replace(/^./, str => str.toUpperCase())}
                                </span>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {PERMISSION_DESCRIPTIONS[permission.name as keyof typeof PERMISSION_DESCRIPTIONS] || permission.description}
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
          <Button onClick={handleSave} disabled={(!editingSystemRole && !name.trim()) || loading}>
            {editingRole ? 'Update Role' : editingSystemRole ? 'Update Permissions' : 'Create Role'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}