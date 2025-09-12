import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { settingsHelpContent } from "@/lib/settingsHelpContent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Settings, Crown, UserCheck, Plus, Edit, Shield, Users, Copy, X } from "lucide-react";
import { useTeamManagement } from "@/hooks/useTeamManagement";
import { useRoleManagement } from "@/hooks/useRoleManagement";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { SettingsLoadingSkeleton } from "@/components/ui/loading-presets";
import { InvitationErrorBoundary } from "@/components/team/InvitationErrorBoundary";
import { EnhancedInvitationForm } from "@/components/team/EnhancedInvitationForm";
import { StructuredRoleDialog } from "@/components/settings/StructuredRoleDialog";
import { useOptimizedPresence } from "@/hooks/useOptimizedPresence";

export default function Team() {
  const [copiedStates, setCopiedStates] = useState<{
    [key: string]: boolean;
  }>({});
  const [showCreateRoleDialog, setShowCreateRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);

  const { toast } = useToast();
  
  // Team management hook
  const {
    invitations,
    teamMembers,
    loading: teamLoading,
    sendInvitation,
    cancelInvitation,
    removeMember
  } = useTeamManagement();

  const {
    permissions,
    customRoles,
    roleTemplates,
    memberRoles,
    loading: roleLoading,
    createCustomRole,
    updateRolePermissions,
    assignRoleToMember,
    deleteCustomRole
  } = useRoleManagement();

  const { 
    isUserOnline,
    getUserLastSeen
  } = useOptimizedPresence();

  const handleSendInvitation = async (
    email: string,
    role: string = 'Photographer'
  ) => {
    const result = await sendInvitation(email, role);
    if (result.success) {
      toast({
        title: "Invitation sent",
        description: `An invitation has been sent to ${email}`,
      });
    }
    return result;
  };

  const handleCancelInvitation = async (invitationId: string) => {
    const result = await cancelInvitation(invitationId);
    if (result.success) {
      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled",
      });
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to cancel invitation",
        variant: "destructive"
      });
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (teamLoading && teamMembers.length === 0) {
    return (
      <SettingsPageWrapper>
        <SettingsLoadingSkeleton />
      </SettingsPageWrapper>
    );
  }

  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Team Management"
        description="Invite and manage team members, assign roles and permissions"
        helpContent={settingsHelpContent.team}
      />

      <div className="space-y-8">
        {/* 1. Invite Team Member Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Invite Team Member
            </CardTitle>
            <CardDescription>
              Send invitations to new team members and manage pending invitations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Invitation Form */}
            <InvitationErrorBoundary>
              <EnhancedInvitationForm
                onSendInvitation={handleSendInvitation}
                loading={teamLoading}
                availableRoles={['Photographer', 'Manager', ...customRoles.map(r => r.name)]}
              />
            </InvitationErrorBoundary>

            {/* Pending Invitations */}
            {invitations && invitations.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">Pending Invitations</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{invitation.role}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">Pending</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const inviteUrl = `${window.location.origin}/accept-invite?token=${invitation.id}`;
                                await navigator.clipboard.writeText(inviteUrl);
                                setCopiedStates(prev => ({ ...prev, [invitation.id]: true }));
                                toast({
                                  title: "Link copied!",
                                  description: "Invitation link copied to clipboard",
                                });
                                setTimeout(() => {
                                  setCopiedStates(prev => ({ ...prev, [invitation.id]: false }));
                                }, 2000);
                              }}
                            >
                              <Copy className="h-4 w-4 mr-1" />
                              {copiedStates[invitation.id] ? 'Copied!' : 'Copy Link'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendInvitation(invitation.email, invitation.role)}
                              disabled={teamLoading}
                            >
                              Resend
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to cancel the invitation to {invitation.email}? 
                                    The invitation link will expire immediately and they won't be able to join your team.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep Invitation</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleCancelInvitation(invitation.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Cancel Invitation
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Active Team Members Section */}
        <Card>
          <CardHeader>
            <CardTitle>Active Team Members</CardTitle>
            <CardDescription>
              Manage your team members and their role assignments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teamMembers.length > 0 ? (
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
                  {teamMembers.map((member) => {
                    const isOnline = isUserOnline(member.user_id || '');
                    
                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.profile_photo_url} />
                              <AvatarFallback className="text-xs">
                                {getInitials(member.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {member.full_name || 'Unnamed User'}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {member.system_role === "Owner" ? (
                            <Badge variant="default" className="flex items-center gap-1 w-fit">
                              <Crown className="h-3 w-3" />
                              Owner
                            </Badge>
                          ) : (
                            <Select
                              value={member.custom_role_id || (member.role || 'Photographer')}
                              onValueChange={async (roleValue) => {
                                // Handle both system roles and custom roles
                                if (roleValue === 'Photographer' || roleValue === 'Manager') {
                                  // System role assignment
                                  const { error } = await supabase
                                    .from('organization_members')
                                    .update({ 
                                      role: roleValue,
                                      custom_role_id: null 
                                    })
                                    .eq('id', member.id);
                                  
                                  if (!error) {
                                    toast({
                                      title: "Role updated",
                                      description: `Member role changed to ${roleValue}`,
                                    });
                                  }
                                } else {
                                  // Custom role assignment
                                  await assignRoleToMember(member.id, roleValue);
                                }
                              }}
                            >
                              <SelectTrigger className="w-auto min-w-[120px] h-8 px-3 py-1 text-sm">
                                <SelectValue>
                                  {member.custom_role_id 
                                    ? customRoles.find(r => r.id === member.custom_role_id)?.name 
                                    : (member.role || 'Photographer')
                                  }
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Photographer">
                                  <div className="flex items-center gap-2">
                                    <UserCheck className="h-4 w-4" />
                                    Photographer
                                  </div>
                                </SelectItem>
                                <SelectItem value="Manager">
                                  <div className="flex items-center gap-2">
                                    <Settings className="h-4 w-4" />
                                    Manager
                                  </div>
                                </SelectItem>
                                {customRoles.map(role => (
                                  <SelectItem key={role.id} value={role.id}>
                                    <div className="flex items-center gap-2">
                                      <Shield className="h-4 w-4" />
                                      {role.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isOnline ? (
                              <>
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-sm font-medium text-green-600">Online</span>
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {getUserLastSeen(member.user_id || '')}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {member.system_role !== "Owner" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Remove
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove {member.full_name || 'this member'} from your team? 
                                    They will lose access to all projects and data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => removeMember(member.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Remove Member
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No team members yet. Send some invitations to get started!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Roles and Permissions Section */}
        <Card>
          <CardHeader>
            <CardTitle>Roles & Permissions</CardTitle>
            <CardDescription>
              System roles and custom roles with specific permissions for your team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* System Roles Subsection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">System Roles</h4>
                <Badge variant="outline">Read-only</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {roleTemplates?.map((template) => (
                  <Card key={template.id} className="border-muted">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-primary/10">
                          {template.name === 'Photographer' ? (
                            <UserCheck className="h-4 w-4 text-primary" />
                          ) : (
                            <Settings className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                      </div>
                      <CardDescription className="text-sm">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">PERMISSIONS</p>
                        <div className="flex flex-wrap gap-1">
                          {template.permissions?.slice(0, 4).map((permissionId) => {
                            const permission = permissions.find(p => p.id === permissionId);
                            return permission ? (
                              <Badge 
                                key={permissionId} 
                                variant="secondary" 
                                className="text-xs"
                              >
                                {permission.name}
                              </Badge>
                            ) : null;
                          })}
                          {(template.permissions?.length || 0) > 4 && (
                            <Badge variant="secondary" className="text-xs">
                              +{(template.permissions?.length || 0) - 4} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Custom Roles Subsection */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium">Custom Roles</h4>
                <Button onClick={() => setShowCreateRoleDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Role
                </Button>
              </div>

              {customRoles.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-medium mb-2">No custom roles yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Create custom roles to manage team member permissions more effectively
                    </p>
                    <Button onClick={() => setShowCreateRoleDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Role
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {customRoles.map((role) => {
                    const membersWithRole = memberRoles.filter(member => 
                      member.custom_role_id === role.id
                    );
                    
                    return (
                      <Card key={role.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Shield className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base">{role.name}</CardTitle>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingRole(role);
                                  setShowCreateRoleDialog(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Role</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete the "{role.name}" role? 
                                      Members with this role will lose their assigned permissions.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteCustomRole(role.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete Role
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                          {role.description && (
                            <CardDescription className="text-sm">
                              {role.description}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Users className="h-4 w-4" />
                              {membersWithRole.length} member{membersWithRole.length !== 1 ? 's' : ''}
                            </div>
                            
                            {role.permissions && role.permissions.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">PERMISSIONS</p>
                                <div className="flex flex-wrap gap-1">
                                  {role.permissions.slice(0, 3).map((permission) => (
                                    <Badge 
                                      key={permission.id} 
                                      variant="outline" 
                                      className="text-xs"
                                    >
                                      {permission.name}
                                    </Badge>
                                  ))}
                                  {role.permissions.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{role.permissions.length - 3} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Role Dialog */}
      <StructuredRoleDialog
        open={showCreateRoleDialog}
        onOpenChange={setShowCreateRoleDialog}
        permissions={permissions}
        editingRole={editingRole}
        onSave={async (name: string, description: string, permissionIds: string[]) => {
          if (editingRole) {
            await updateRolePermissions(editingRole.id, permissionIds);
          } else {
            await createCustomRole(name, description, permissionIds);
          }
          setShowCreateRoleDialog(false);
          setEditingRole(null);
        }}
      />
    </SettingsPageWrapper>
  );
}