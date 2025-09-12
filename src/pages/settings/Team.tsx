import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { settingsHelpContent } from "@/lib/settingsHelpContent";
import { CategorySettingsSection } from "@/components/settings/CategorySettingsSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Settings, Crown, UserCheck, Eye, Plus, Edit, Shield, Users, Copy } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTeamManagement } from "@/hooks/useTeamManagement";
import { useRoleManagement } from "@/hooks/useRoleManagement";
import { useToast } from "@/hooks/use-toast";
import { useSettingsCategorySection } from "@/hooks/useSettingsCategorySection";
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
  const [editingRole, setEditingRole] = useState(null);
  
  // Team management section state
  const teamSection = useSettingsCategorySection({
    sectionId: 'team-management',
    sectionName: 'Team Management',
    initialValues: {},
    onSave: async () => {}
  });

  const roleSection = useSettingsCategorySection({
    sectionId: 'roles-permissions',
    sectionName: 'Roles & Permissions',
    initialValues: {},
    onSave: async () => {}
  });

  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Team management hook
  const {
    invitations,
    teamMembers,
    loading: teamLoading,
    sendInvitation,
    removeMember
  } = useTeamManagement();

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

  const { 
    isUserOnline,
    getUserLastSeen
  } = useOptimizedPresence();

  const handleSendInvitation = async (
    email: string,
    role: string = 'Member'
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

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Subscribe to presence when component mounts
  useEffect(() => {
    // Simplified - no subscription needed for this version
  }, []);

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
        <CategorySettingsSection
          {...teamSection}
          title="Team Members"
          description="Invite new team members and manage existing ones. Assign roles to control access."
          sectionId="team-management"
        >
          <div className="space-y-6">
            {/* Invitation Form */}
            <InvitationErrorBoundary>
            <EnhancedInvitationForm
              onSendInvitation={handleSendInvitation}
              loading={teamLoading}
              availableRoles={['Photographer', 'Manager', ...customRoles.map(r => r.name)]}
            />
            </InvitationErrorBoundary>

            {/* Active Team Members */}
            {teamMembers.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Active Team Members</h4>
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
                      const memberRole = customRoles.find(role => role.id === member.custom_role_id);
                      const RoleIcon = Settings;
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
              </div>
            )}

            {/* Pending Invitations */}
            {invitations && invitations.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Pending Invitations</h4>
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
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CategorySettingsSection>

        {/* Role Management Section */}
        <CategorySettingsSection
          {...roleSection}
          title="Roles & Permissions"
          description="Create custom roles and assign specific permissions to team members"
          sectionId="roles-permissions"
        >
          <div className="space-y-6">
            {/* Create Role Button */}
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-sm font-medium">Custom Roles</h4>
                <p className="text-sm text-muted-foreground">
                  Create roles with specific permissions for different team responsibilities
                </p>
              </div>
              <Button onClick={() => setShowCreateRoleDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            </div>

            {/* Custom Roles Grid */}
            {customRoles.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">No custom roles yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create custom roles to give team members specific permissions
                  </p>
                  <Button onClick={() => setShowCreateRoleDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Role
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {customRoles.map((role) => {
                  const membersWithRole = memberRoles.filter(m => m.custom_role_id === role.id);
                  
                  return (
                    <Card key={role.id} className="border-2 hover:border-primary/20 transition-colors">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Shield className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="flex items-center gap-2">
                                {role.name}
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {membersWithRole.length}
                                </Badge>
                              </CardTitle>
                              <CardDescription>
                                {role.description || 'No description provided'}
                              </CardDescription>
                            </div>
                          </div>
                          
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
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
                                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Role</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{role.name}"? 
                                    This will remove the role from {membersWithRole.length} team member(s).
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
                      </CardHeader>
                      
                      <CardContent>
                        <div className="space-y-4">
                          {/* Permissions */}
                          <div>
                            <h4 className="font-medium text-sm mb-2">Permissions ({role.permissions.length})</h4>
                            <div className="flex flex-wrap gap-1">
                              {role.permissions.slice(0, 8).map((permission) => (
                                <Badge key={permission.id} variant="outline" className="text-xs">
                                  {permission.name.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                              {role.permissions.length > 8 && (
                                <Badge variant="outline" className="text-xs">
                                  +{role.permissions.length - 8} more
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Members with this role */}
                          {membersWithRole.length > 0 && (
                            <div>
                              <h4 className="font-medium text-sm mb-2">Team Members</h4>
                              <div className="flex flex-wrap gap-2">
                                {membersWithRole.map((member) => (
                                  <div key={member.id} className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
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
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </CategorySettingsSection>

        {/* Role Creation Dialog */}
        <StructuredRoleDialog
          open={showCreateRoleDialog}
          onOpenChange={(open) => {
            setShowCreateRoleDialog(open);
            if (!open) setEditingRole(null);
          }}
          permissions={permissions}
          editingRole={editingRole}
          onSave={editingRole ? 
            (name, description, permissionIds) => updateRolePermissions(editingRole.id, permissionIds) :
            createCustomRole
          }
          loading={roleLoading}
        />
      </div>
    </SettingsPageWrapper>
  );
}