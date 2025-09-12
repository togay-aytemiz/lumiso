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
import { Trash2, Settings, Crown, UserCheck, Copy, X, Users } from "lucide-react";
import { useTeamManagement } from "@/hooks/useTeamManagement";
import { useRoleManagement } from "@/hooks/useRoleManagement";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { SettingsLoadingSkeleton } from "@/components/ui/loading-presets";
import { InvitationErrorBoundary } from "@/components/team/InvitationErrorBoundary";
import { EnhancedInvitationForm } from "@/components/team/EnhancedInvitationForm";
import { RolesTableView } from "@/components/team/RolesTableView";
import { useOptimizedPresence } from "@/hooks/useOptimizedPresence";

export default function Team() {
  const [copiedStates, setCopiedStates] = useState<{
    [key: string]: boolean;
  }>({});

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
    updateSystemRolePermissions,
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
        description: typeof result.error === 'string' ? result.error : "Failed to cancel invitation",
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
            <CardTitle>
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
                availableRoles={[...roleTemplates.map(t => t.name), ...customRoles.map(r => r.name)]}
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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {invitation.role}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
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
                                try {
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
                                    } else {
                                      throw error;
                                    }
                                  } else {
                                    // Custom role assignment
                                    await assignRoleToMember(member.id, roleValue);
                                  }
                                } catch (error) {
                                  console.error('Error updating role:', error);
                                  toast({
                                    title: "Error",
                                    description: "Failed to update member role. Please try again.",
                                    variant: "destructive"
                                  });
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
                                  Photographer
                                </SelectItem>
                                <SelectItem value="Manager">
                                  Manager
                                </SelectItem>
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
        <RolesTableView
          roleTemplates={roleTemplates}
          customRoles={customRoles}
          memberRoles={memberRoles}
          permissions={permissions}
          onCreateRole={createCustomRole}
          onUpdateRole={async (roleId: string, name: string, description: string, permissionIds: string[]) => {
            // Update role details and permissions
            await supabase
              .from('custom_roles')
              .update({ name, description })
              .eq('id', roleId);
            await updateRolePermissions(roleId, permissionIds);
          }}
          onUpdateSystemRole={updateSystemRolePermissions}
          onDeleteRole={deleteCustomRole}
          loading={roleLoading}
        />
      </div>
    </SettingsPageWrapper>
  );
}