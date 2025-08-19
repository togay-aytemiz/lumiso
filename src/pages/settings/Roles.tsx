import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useRoleManagement, Permission, CustomRole } from '@/hooks/useRoleManagement';
import { SimpleRoleDialog } from '@/components/settings/SimpleRoleDialog';
import { Plus, Edit, Trash2, Users, Shield } from 'lucide-react';

export default function Roles() {
  const { 
    permissions, 
    customRoles, 
    memberRoles, 
    loading, 
    createCustomRole, 
    updateRolePermissions, 
    assignRoleToMember,
    deleteCustomRole 
  } = useRoleManagement();

  const [showCreateRoleDialog, setShowCreateRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Group permissions by category
  const permissionsByCategory = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const handleCreateRole = async (name: string, description: string, permissionIds: string[]) => {
    await createCustomRole(name, description, permissionIds);
  };

  const handleEditRole = (role: CustomRole) => {
    setEditingRole(role);
    setShowCreateRoleDialog(true);
  };

  const handleUpdateRole = async (name: string, description: string, permissionIds: string[]) => {
    if (!editingRole) return;
    await updateRolePermissions(editingRole.id, permissionIds);
    setEditingRole(null);
  };

  const handleDeleteRole = async (roleId: string) => {
    await deleteCustomRole(roleId);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getMembersByRole = (roleId: string) => {
    return memberRoles.filter(member => member.custom_role_id === roleId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Role Management</h1>
          <p className="text-muted-foreground">
            Manage team roles and permissions for your organization
          </p>
        </div>
        
        <Button onClick={() => setShowCreateRoleDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Custom Roles */}
      <div className="grid gap-4">
        <h2 className="text-lg font-semibold flex items-center">
          <Shield className="h-5 w-5 mr-2" />
          Custom Roles
        </h2>
        
        {customRoles.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No custom roles created yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {customRoles.map((role) => {
              const membersWithRole = getMembersByRole(role.id);
              
              return (
                <Card key={role.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center">
                          {role.name}
                          <Badge variant="secondary" className="ml-2">
                            <Users className="h-3 w-3 mr-1" />
                            {membersWithRole.length}
                          </Badge>
                        </CardTitle>
                        {role.description && (
                          <CardDescription>{role.description}</CardDescription>
                        )}
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditRole(role)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Role</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the "{role.name}" role? 
                                This will remove the role from all assigned members.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteRole(role.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-4">
                      {/* Permissions */}
                      <div>
                        <h4 className="font-medium text-sm mb-2">Permissions</h4>
                        <div className="flex flex-wrap gap-1">
                          {role.permissions.map((permission) => (
                            <Badge key={permission.id} variant="outline" className="text-xs">
                              {permission.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      {/* Members with this role */}
                      {membersWithRole.length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <h4 className="font-medium text-sm mb-2">Members</h4>
                            <div className="flex flex-wrap gap-2">
                              {membersWithRole.map((member) => (
                                <div key={member.id} className="flex items-center space-x-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={member.profile_photo_url} />
                                    <AvatarFallback className="text-xs">
                                      {getInitials(member.full_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{member.full_name || 'Unnamed User'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className="grid gap-4">
        <h2 className="text-lg font-semibold flex items-center">
          <Users className="h-5 w-5 mr-2" />
          Team Members
        </h2>
        
        <div className="grid gap-4">
          {memberRoles.map((member) => {
            const memberRole = customRoles.find(role => role.id === member.custom_role_id);
            
            return (
              <Card key={member.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage src={member.profile_photo_url} />
                        <AvatarFallback>
                          {getInitials(member.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div>
                        <p className="font-medium">{member.full_name || 'Unnamed User'}</p>
                        <div className="flex items-center space-x-2">
                          <Badge variant={member.system_role === 'Owner' ? 'default' : 'secondary'}>
                            {member.system_role}
                          </Badge>
                          {memberRole && (
                            <Badge variant="outline">{memberRole.name}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {member.system_role !== 'Owner' && (
                      <Select
                        value={member.custom_role_id || ''}
                        onValueChange={(value) => assignRoleToMember(member.id, value)}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Assign role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No role</SelectItem>
                          {customRoles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Role Dialog */}
      <SimpleRoleDialog
        open={showCreateRoleDialog}
        onOpenChange={setShowCreateRoleDialog}
        permissions={permissions}
        editingRole={editingRole}
        onSave={editingRole ? handleUpdateRole : handleCreateRole}
        loading={loading}
      />
    </div>
  );
}