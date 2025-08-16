import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TeamMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  joined_at: string;
  last_active: string | null;
  // User profile data
  email?: string;
  full_name?: string;
  profile_photo_url?: string;
  // Online status
  is_online?: boolean;
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

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      console.log('Fetching team data for user:', user.id);

      // First, fetch basic team members data
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', user.id)
        .order('joined_at');

      if (membersError) {
        console.error('Error fetching members:', membersError);
        throw membersError;
      }

      console.log('Basic team members data:', membersData);

      // Try to enrich with profile data
      let enrichedMembers = membersData || [];
      try {
        // Fetch profiles for all users
        const userIds = membersData?.map(m => m.user_id) || [];
        if (userIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, full_name, profile_photo_url')
            .in('user_id', userIds);

          if (!profilesError && profilesData) {
            // Merge profile data with member data
            enrichedMembers = (membersData || []).map(member => {
              const profile = profilesData.find(p => p.user_id === member.user_id);
              return {
                ...member,
                full_name: profile?.full_name,
                profile_photo_url: profile?.profile_photo_url,
                is_online: onlineUsers.has(member.user_id)
              };
            });
          }
        }

        // Try to get user emails via edge function (optional)
        try {
          const { data: usersEmailData, error: emailError } = await supabase.functions.invoke('get-users-email', {
            body: { userIds: userIds }
          });

          if (!emailError && usersEmailData?.users) {
            enrichedMembers = enrichedMembers.map(member => {
              const userEmail = usersEmailData.users.find((u: any) => u.id === member.user_id)?.email;
              return {
                ...member,
                email: userEmail
              };
            });
          }
        } catch (emailError) {
          console.warn('Could not fetch user emails:', emailError);
          // Continue without emails - not critical
        }
      } catch (profileError) {
        console.warn('Could not fetch profile data:', profileError);
        // Continue with basic member data
      }

      console.log('Final team members data:', enrichedMembers);
      setTeamMembers(enrichedMembers);

      // Set current user role - they should be the organization owner
      setCurrentUserRole('Owner');

      // Fetch pending invitations
      const { data: invitesData, error: invitesError } = await supabase
        .from('invitations')
        .select('*')
        .eq('organization_id', user.id)
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
      const { error } = await supabase
        .from('organization_members')
        .update({ role: newRole })
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

  // Set up real-time presence tracking
  useEffect(() => {
    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase.channel(`org_${user.id}_presence`, {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      // Track presence events
      channel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const online = new Set<string>();
          
          Object.values(presenceState).forEach((users: any) => {
            users.forEach((user: any) => {
              online.add(user.user_id);
            });
          });
          
          setOnlineUsers(online);
          
          // Update team members with online status
          setTeamMembers(prev => prev.map(member => ({
            ...member,
            is_online: online.has(member.user_id)
          })));
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          console.log('User joined:', newPresences);
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          console.log('User left:', leftPresences);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            // Track current user's presence
            await channel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
          }
        });

      // Update last_active timestamp periodically
      const interval = setInterval(async () => {
        await supabase
          .from('organization_members')
          .update({ last_active: new Date().toISOString() })
          .eq('user_id', user.id);
      }, 30000); // Update every 30 seconds

      return () => {
        channel.unsubscribe();
        clearInterval(interval);
      };
    };

    const cleanup = setupPresence();
    return () => {
      cleanup.then(fn => fn && fn());
    };
  }, []);

  useEffect(() => {
    fetchTeamData();
  }, [onlineUsers]);

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