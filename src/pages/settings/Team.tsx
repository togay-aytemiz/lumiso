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
import { ChevronDown, Loader2, X, Copy, Check, MoreHorizontal, Plus, Trash2, Edit2 } from "lucide-react";
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

export default function Team() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Member");
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
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

  // Load permissions and custom roles
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
      setNewRoleName("");
      setNewRoleDescription("");
      setSelectedPermissions([]);
      setIsCreateRoleOpen(false);
      
      toast({
        title: "Success",
        description: "Custom role created successfully",
      });
    } catch (error) {
      console.error('Error creating role:', error);
      toast({
        title: "Error",
        description: "Failed to create custom role",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      const { error } = await supabase
        .from('custom_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      setCustomRoles(prev => prev.filter(role => role.id !== roleId));
      
      toast({
        title: "Success",
        description: "Custom role deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting role:', error);
      toast({
        title: "Error",
        description: "Failed to delete custom role",
        variant: "destructive",
      });
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
          description="Manage custom roles and their permissions."
          sectionId="roles-permissions"
        >
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium">Custom Roles</h4>
                <p className="text-sm text-muted-foreground">
                  Create custom roles with specific permissions for your team
                </p>
              </div>
              <Dialog open={isCreateRoleOpen} onOpenChange={setIsCreateRoleOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Role
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Custom Role</DialogTitle>
                    <DialogDescription>
                      Define a new role and assign permissions to control what team members can access.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="role-name">Role Name</Label>
                        <Input
                          id="role-name"
                          placeholder="e.g., Editor, Viewer, Manager"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role-description">Description (Optional)</Label>
                        <Input
                          id="role-description"
                          placeholder="Brief description of this role"
                          value={newRoleDescription}
                          onChange={(e) => setNewRoleDescription(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <Label>Permissions</Label>
                      {Object.entries(permissionsByCategory).map(([category, categoryPermissions]) => (
                        <div key={category} className="space-y-2">
                          <h5 className="font-medium text-sm">{category}</h5>
                          <div className="grid grid-cols-1 gap-2 pl-4">
                            {categoryPermissions.map((permission) => (
                              <div key={permission.id} className="flex items-center space-x-2">
                                <Switch
                                  id={`permission-${permission.id}`}
                                  checked={selectedPermissions.includes(permission.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedPermissions(prev => [...prev, permission.id]);
                                    } else {
                                      setSelectedPermissions(prev => prev.filter(id => id !== permission.id));
                                    }
                                  }}
                                />
                                <Label htmlFor={`permission-${permission.id}`} className="text-sm">
                                  {permission.description}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateRoleOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateRole} disabled={!newRoleName.trim()}>
                      Create Role
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Default Roles */}
            <div className="space-y-3">
              <h5 className="font-medium text-sm">Default Roles</h5>
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h6 className="font-medium">Owner</h6>
                    <p className="text-sm text-muted-foreground">Full access to all features and settings</p>
                  </div>
                  <Badge>System Role</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h6 className="font-medium">Member</h6>
                    <p className="text-sm text-muted-foreground">Basic access with limited permissions</p>
                  </div>
                  <Badge variant="secondary">System Role</Badge>
                </div>
              </div>
            </div>

            {/* Custom Roles */}
            {customRoles.length > 0 && (
              <div className="space-y-3">
                <h5 className="font-medium text-sm">Custom Roles</h5>
                <div className="grid gap-3">
                  {customRoles.map((role) => (
                    <div key={role.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h6 className="font-medium">{role.name}</h6>
                          <Badge variant="outline">Custom</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {role.description || "No description"}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {role.permissions.map((permission) => (
                            <Badge key={permission.id} variant="secondary" className="text-xs">
                              {permission.name.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingRole(role)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit Role
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteRole(role.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Role
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CategorySettingsSection>
      </div>
    </SettingsPageWrapper>
  );
}