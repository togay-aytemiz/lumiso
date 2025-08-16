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

      // Fetch team members for current user's organization
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', user.id)
        .order('joined_at');

      if (membersError) {
        console.error('Error fetching members:', membersError);
        throw membersError;
      }

      console.log('Team members data:', membersData);
      setTeamMembers(membersData || []);

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