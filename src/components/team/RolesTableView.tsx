import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Shield, Edit, Plus, Users, Trash2 } from "lucide-react";
import { StructuredRoleDialog } from "@/components/settings/StructuredRoleDialog";
import { PermissionTooltip } from "./PermissionTooltip";

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  permissions?: string[];
}

interface CustomRole {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

interface MemberRole {
  id: string;
  custom_role_id?: string;
  system_role: 'Owner' | 'Member';
}

interface RolesTableViewProps {
  roleTemplates: RoleTemplate[];
  customRoles: CustomRole[];
  memberRoles: MemberRole[];
  permissions: Permission[];
  onCreateRole: (name: string, description: string, permissionIds: string[]) => Promise<void>;
  onUpdateRole: (roleId: string, name: string, description: string, permissionIds: string[]) => Promise<void>;
  onDeleteRole: (roleId: string) => Promise<void>;
  onUpdateSystemRole?: (roleId: string, permissionIds: string[]) => Promise<void>;
  loading?: boolean;
}

export function RolesTableView({
  roleTemplates,
  customRoles,
  memberRoles,
  permissions,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
  onUpdateSystemRole,
  loading = false
}: RolesTableViewProps) {
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [editingSystemRole, setEditingSystemRole] = useState<RoleTemplate | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<CustomRole | null>(null);

  const handleEditCustomRole = (role: CustomRole) => {
    setEditingRole(role);
    setEditingSystemRole(null);
    setShowRoleDialog(true);
  };

  const handleEditSystemRole = (template: RoleTemplate) => {
    if (!onUpdateSystemRole) return;
    setEditingSystemRole(template);
    setEditingRole(null);
    setShowRoleDialog(true);
  };

  const handleCreateRole = () => {
    setEditingRole(null);
    setEditingSystemRole(null);
    setShowRoleDialog(true);
  };

  const handleSaveRole = async (name: string, description: string, permissionIds: string[]) => {
    if (editingSystemRole && onUpdateSystemRole) {
      await onUpdateSystemRole(editingSystemRole.id, permissionIds);
    } else if (editingRole) {
      await onUpdateRole(editingRole.id, name, description, permissionIds);
    } else {
      await onCreateRole(name, description, permissionIds);
    }
    setShowRoleDialog(false);
    setEditingRole(null);
    setEditingSystemRole(null);
  };

  const handleDeleteClick = (role: CustomRole) => {
    setRoleToDelete(role);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (roleToDelete) {
      await onDeleteRole(roleToDelete.id);
      setShowDeleteDialog(false);
      setRoleToDelete(null);
    }
  };

  const getMemberCount = (roleId: string, isSystemRole: boolean = false) => {
    if (isSystemRole) {
      // For system roles, match by system_role field (Owner, Member, etc)
      return memberRoles.filter(member => member.system_role === roleId).length;
    }
    return memberRoles.filter(member => member.custom_role_id === roleId).length;
  };

  const getSystemRolePermissions = (template: RoleTemplate) => {
    // System roles store permission names, not IDs
    return (template.permissions || [])
      .map(permName => permissions.find(p => p.name === permName))
      .filter(Boolean) as Permission[];
  };

  return (
    <TooltipProvider>
      <Card>
      <CardHeader>
        <CardTitle>Roles & Permissions</CardTitle>
        <CardDescription>
          Manage system and custom roles with specific permissions for your team
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* System Roles Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">System Roles</h4>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Name</TableHead>
                <TableHead className="w-[300px]">Description</TableHead>
                <TableHead className="w-[140px]">Members</TableHead>
                <TableHead className="w-[140px]">Permissions</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roleTemplates.map((template) => {
                const rolePermissions = getSystemRolePermissions(template);
                const memberCount = getMemberCount(template.name, true);
                return (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        {template.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {template.description}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline">
                          {memberCount} member{memberCount !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <PermissionTooltip 
                        permissions={rolePermissions} 
                        count={rolePermissions.length > 0 ? rolePermissions.length : template.permissions?.length || 0}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {onUpdateSystemRole && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditSystemRole(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Custom Roles Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Custom Roles</h4>
            <Button onClick={handleCreateRole}>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          </div>

          {customRoles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No custom roles yet. Create one to get started!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead className="w-[300px]">Description</TableHead>
                  <TableHead className="w-[140px]">Members</TableHead>
                  <TableHead className="w-[140px]">Permissions</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        <Shield className="h-4 w-4 text-primary" />
                        {role.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{role.description}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline">
                          {getMemberCount(role.id)} member{getMemberCount(role.id) !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <PermissionTooltip permissions={role.permissions} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditCustomRole(role)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(role)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Role Dialog */}
        <StructuredRoleDialog
          open={showRoleDialog}
          onOpenChange={setShowRoleDialog}
          permissions={permissions}
          editingRole={editingRole}
          editingSystemRole={editingSystemRole}
          onSave={handleSaveRole}
          loading={loading}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Role</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the "{roleToDelete?.name}" role? 
                {getMemberCount(roleToDelete?.id || '') > 0 && (
                  <span className="block mt-2 text-destructive font-medium">
                    Warning: This role is currently assigned to {getMemberCount(roleToDelete?.id || '')} team member{getMemberCount(roleToDelete?.id || '') !== 1 ? 's' : ''}. 
                    They will lose these permissions.
                  </span>
                )}
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Role
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}