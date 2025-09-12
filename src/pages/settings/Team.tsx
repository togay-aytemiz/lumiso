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
import { Trash2, Settings, Crown, UserCheck, Eye } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTeamManagement } from "@/hooks/useTeamManagement";
import { useRoleTemplates } from "@/hooks/useRoleTemplates";
import { useToast } from "@/hooks/use-toast";
import { useSettingsCategorySection } from "@/hooks/useSettingsCategorySection";
import { formatDistanceToNow } from "date-fns";
import { SettingsLoadingSkeleton } from "@/components/ui/loading-presets";
import { InvitationErrorBoundary } from "@/components/team/InvitationErrorBoundary";
import { EnhancedInvitationForm } from "@/components/team/EnhancedInvitationForm";
import { useOptimizedPresence } from "@/hooks/useOptimizedPresence";

export default function Team() {
  const [copiedStates, setCopiedStates] = useState<{
    [key: string]: boolean;
  }>({});
  
  const teamSection = {}; // Simplified - no complex section management needed

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
    customRoles,
    assignRoleToMember,
    loading: roleLoading
  } = useRoleTemplates();

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

  const formatLastActive = (lastActive?: string | null) => {
    if (!lastActive) return "Never";
    return formatDistanceToNow(new Date(lastActive), { addSuffix: true });
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleIcon = (templateName?: string) => {
    if (!templateName) return Settings;
    switch (templateName.toLowerCase()) {
      case 'full admin':
        return Crown;
      case 'project manager':
        return Settings;
      case 'team member':
        return UserCheck;
      case 'viewer':
        return Eye;
      default:
        return Settings;
    }
  };

  const getRoleBadgeVariant = (templateName?: string) => {
    if (!templateName) return 'secondary';
    switch (templateName.toLowerCase()) {
      case 'full admin':
        return 'default';
      case 'project manager':
        return 'default';
      case 'team member':
        return 'secondary';
      case 'viewer':
        return 'outline';
      default:
        return 'secondary';
    }
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
              availableRoles={['Member']}
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
                      <TableHead>System Role</TableHead>
                      <TableHead>Custom Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member) => {
                      const memberRole = customRoles.find(role => role.id === member.custom_role_id);
                      const RoleIcon = getRoleIcon(memberRole?.template?.name);
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
                            <Badge variant={member.system_role === 'Owner' ? 'default' : 'secondary'}>
                              {member.system_role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {member.system_role === "Owner" ? (
                              <Badge variant="default" className="flex items-center gap-1 w-fit">
                                <Crown className="h-3 w-3" />
                                Owner
                              </Badge>
                            ) : (
                              <Select
                                value={member.custom_role_id || ''}
                                onValueChange={async (value) => {
                                  if (value !== member.custom_role_id) {
                                    await assignRoleToMember(member.id, value);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-auto min-w-[120px] h-8 px-3 py-1 text-sm">
                                  <SelectValue placeholder="No role assigned" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">No role assigned</SelectItem>
                                  {customRoles.map(role => {
                                    const RoleIcon = getRoleIcon(role.template?.name);
                                    return (
                                      <SelectItem key={role.id} value={role.id}>
                                        <div className="flex items-center gap-2">
                                          <RoleIcon className="h-4 w-4" />
                                          {role.name}
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendInvitation(invitation.email, invitation.role)}
                            disabled={teamLoading}
                          >
                            Resend
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CategorySettingsSection>
      </div>
    </SettingsPageWrapper>
  );
}