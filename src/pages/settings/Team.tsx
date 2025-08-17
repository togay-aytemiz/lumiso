import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { CategorySettingsSection } from "@/components/settings/CategorySettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { ChevronDown, Loader2, X, Copy, Check, MoreHorizontal, Plus, Trash2, Edit2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTeamManagement } from "@/hooks/useTeamManagement";
import { useToast } from "@/hooks/use-toast";
import { useSettingsCategorySection } from "@/hooks/useSettingsCategorySection";
import { formatDistanceToNow } from "date-fns";

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

interface SystemRole {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isEditable: boolean;
}

export default function Team() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Member");
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [systemRoles, setSystemRoles] = useState<SystemRole[]>([]);
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | SystemRole | null>(null);
  const [isEditingSystem, setIsEditingSystem] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const isMobile = useIsMobile();
  
  const { 
    teamMembers, 
    invitations, 
    loading: teamLoading, 
    currentUserRole,
    sendInvitation, 
    cancelInvitation, 
    removeMember, 
    updateMemberRole 
  } = useTeamManagement();
  const { toast } = useToast();

  // Team management section state
  const teamSection = useSettingsCategorySection({
    sectionId: "team",
    sectionName: "Team Management",
    initialValues: {},
    onSave: async () => ({})
  });

  // Load permissions and roles
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Load permissions
        const { data: permissionsData, error: permissionsError } = await supabase
          .from('permissions')
          .select('*')
          .order('category', { ascending: true });
        
        if (permissionsError) throw permissionsError;
        setPermissions(permissionsData || []);

        // Load custom roles for current organization
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: rolesData, error: rolesError } = await supabase
            .from('custom_roles')
            .select(`
              *,
              role_permissions!inner(
                permission_id,
                permissions(*)
              )
            `)
            .eq('organization_id', user.id)
            .order('sort_order');
          
          if (rolesError) throw rolesError;
          
          // Transform the data to include permissions array
          const transformedRoles = (rolesData || []).map(role => ({
            id: role.id,
            name: role.name,
            description: role.description || '',
            permissions: role.role_permissions?.map((rp: any) => rp.permissions) || []
          }));
          
          setCustomRoles(transformedRoles);

          // Set up system roles (Owner and Member)
          setSystemRoles([
            {
              id: 'owner',
              name: 'Owner',
              description: 'Full access to all features and settings',
              permissions: permissionsData || [],
              isEditable: false
            },
            {
              id: 'member',
              name: 'Member', 
              description: 'Basic team member access',
              permissions: (permissionsData || []).filter(p => 
                ['view_projects', 'view_sessions', 'view_clients'].includes(p.name)
              ),
              isEditable: true
            }
          ]);
        }
      } catch (error) {
        console.error('Error loading team data:', error);
        toast({
          title: "Error",
          description: "Failed to load team data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSendInvitation = async () => {
    if (!inviteEmail.trim()) return;
    
    const result = await sendInvitation(inviteEmail, inviteRole);
    if (result.success) {
      setInviteEmail("");
      setInviteRole("Member");
    }
  };

  const handleCopyInvitationLink = async (invitationId: string) => {
    try {
      const invitationLink = `${window.location.origin}/accept-invitation?id=${invitationId}`;
      await navigator.clipboard.writeText(invitationLink);
      
      setCopiedStates(prev => ({ ...prev, [invitationId]: true }));
      
      toast({
        title: "Invitation link copied!",
        description: "You can now share this link with your team member.",
      });
      
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [invitationId]: false }));
      }, 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy invitation link to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create the role
      const { data: roleData, error: roleError } = await supabase
        .from('custom_roles')
        .insert({
          organization_id: user.id,
          name: newRoleName.trim(),
          description: newRoleDescription.trim(),
          sort_order: customRoles.length + 1
        })
        .select()
        .single();

      if (roleError) throw roleError;

      // Add permissions to the role
      if (selectedPermissions.length > 0) {
        const { error: permissionsError } = await supabase
          .from('role_permissions')
          .insert(
            selectedPermissions.map(permissionId => ({
              role_id: roleData.id,
              permission_id: permissionId
            }))
          );

        if (permissionsError) throw permissionsError;
      }

      // Update local state
      const newRole: CustomRole = {
        id: roleData.id,
        name: roleData.name,
        description: roleData.description || '',
        permissions: permissions.filter(p => selectedPermissions.includes(p.id))
      };
      
      setCustomRoles(prev => [...prev, newRole]);
      
      // Reset form
      resetRoleForm();
      
      toast({
        title: "Success",
        description: "Role created successfully",
      });
    } catch (error) {
      console.error('Error creating role:', error);
      toast({
        title: "Error",
        description: "Failed to create role",
        variant: "destructive",
      });
    }
  };

  const handleEditRole = async () => {
    if (!editingRole || !newRoleName.trim()) return;
    
    try {
      if (isEditingSystem) {
        // For system roles, just update local state (Member role)
        setSystemRoles(prev => prev.map(role => 
          role.id === editingRole.id 
            ? {
                ...role,
                name: newRoleName.trim(),
                description: newRoleDescription.trim(),
                permissions: permissions.filter(p => selectedPermissions.includes(p.id))
              }
            : role
        ));
        
        toast({
          title: "Success",
          description: "Role updated successfully",
        });
      } else {
        // Update custom role in database
        const { error: roleError } = await supabase
          .from('custom_roles')
          .update({
            name: newRoleName.trim(),
            description: newRoleDescription.trim(),
          })
          .eq('id', editingRole.id);

        if (roleError) throw roleError;

        // Delete existing permissions
        const { error: deleteError } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', editingRole.id);

        if (deleteError) throw deleteError;

        // Add new permissions
        if (selectedPermissions.length > 0) {
          const { error: permissionsError } = await supabase
            .from('role_permissions')
            .insert(
              selectedPermissions.map(permissionId => ({
                role_id: editingRole.id,
                permission_id: permissionId
              }))
            );

          if (permissionsError) throw permissionsError;
        }

        // Update local state
        setCustomRoles(prev => prev.map(role => 
          role.id === editingRole.id 
            ? {
                ...role,
                name: newRoleName.trim(),
                description: newRoleDescription.trim(),
                permissions: permissions.filter(p => selectedPermissions.includes(p.id))
              }
            : role
        ));
        
        toast({
          title: "Success",
          description: "Role updated successfully",
        });
      }
      
      // Reset form
      resetRoleForm();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const resetRoleForm = () => {
    setNewRoleName("");
    setNewRoleDescription("");
    setSelectedPermissions([]);
    setIsCreateRoleOpen(false);
    setEditingRole(null);
    setIsEditingSystem(false);
  };

  const openEditRole = (role: CustomRole | SystemRole, isSystem: boolean = false) => {
    setEditingRole(role);
    setIsEditingSystem(isSystem);
    setNewRoleName(role.name);
    setNewRoleDescription(role.description);
    setSelectedPermissions(role.permissions.map(p => p.id));
    setIsCreateRoleOpen(true);
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      const { error } = await supabase
        .from('custom_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      setCustomRoles(prev => prev.filter(role => role.id !== roleId));
      setRoleToDelete(null);
      
      toast({
        title: "Success",
        description: "Role deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting role:', error);
      toast({
        title: "Error",
        description: "Failed to delete role",
        variant: "destructive",
      });
    }
  };

  const handleSelectAllPermissions = () => {
    if (selectedPermissions.length === permissions.length) {
      setSelectedPermissions([]);
    } else {
      setSelectedPermissions(permissions.map(p => p.id));
    }
  };

  const getAvailableRoles = () => {
    const baseRoles = ["Owner", "Member"];
    const customRoleNames = customRoles.map(role => role.name);
    return [...baseRoles, ...customRoleNames];
  };

  const formatLastActive = (lastActive: string | null) => {
    if (!lastActive) return "Never";
    return formatDistanceToNow(new Date(lastActive), { addSuffix: true });
  };

  const permissionsByCategory = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (isLoading || teamLoading) {
    return (
      <SettingsPageWrapper>
        <SettingsHeader
          title="Team Management"
          description="Manage your team members, roles, and permissions"
        />
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </SettingsPageWrapper>
    );
  }

  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Team Management"
        description="Manage your team members, roles, and permissions"
      />
      
      <div className="space-y-8">
        <CategorySettingsSection
          title="Invite Team Member"
          description="Send invitations to new team members."
          sectionId="team"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="Enter email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableRoles().filter(role => role !== "Owner").map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleSendInvitation} disabled={!inviteEmail.trim()}>
              Send Invitation
            </Button>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-3">Pending Invitations</h4>
                <div className="space-y-2">
                  {invitations.map((invitation) => (
                    <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{invitation.email}</p>
                          <p className="text-sm text-muted-foreground">
                            Role: {invitation.role} • Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyInvitationLink(invitation.id)}
                          className="flex items-center gap-2"
                        >
                          {copiedStates[invitation.id] ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                          {copiedStates[invitation.id] ? "Copied!" : "Copy Link"}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <X className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to cancel this invitation? The recipient will no longer be able to join using this invitation.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => cancelInvitation(invitation.id)}>
                                Cancel Invitation
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CategorySettingsSection>

        <CategorySettingsSection
          title="Team Members"
          description="Manage existing team members and their roles."
          sectionId="team-members"
        >
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((member) => {
                  const displayName = member.full_name || "(Name not set)";
                  const displayEmail = member.email || "(Email not available)";
                  const isOwner = member.role === "Owner";
                  
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.profile_photo_url} />
                              <AvatarFallback>
                                {displayName === "(Name not set)" ? "U" : displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {member.is_online && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full animate-pulse" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{displayName}</p>
                            {/* Show (You) indicator - will be implemented with proper user comparison */}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{displayEmail}</TableCell>
                      <TableCell>
                        <Badge variant={isOwner ? "default" : "secondary"}>
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatLastActive(member.last_active)}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isOwner && currentUserRole === "Owner" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  // Handle role change - you would implement a role selection dialog here
                                }}
                              >
                                <Edit2 className="h-4 w-4 mr-2" />
                                Change Role
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => removeMember(member.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CategorySettingsSection>

        <CategorySettingsSection
          title="Roles & Permissions"
          description="Create and manage custom roles with specific permissions."
          sectionId="roles-permissions"
        >
          <div className="space-y-6">
            {/* Create Role Button */}
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium">Available Roles</h4>
              <Button onClick={() => setIsCreateRoleOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            </div>

            {/* System Roles */}
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-muted-foreground">System Roles</h5>
              <div className="grid gap-4">
                {systemRoles.map((role) => (
                  <Card key={role.id} className="relative">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base">{role.name}</CardTitle>
                          <CardDescription className="mt-1">{role.description}</CardDescription>
                          <div className="flex flex-wrap gap-1 mt-3">
                            {role.id === 'owner' ? (
                              <Badge variant="outline" className="text-xs">All Permissions</Badge>
                            ) : (
                              <>
                                {role.permissions.slice(0, 3).map((permission) => (
                                  <Badge key={permission.id} variant="outline" className="text-xs">
                                    {permission.name.replace(/_/g, ' ')}
                                  </Badge>
                                ))}
                                {role.permissions.length > 3 && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">
                                        +{role.permissions.length - 3} more
                                      </Badge>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                      <div className="space-y-2">
                                        <h4 className="font-medium text-sm">All Permissions</h4>
                                        <div className="flex flex-wrap gap-1">
                                          {role.permissions.map((permission) => (
                                            <Badge key={permission.id} variant="outline" className="text-xs">
                                              {permission.name.replace(/_/g, ' ')}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center self-start">
                          {role.isEditable && (
                            <>
                              {isMobile ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditRole(role, true)}>
                                      <Edit2 className="h-4 w-4 mr-2" />
                                      Edit Role
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => openEditRole(role, true)}
                                >
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Edit
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Custom Roles */}
            {customRoles.length > 0 && (
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-muted-foreground">Custom Roles</h5>
                <div className="grid gap-4">
                  {customRoles.map((role) => (
                    <Card key={role.id} className="relative">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base">{role.name}</CardTitle>
                            {role.description && (
                              <CardDescription className="mt-1">{role.description}</CardDescription>
                            )}
                            <div className="flex flex-wrap gap-1 mt-3">
                              {role.permissions.slice(0, 3).map((permission) => (
                                <Badge key={permission.id} variant="outline" className="text-xs">
                                  {permission.name.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                              {role.permissions.length > 3 && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">
                                      +{role.permissions.length - 3} more
                                    </Badge>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80">
                                    <div className="space-y-2">
                                      <h4 className="font-medium text-sm">All Permissions</h4>
                                      <div className="flex flex-wrap gap-1">
                                        {role.permissions.map((permission) => (
                                          <Badge key={permission.id} variant="outline" className="text-xs">
                                            {permission.name.replace(/_/g, ' ')}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center self-start">
                            {isMobile ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditRole(role)}>
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Edit Role
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => setRoleToDelete(role.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Role
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => openEditRole(role)}
                                >
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Edit
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setRoleToDelete(role.id)}
                                  className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Create/Edit Role Modal */}
          <AppSheetModal
            title={editingRole ? `Edit ${editingRole.name}` : "Create Role"}
            isOpen={isCreateRoleOpen}
            onOpenChange={(open) => {
              if (!open) resetRoleForm();
            }}
            size="lg"
            footerActions={[
              {
                label: "Cancel",
                onClick: () => resetRoleForm(),
                variant: "outline"
              },
              {
                label: editingRole ? "Save Changes" : "Create Role",
                onClick: editingRole ? handleEditRole : handleCreateRole,
                disabled: !newRoleName.trim()
              }
            ]}
          >
            <div className="flex flex-col h-full space-y-6">
              <div className="space-y-4 flex-shrink-0">
                <div className="space-y-2">
                  <Label htmlFor="role-name">Role Name</Label>
                  <Input
                    id="role-name"
                    placeholder="Enter role name"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role-description">Description (optional)</Label>
                  <Textarea
                    id="role-description"
                    placeholder="Enter role description"
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="flex flex-col flex-1 min-h-0 space-y-4">
                <div className="flex items-center justify-between flex-shrink-0">
                  <Label>Permissions</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllPermissions}
                  >
                    {selectedPermissions.length === permissions.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                  {Object.entries(permissionsByCategory).map(([category, categoryPermissions]) => (
                    <div key={category} className="space-y-3">
                      <h5 className="font-medium text-sm sticky top-0 bg-background py-2 border-b">{category}</h5>
                      <div className="space-y-3 pl-4">
                        {categoryPermissions.map((permission) => (
                          <div key={permission.id} className="flex items-start space-x-3">
                            <Checkbox
                              id={`permission-${permission.id}`}
                              checked={selectedPermissions.includes(permission.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedPermissions(prev => [...prev, permission.id]);
                                } else {
                                  setSelectedPermissions(prev => prev.filter(id => id !== permission.id));
                                }
                              }}
                              className="mt-0.5"
                            />
                            <div className="flex-1 space-y-1">
                              <Label 
                                htmlFor={`permission-${permission.id}`} 
                                className="text-sm font-medium cursor-pointer"
                              >
                                {permission.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </Label>
                              <p className="text-xs text-muted-foreground">{permission.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AppSheetModal>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={!!roleToDelete} onOpenChange={() => setRoleToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Role</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this role? This action cannot be undone.
                  Any team members with this role will need to be assigned a new role.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => roleToDelete && handleDeleteRole(roleToDelete)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Role
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CategorySettingsSection>
      </div>
    </SettingsPageWrapper>
  );
}