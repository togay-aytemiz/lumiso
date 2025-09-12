import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { settingsHelpContent } from "@/lib/settingsHelpContent";
import { CategorySettingsSection } from "@/components/settings/CategorySettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { ChevronDown, Loader2, X, Copy, Check, Plus, Trash2, Edit2, Wifi, WifiOff } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTeamManagement } from "@/hooks/useTeamManagement";
import { useRoleManagement, type Permission, type CustomRole } from "@/hooks/useRoleManagement";
import { useToast } from "@/hooks/use-toast";
import { useSettingsCategorySection } from "@/hooks/useSettingsCategorySection";
import { formatDistanceToNow } from "date-fns";
import { SettingsLoadingSkeleton } from "@/components/ui/loading-presets";
import { InvitationErrorBoundary } from "@/components/team/InvitationErrorBoundary";
import { EnhancedInvitationForm } from "@/components/team/EnhancedInvitationForm";
import { usePermissionPreview } from "@/hooks/usePermissionPreview";
import { PermissionPreviewCard } from "@/components/team/PermissionPreviewCard";
import { useOptimizedPresence } from "@/hooks/useOptimizedPresence";
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
  const [copiedStates, setCopiedStates] = useState<{
    [key: string]: boolean;
  }>({});
  
  // Team management section state
  const teamSection = useSettingsCategorySection({
    sectionId: "team",
    sectionName: "Team Management",
    initialValues: {},
    onSave: async () => ({})
  });

  // Initialize optimized presence tracking
  const { isUserOnline, getUserLastSeen, totalOnline } = useOptimizedPresence();

  // Define presets
  const presets = [{
    id: 'viewer',
    name: 'Viewer',
    description: 'Can only view projects and leads',
    permissions: ['view_assigned_leads', 'view_assigned_projects']
  }, {
    id: 'assistant', 
    name: 'Assistant',
    description: 'Can view and edit assigned items',
    permissions: ['view_assigned_leads', 'view_assigned_projects', 'edit_assigned_leads', 'edit_assigned_projects']
  }, {
    id: 'photographer',
    name: 'Photographer', 
    description: 'Can manage sessions and view projects',
    permissions: ['view_assigned_leads', 'view_assigned_projects', 'manage_sessions', 'edit_assigned_projects']
  }, {
    id: 'manager',
    name: 'Project Manager',
    description: 'Can manage all projects and leads',
    permissions: ['manage_all_projects', 'manage_all_leads', 'create_leads', 'create_projects', 'manage_sessions']
  }];
  
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
  
  // Use the proper role management hook
  const {
    permissions,
    customRoles,
    memberRoles,
    loading: roleLoading,
    createCustomRole,
    updateRolePermissions,
    assignRoleToMember,
    deleteCustomRole
  } = useRoleManagement();
  
  const [systemRoles, setSystemRoles] = useState<SystemRole[]>([]);
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | SystemRole | null>(null);
  const [isEditingSystem, setIsEditingSystem] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Set up system roles when permissions load
  useEffect(() => {
    if (permissions.length > 0) {
      console.log('Setting up system roles with permissions:', permissions);
      setSystemRoles([{
        id: 'owner',
        name: 'Owner',
        description: 'Full access to all features and settings',
        permissions: permissions,
        isEditable: false
      }, {
        id: 'member',
        name: 'Member',
        description: 'Basic team member access',
        permissions: permissions.filter(p => 
          ['view_assigned_leads', 'view_assigned_projects', 'manage_sessions'].includes(p.name)
        ),
        isEditable: true
      }]);
    }
  }, [permissions]);
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
      const invitation = invitations.find(inv => inv.id === invitationId);
      if (!invitation) return;
      const invitationLink = `${window.location.origin}/accept-invitation?invitation=${invitationId}&email=${encodeURIComponent(invitation.email)}`;
      await navigator.clipboard.writeText(invitationLink);
      setCopiedStates(prev => ({
        ...prev,
        [invitationId]: true
      }));
      toast({
        title: "Invitation link copied!",
        description: "You can now share this link with your team member."
      });
      setTimeout(() => {
        setCopiedStates(prev => ({
          ...prev,
          [invitationId]: false
        }));
      }, 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy invitation link to clipboard.",
        variant: "destructive"
      });
    }
  };
  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    
    try {
      await createCustomRole(
        newRoleName.trim(), 
        newRoleDescription.trim(), 
        selectedPermissions
      );
      resetRoleForm();
    } catch (error) {
      console.error('Error creating role:', error);
    }
  };
  const handleEditRole = async () => {
    if (!editingRole || !newRoleName.trim()) return;
    
    try {
      if (isEditingSystem) {
        // For system roles, just update local state (Member role)
        setSystemRoles(prev => prev.map(role => 
          role.id === editingRole.id ? {
            ...role,
            name: newRoleName.trim(),
            description: newRoleDescription.trim(),
            permissions: permissions.filter(p => selectedPermissions.includes(p.id))
          } : role
        ));
        toast({
          title: "Success",
          description: "Role updated successfully"
        });
      } else {
        // Update custom role using the hook
        await updateRolePermissions(editingRole.id, selectedPermissions);
      }

      resetRoleForm();
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };
  const resetRoleForm = () => {
    setNewRoleName("");
    setNewRoleDescription("");
    setSelectedPermissions([]);
    setSelectedPreset('');
    setIsCreateRoleOpen(false);
    setEditingRole(null);
    setIsEditingSystem(false);
  };
  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    if (presetId === 'custom' || !presetId) {
      return;
    }
    
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      // Filter to only include permissions that exist in the system
      const validPermissions = preset.permissions
        .map(permName => permissions.find(p => p.name === permName)?.id)
        .filter(Boolean) as string[];
      
      setSelectedPermissions(validPermissions);
      setNewRoleName(preset.name);
      setNewRoleDescription(preset.description);
    }
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
      await deleteCustomRole(roleId);
      setRoleToDelete(null);
    } catch (error) {
      console.error('Error deleting role:', error);
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
    const systemRoles = ["Owner", "Member"];
    const customRoleNames = customRoles.map(role => role.name);
    return [...systemRoles, ...customRoleNames];
  };
  const formatLastActive = (lastActive: string | null) => {
    if (!lastActive) return "Never";
    return formatDistanceToNow(new Date(lastActive), {
      addSuffix: true
    });
  };
  const permissionsByCategory = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);
  if (teamLoading || roleLoading) {
    return <SettingsPageWrapper>
        <SettingsHeader title="Team Management" description="Manage your team members, roles, and permissions" helpContent={settingsHelpContent.team} />
        <SettingsLoadingSkeleton rows={5} />
      </SettingsPageWrapper>;
  }
  return <SettingsPageWrapper>
      <SettingsHeader title="Team Management" description="Manage your team members, roles, and permissions" helpContent={settingsHelpContent.team} />
      
      <div className="space-y-8">
        <InvitationErrorBoundary>
          <EnhancedInvitationForm
            availableRoles={getAvailableRoles()}
            onSendInvitation={async (email, role, options) => {
              const result = await sendInvitation(email, role);
              return result;
            }}
            loading={teamLoading}
          />
        </InvitationErrorBoundary>

        <CategorySettingsSection 
          title={`Team Members (${teamMembers.length} total, ${totalOnline} online)`} 
          description="Manage existing team members and their roles." 
          sectionId="team-members"
        >
          <div className="space-y-4">
            {teamMembers.length === 0 ? <p className="text-muted-foreground">No team members found.</p> : <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map(member => <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={member.profile_photo_url || ''} alt={member.full_name || ''} />
                                <AvatarFallback>
                                  {member.full_name?.split(' ').map(n => n[0]).join('') || (member.email ? member.email[0].toUpperCase() : '?')}
                                </AvatarFallback>
                              </Avatar>
                              {/* Online status indicator */}
                              {isUserOnline(member.user_id) && (
                                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 border-2 border-background rounded-full" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{member.full_name || 'No name'}</p>
                                {isUserOnline(member.user_id) && (
                                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                    <Wifi className="h-3 w-3" />
                                    Online
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{member.email}</p>
                              {!isUserOnline(member.user_id) && member.last_active && (
                                <p className="text-xs text-muted-foreground">
                                  Last active: {formatLastActive(member.last_active)}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {member.system_role === "Owner" ? (
                            <Badge variant="outline">{member.system_role}</Badge>
                          ) : (
                            <Select 
                              value={member.custom_role_id || member.system_role}
                              onValueChange={async (newRole) => {
                                console.log('Changing role for member:', member.user_id, 'to:', newRole);
                                
                                // If it's a system role, update the system_role field and clear custom_role_id
                                if (newRole === 'Owner' || newRole === 'Member') {
                                  const updateData = {
                                    system_role: newRole as 'Owner' | 'Member',
                                    custom_role_id: null // Clear custom role when assigning system role
                                  };
                                  
                                  const { error } = await supabase
                                    .from('organization_members')
                                    .update(updateData)
                                    .eq('id', member.id);
                                    
                                  if (error) {
                                    console.error('Error updating system role:', error);
                                    toast({
                                      title: "Error",
                                      description: "Failed to update member role",
                                      variant: "destructive",
                                    });
                                  } else {
                                    // Refetch team data after successful update
                                    window.location.reload();
                                  }
                                } else {
                                  // It's a custom role, assign it and set default system role
                                  const updateData = {
                                    custom_role_id: newRole,
                                    system_role: 'Member' as const // Default system role
                                  };
                                  
                                  const { error } = await supabase
                                    .from('organization_members')
                                    .update(updateData)
                                    .eq('id', member.id);
                                    
                                  if (error) {
                                    console.error('Error assigning custom role:', error);
                                    toast({
                                      title: "Error", 
                                      description: "Failed to assign custom role",
                                      variant: "destructive",
                                    });
                                  } else {
                                    // Refetch team data after successful update
                                    window.location.reload();
                                  }
                                }
                              }}
                            >
                              <SelectTrigger className="w-auto min-w-[100px] h-8 px-3 py-1 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Member">Member</SelectItem>
                                {customRoles.map(role => (
                                  <SelectItem key={role.id} value={role.id}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {member.is_online ? <>
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-sm font-medium text-green-600">Online</span>
                              </> : <span className="text-sm text-muted-foreground">
                                {formatLastActive(member.last_active)}
                              </span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {member.system_role !== "Owner" && <Button variant="outline" size="sm" onClick={() => removeMember(member.id)} className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground">
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove
                            </Button>}
                        </TableCell>
                      </TableRow>)}
                  </TableBody>
                </Table>
              </div>}
          </div>
        </CategorySettingsSection>

        <CategorySettingsSection title="Roles & Permissions" description="Create and manage custom roles with specific permissions." sectionId="roles-permissions">
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
            <div className="space-y-4">
              <h5 className="text-sm font-medium text-muted-foreground">System Roles</h5>
              <div className="space-y-4">
                {systemRoles.map(role => <Card key={role.id} className="border">
                    <CardContent className="p-6 mx-0">
                      <div className="flex items-center justify-between min-h-[80px]">
                        {/* Left Side - Role Info & Permissions */}
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex flex-col justify-center h-full space-y-2">
                            {/* Title & Description Row */}
                            <div>
                              <h3 className="text-base font-semibold text-foreground">{role.name}</h3>
                              <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                            </div>
                            
                            {/* Permissions Row */}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {role.id === 'owner' ? <Badge variant="outline" className="text-xs font-medium">All Permissions</Badge> : <>
                                  {role.permissions.slice(0, 3).map(permission => <Badge key={permission.id} variant="outline" className="text-xs">
                                      {permission.name.replace(/_/g, ' ')}
                                    </Badge>)}
                                  {role.permissions.length > 3 && <Popover>
                                      <PopoverTrigger asChild>
                                        <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">
                                          +{role.permissions.length - 3} more
                                        </Badge>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-80">
                                        <div className="space-y-2">
                                          <h4 className="font-medium text-sm">All Permissions</h4>
                                          <div className="flex flex-wrap gap-1">
                                            {role.permissions.map(permission => <Badge key={permission.id} variant="outline" className="text-xs">
                                                {permission.name.replace(/_/g, ' ')}
                                              </Badge>)}
                                          </div>
                                        </div>
                                      </PopoverContent>
                                    </Popover>}
                                </>}
                            </div>
                          </div>
                        </div>
                        
                        {/* Right Side - Actions Vertically Centered */}
                        <div className="flex items-center justify-center">
                          {role.isEditable && <Button variant="outline" size="sm" onClick={() => openEditRole(role, true)} className="whitespace-nowrap">
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </Button>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>)}
              </div>
            </div>

            {/* Custom Roles */}
            {customRoles.length > 0 && <div className="space-y-4">
                <h5 className="text-sm font-medium text-muted-foreground">Custom Roles</h5>
                <div className="space-y-4">
                  {customRoles.map(role => <Card key={role.id} className="border">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between min-h-[80px]">
                          {/* Left Side - Role Info & Permissions */}
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex flex-col justify-center h-full space-y-2">
                              {/* Title & Description Row */}
                              <div>
                                <h3 className="text-base font-semibold text-foreground">{role.name}</h3>
                                {role.description && <p className="text-sm text-muted-foreground mt-1">{role.description}</p>}
                              </div>
                              
                              {/* Permissions Row */}
                              <div className="flex flex-wrap gap-2 mt-2">
                                {role.permissions.slice(0, 3).map(permission => <Badge key={permission.id} variant="outline" className="text-xs">
                                    {permission.name.replace(/_/g, ' ')}
                                  </Badge>)}
                                {role.permissions.length > 3 && <Popover>
                                    <PopoverTrigger asChild>
                                      <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">
                                        +{role.permissions.length - 3} more
                                      </Badge>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                      <div className="space-y-2">
                                        <h4 className="font-medium text-sm">All Permissions</h4>
                                        <div className="flex flex-wrap gap-1">
                                          {role.permissions.map(permission => <Badge key={permission.id} variant="outline" className="text-xs">
                                              {permission.name.replace(/_/g, ' ')}
                                            </Badge>)}
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>}
                              </div>
                            </div>
                          </div>
                          
                          {/* Right Side - Actions Vertically Centered */}
                          <div className="flex items-center justify-center">
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEditRole(role)} className="whitespace-nowrap">
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setRoleToDelete(role.id)} className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground whitespace-nowrap">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>)}
                </div>
              </div>}
          </div>
        </CategorySettingsSection>

        
        
        {/* Create/Edit Role Sheet */}
        <AppSheetModal title={editingRole ? 'Edit Role' : 'Create New Role'} isOpen={isCreateRoleOpen} onOpenChange={setIsCreateRoleOpen} size="lg" footerActions={[{
        label: "Cancel",
        onClick: resetRoleForm,
        variant: "outline"
      }, {
        label: editingRole ? 'Update Role' : 'Create Role',
        onClick: editingRole ? handleEditRole : handleCreateRole,
        disabled: !newRoleName.trim()
      }]}>
          <div className="space-y-6">
            <div className="text-sm text-muted-foreground">
              {editingRole ? 'Modify the role details and permissions.' : 'Create a custom role with specific permissions for your team members.'}
            </div>
            
            {/* Role Name */}
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name</Label>
              <Input id="role-name" placeholder="e.g., Editor, Viewer, Admin" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} />
            </div>

            {/* Role Description */}
            <div className="space-y-2">
              <Label htmlFor="role-description">Description (Optional)</Label>
              <Textarea id="role-description" placeholder="Describe what this role can do..." value={newRoleDescription} onChange={e => setNewRoleDescription(e.target.value)} rows={3} />
            </div>

            {/* Role Template Selection */}
            {!editingRole && <div className="space-y-2">
                <Label htmlFor="role-template">Role Template (Optional)</Label>
                <Select value={selectedPreset} onValueChange={handlePresetChange}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Choose a template or create custom" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    <SelectItem value="custom">Custom Role</SelectItem>
                    {presets.map(preset => <SelectItem key={preset.id} value={preset.id}>
                        {preset.name} - {preset.description}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>}

            {/* Permissions Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Permissions</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleSelectAllPermissions}>
                  {selectedPermissions.length === permissions.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              
              <div className="space-y-4">
                {Object.entries(permissionsByCategory).map(([category, categoryPermissions]) => <div key={category} className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      {category}
                    </h4>
                    <div className="space-y-3">
                      {categoryPermissions.map(permission => <div key={permission.id} className="flex items-start space-x-3">
                          <Checkbox id={`permission-${permission.id}`} checked={selectedPermissions.includes(permission.id)} onCheckedChange={checked => {
                      if (checked) {
                        setSelectedPermissions(prev => [...prev, permission.id]);
                      } else {
                        setSelectedPermissions(prev => prev.filter(id => id !== permission.id));
                      }
                    }} />
                          <div className="space-y-1 leading-none">
                            <Label htmlFor={`permission-${permission.id}`} className="text-sm font-medium cursor-pointer">
                              {permission.name.replace(/_/g, ' ')}
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              {permission.description}
                            </p>
                          </div>
                        </div>)}
                    </div>
                  </div>)}
              </div>
            </div>
          </div>
        </AppSheetModal>

        {/* Delete Role Confirmation */}
        <AlertDialog open={!!roleToDelete} onOpenChange={() => setRoleToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Role</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this role? This action cannot be undone and any team members with this role will need to be assigned a new role.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => roleToDelete && handleDeleteRole(roleToDelete)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete Role
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SettingsPageWrapper>;
}