import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, Edit, Plus, Check, X } from "lucide-react";

interface Permission {
  id: string;
  name: string;
  description: string;
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
  description?: string;
  permissions: Permission[];
}

interface MemberRole {
  id: string;
  custom_role_id?: string;
}

interface RolesTableViewProps {
  roleTemplates: RoleTemplate[];
  customRoles: CustomRole[];
  memberRoles: MemberRole[];
  permissions: Permission[];
  onCreateRole: (name: string, description: string, permissionIds: string[]) => Promise<void>;
  onUpdateRole: (roleId: string, name: string, description: string, permissionIds: string[]) => Promise<void>;
  onDeleteRole: (roleId: string) => Promise<void>;
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
  loading = false
}: RolesTableViewProps) {
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", permissions: [] as string[] });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "", permissions: [] as string[] });

  const handleEditRole = (role: CustomRole) => {
    setEditForm({
      name: role.name,
      description: role.description || "",
      permissions: role.permissions.map(p => p.id)
    });
    setEditingRoleId(role.id);
  };

  const handleSaveEdit = async () => {
    if (editingRoleId) {
      await onUpdateRole(editingRoleId, editForm.name, editForm.description, editForm.permissions);
      setEditingRoleId(null);
    }
  };

  const handleCreateRole = async () => {
    await onCreateRole(createForm.name, createForm.description, createForm.permissions);
    setShowCreateDialog(false);
    setCreateForm({ name: "", description: "", permissions: [] });
  };

  const getMemberCount = (roleId: string) => {
    return memberRoles.filter(member => member.custom_role_id === roleId).length;
  };

  const getSystemRolePermissions = (template: RoleTemplate) => {
    return (template.permissions || [])
      .map(permId => permissions.find(p => p.id === permId))
      .filter(Boolean) as Permission[];
  };

  return (
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
            <Badge variant="outline">Read-only</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="text-right">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roleTemplates.map((template) => {
                const rolePermissions = getSystemRolePermissions(template);
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
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {rolePermissions.slice(0, 3).map((permission) => (
                          <Badge key={permission.id} variant="secondary" className="text-xs">
                            {permission.name}
                          </Badge>
                        ))}
                        {rolePermissions.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{rolePermissions.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">System</Badge>
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
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Role
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Custom Role</DialogTitle>
                  <DialogDescription>
                    Define a new role with specific permissions for your team members.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Role name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <Textarea
                    placeholder="Role description (optional)"
                    value={createForm.description}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Permissions</label>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {permissions.map((permission) => (
                        <label key={permission.id} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={createForm.permissions.includes(permission.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCreateForm(prev => ({
                                  ...prev,
                                  permissions: [...prev.permissions, permission.id]
                                }));
                              } else {
                                setCreateForm(prev => ({
                                  ...prev,
                                  permissions: prev.permissions.filter(id => id !== permission.id)
                                }));
                              }
                            }}
                          />
                          <span>{permission.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateRole} disabled={!createForm.name.trim()}>
                    Create Role
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                  <TableHead>Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      {editingRoleId === role.id ? (
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-32"
                        />
                      ) : (
                        <div className="flex items-center gap-2 font-medium">
                          <Shield className="h-4 w-4 text-primary" />
                          {role.name}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingRoleId === role.id ? (
                        <Textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                          className="w-48 h-20"
                        />
                      ) : (
                        <span className="text-muted-foreground">{role.description}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getMemberCount(role.id)} member{getMemberCount(role.id) !== 1 ? 's' : ''}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {role.permissions.slice(0, 3).map((permission) => (
                          <Badge key={permission.id} variant="outline" className="text-xs">
                            {permission.name}
                          </Badge>
                        ))}
                        {role.permissions.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{role.permissions.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {editingRoleId === role.id ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleSaveEdit}
                              disabled={!editForm.name.trim()}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingRoleId(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRole(role)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}