import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight } from "lucide-react";

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

interface SimpleRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: Permission[];
  editingRole?: CustomRole | null;
  onSave: (name: string, description: string, permissionIds: string[]) => Promise<void>;
  loading?: boolean;
}

export function SimpleRoleDialog({
  open,
  onOpenChange,
  permissions,
  editingRole,
  onSave,
  loading = false
}: SimpleRoleDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  // Define presets
  const presets = [
    {
      id: 'viewer',
      name: 'Viewer',
      description: 'Can only view projects and leads',
      permissions: ['view_projects', 'view_leads']
    },
    {
      id: 'assistant',
      name: 'Assistant',
      description: 'Can view and edit assigned items',
      permissions: ['view_projects', 'view_leads', 'edit_assigned_projects', 'edit_assigned_leads']
    },
    {
      id: 'photographer',
      name: 'Photographer',
      description: 'Can manage sessions and view projects',
      permissions: ['view_projects', 'view_leads', 'manage_sessions', 'edit_assigned_projects']
    },
    {
      id: 'manager',
      name: 'Project Manager',
      description: 'Can manage all projects and leads',
      permissions: ['view_projects', 'view_leads', 'manage_all_projects', 'manage_all_leads', 'manage_sessions']
    }
  ];

  // Group permissions by category
  const permissionsByCategory = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  // Reset form when dialog opens/closes or editing role changes
  useEffect(() => {
    if (open) {
      if (editingRole) {
        setName(editingRole.name);
        setDescription(editingRole.description);
        setSelectedPermissions(editingRole.permissions.map(p => p.id));
        setSelectedPreset('');
      } else {
        setName('');
        setDescription('');
        setSelectedPermissions([]);
        setSelectedPreset('');
      }
    }
  }, [open, editingRole]);

  const handleSave = async () => {
    if (!name.trim()) return;
    
    await onSave(name.trim(), description.trim(), selectedPermissions);
    onOpenChange(false);
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    if (presetId === 'custom') {
      // Keep current permissions for custom
      return;
    }
    
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      // Filter to only include permissions that exist in the system
      const validPermissions = preset.permissions.filter(permId => 
        permissions.some(p => p.id === permId)
      );
      setSelectedPermissions(validPermissions);
      setName(preset.name);
      setDescription(preset.description);
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const toggleCategory = (categoryPermissions: Permission[]) => {
    const categoryIds = categoryPermissions.map(p => p.id);
    const allSelected = categoryIds.every(id => selectedPermissions.includes(id));
    
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(id => !categoryIds.includes(id)));
    } else {
      setSelectedPermissions(prev => [...new Set([...prev, ...categoryIds])]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Role'}
          </DialogTitle>
          <DialogDescription>
            {editingRole 
              ? 'Update the role details and permissions.'
              : 'Create a new role with specific permissions for your team members.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="roleName">Role Name</Label>
              <Input
                id="roleName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Project Manager"
              />
            </div>
            
            <div>
              <Label htmlFor="roleDescription">Description</Label>
              <Textarea
                id="roleDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the role's responsibilities..."
                rows={2}
              />
            </div>
          </div>

          <Separator />

          {/* Role Template Selection */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="roleTemplate">Role Template (Optional)</Label>
              <Select value={selectedPreset} onValueChange={handlePresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template or create custom" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Role</SelectItem>
                  {presets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name} - {preset.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Permissions */}
          <div className="space-y-4">
            <div>
              <h4 className="font-medium">Permissions</h4>
              <p className="text-sm text-muted-foreground">
                Select the permissions for this role
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-3 border rounded-lg p-4">
              {Object.entries(permissionsByCategory).map(([category, categoryPermissions]) => {
                const allSelected = categoryPermissions.every(p => selectedPermissions.includes(p.id));

                return (
                  <Collapsible key={category} defaultOpen>
                    <CollapsibleTrigger className="flex items-center justify-between w-full text-left hover:bg-muted/50 p-2 rounded">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => toggleCategory(categoryPermissions)}
                        />
                        <span className="font-medium text-sm capitalize">
                          {category.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({categoryPermissions.filter(p => selectedPermissions.includes(p.id)).length}/{categoryPermissions.length})
                        </span>
                      </div>
                      <ChevronDown className="h-4 w-4" />
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="space-y-2 ml-6 mt-2">
                      {categoryPermissions.map((permission) => (
                        <div key={permission.id} className="flex items-start space-x-2">
                          <Checkbox
                            id={permission.id}
                            checked={selectedPermissions.includes(permission.id)}
                            onCheckedChange={() => togglePermission(permission.id)}
                          />
                          <Label htmlFor={permission.id} className="text-sm cursor-pointer">
                            <div>
                              <span className="font-medium">{permission.name.replace(/_/g, ' ')}</span>
                              <p className="text-xs text-muted-foreground">{permission.description}</p>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || loading}>
            {editingRole ? 'Update Role' : 'Create Role'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}