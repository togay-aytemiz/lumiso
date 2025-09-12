import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationTimezone } from "@/hooks/useOrganizationTimezone";
import { sendAssignmentNotification, getCurrentUserAndOrg } from "@/lib/notificationUtils";

interface TeamMember {
  id: string;
  user_id: string;
  organization_id: string;
  system_role: string;
  custom_role_id?: string;
  status: string;
  joined_at: string;
  last_active: string | null;
  // User profile data
  email?: string;
  full_name?: string;
  profile_photo_url?: string;
  // Online status
  is_online?: boolean;
  // Flag to indicate if the name was generated vs from actual profile
  is_generated_name?: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

export function useTeamManagement() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { formatDateTime, toOrgTimezone } = useOrganizationTimezone();

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      console.log('Fetching team data for user:', user.id);

      // First, get the user's active organization
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userSettings?.active_organization_id) {
        console.warn('No active organization found for user');
        setLoading(false);
        return;
      }

      const organizationId = userSettings.active_organization_id;

      // Fetch team members data for the active organization
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .order('joined_at');

      if (membersError) {
        console.error('Error fetching members:', membersError);
        throw membersError;
      }

      console.log('Basic team members data:', membersData);

      // Always enrich with profile data - create profiles if they don't exist
      let enrichedMembers = membersData || [];
      
      if (enrichedMembers.length > 0) {
        const userIds = enrichedMembers.map(m => m.user_id);
        console.log('Fetching profiles for user IDs:', userIds);

        // Fetch existing profiles
        const { data: existingProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, profile_photo_url')
          .in('user_id', userIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        }

        console.log('Existing profiles:', existingProfiles);

        // Create a map of existing profiles for faster lookup
        const profileMap = new Map(
          (existingProfiles || []).map(profile => [profile.user_id, profile])
        );

        // Try to get user emails via edge function
        let emailMap = new Map();
        try {
          const { data: usersEmailData, error: emailError } = await supabase.functions.invoke('get-users-email', {
            body: { userIds: userIds }
          });

          if (!emailError && usersEmailData?.users) {
            emailMap = new Map(
              usersEmailData.users.map((u: any) => [u.id, u.email])
            );
            console.log('Email data fetched:', usersEmailData.users);
          } else {
            console.warn('Could not fetch user emails:', emailError);
          }
        } catch (emailError) {
          console.warn('Could not fetch user emails:', emailError);
        }

        // Enrich members with profile and email data
        enrichedMembers = enrichedMembers.map(member => {
          const profile = profileMap.get(member.user_id);
          const email = emailMap.get(member.user_id);
          
          // Create a display name with fallbacks
          let displayName = profile?.full_name;
          if (!displayName && email) {
            // Use email username as fallback
            displayName = email.split('@')[0];
          }
          if (!displayName) {
            displayName = `User ${member.user_id.slice(0, 8)}`;
          }

          return {
            ...member,
            full_name: displayName,
            profile_photo_url: profile?.profile_photo_url,
            email: email,
            is_online: onlineUsers.has(member.user_id),
            // Flag to indicate if this is a generated name vs actual profile name
            is_generated_name: !profile?.full_name,
            // Timezone-formatted dates
            formatted_joined_at: formatDateTime(member.joined_at),
            formatted_last_active: member.last_active ? formatDateTime(member.last_active) : null
          };
        });
      }

      console.log('Final enriched team members:', enrichedMembers);
      setTeamMembers(enrichedMembers);

      // Set current user role from their membership in the active organization
      const currentUserMember = enrichedMembers.find(member => member.user_id === user.id);
      setCurrentUserRole(currentUserMember?.system_role || null);

      // Fetch pending invitations for the active organization
      const { data: invitesData, error: invitesError } = await supabase
        .from('invitations')
        .select('*')
        .eq('organization_id', organizationId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (invitesError) {
        console.error('Error fetching invitations:', invitesError);
        throw invitesError;
      }

      console.log('Invitations data:', invitesData);
      setInvitations(invitesData || []);
    } catch (error) {
      console.error('Error fetching team data:', error);
      toast({
        title: "Error",
        description: "Failed to load team data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendInvitation = async (email: string, role: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) throw new Error("No session found");

      console.log('Sending invitation to:', email);

      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: { email: email.trim(), role },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        // Extract the specific error message from the response
        const errorMessage = data?.error || error.message || "Failed to send invitation";
        throw new Error(errorMessage);
      }

      console.log('Invitation response:', data);

      // Send assignment notification for team invitation
      const { userId, orgId } = await getCurrentUserAndOrg();
      if (userId && orgId) {
        await sendAssignmentNotification({
          type: 'project', // Generic type for team management
          entity_id: 'team-invitation',
          entity_name: `Team invitation sent to ${email}`,
          assignee_ids: [userId], // Notify the person who sent the invitation
          assigned_by_id: userId,
          organization_id: orgId,
          action: 'assigned'
        });
      }

      toast({
        title: "Success",
        description: `Invitation sent to ${email}`,
      });

      // Refresh data
      await fetchTeamData();

      return { success: true, data };
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      
      // Handle specific error messages
      let errorMessage = "Failed to send invitation";
      if (error.message) {
        if (error.message.includes("already exists") || error.message.includes("pending invitation")) {
          errorMessage = "This user already exists in your organization or has a pending invitation";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error };
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invitation cancelled",
      });

      await fetchTeamData();
      return { success: true };
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast({
        title: "Error",
        description: "Failed to cancel invitation",
        variant: "destructive",
      });
      return { success: false, error };
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Member removed from team",
      });

      await fetchTeamData();
      return { success: true };
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
      return { success: false, error };
    }
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    try {
      // Use organization timezone for last_active update
      const currentTime = toOrgTimezone(new Date());
      
      // Enhanced role assignment logic - clear conflicting fields
      const updateData: any = {
        last_active: currentTime.toISOString()
      };

      // If assigning a system role, clear custom_role_id
      if (newRole === 'Owner' || newRole === 'Member') {
        updateData.system_role = newRole as 'Owner' | 'Member';
        updateData.custom_role_id = null; // Clear custom role
      } else {
        // If assigning a custom role, set custom_role_id and default system role
        updateData.custom_role_id = newRole;
        updateData.system_role = 'Member'; // Default system role
      }
      
      const { error } = await supabase
        .from('organization_members')
        .update(updateData)
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Member role updated",
      });

      await fetchTeamData();
      return { success: true };
    } catch (error) {
      console.error('Error updating member role:', error);
      toast({
        title: "Error",
        description: "Failed to update member role",
        variant: "destructive",
      });
      return { success: false, error };
    }
  };

  // Set up real-time presence tracking for team page
  useEffect(() => {
    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get the user's active organization for org-scoped presence
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userSettings?.active_organization_id) return;

      const channelName = `organization_${userSettings.active_organization_id}_presence`;
      const channel = supabase.channel(channelName);

      // Track presence events for team page
      channel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const online = new Set<string>();
          
          Object.values(presenceState).forEach((users: any) => {
            users.forEach((userPresence: any) => {
              if (userPresence.user_id) {
                online.add(userPresence.user_id);
              }
            });
          });
          
          console.log('Online users on team page:', Array.from(online));
          setOnlineUsers(online);
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          console.log('User joined team page:', newPresences);
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          console.log('User left team page:', leftPresences);
        })
        .subscribe();

      return () => {
        console.log('Cleaning up team page presence channel');
        channel.unsubscribe();
      };
    };

    const cleanup = setupPresence();
    return () => {
      cleanup.then(fn => fn && fn());
    };
  }, []);

  // Refresh team data when online users change
  useEffect(() => {
    if (onlineUsers.size > 0) {
      // Update existing team members with online status
      setTeamMembers(prev => prev.map(member => ({
        ...member,
        is_online: onlineUsers.has(member.user_id)
      })));
    }
  }, [onlineUsers]);

  useEffect(() => {
    fetchTeamData();
  }, []);

  return {
    teamMembers,
    invitations,
    loading,
    currentUserRole,
    sendInvitation,
    cancelInvitation,
    removeMember,
    updateMemberRole,
    refetch: fetchTeamData
  };
}