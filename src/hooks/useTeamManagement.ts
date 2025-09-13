import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface TeamMember {
  id: string;
  user_id: string;
  organization_id: string;
  system_role: string;
  status: string;
  joined_at: string;
  last_active: string | null;
  email?: string;
  full_name?: string;
  profile_photo_url?: string;
  is_online?: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

// Simplified team management for single photographer mode
export function useTeamManagement() {
  const [teamMembers] = useState<TeamMember[]>([]);
  const [invitations] = useState<Invitation[]>([]);
  const [loading] = useState(false);
  const [currentUserRole] = useState<string>('Owner');
  const { toast } = useToast();

  // In single photographer mode, team functionality is disabled
  const sendInvitation = async (email: string, role: string) => {
    toast({
      title: "Not Available",
      description: "Team invitations are not available in single photographer mode",
      variant: "destructive",
    });
    return { success: false, error: 'Team invitations not available' };
  };

  const cancelInvitation = async (invitationId: string) => {
    toast({
      title: "Not Available", 
      description: "Team management is not available in single photographer mode",
      variant: "destructive",
    });
    return { success: false, error: 'Team management not available' };
  };

  const removeMember = async (memberId: string) => {
    toast({
      title: "Not Available",
      description: "Team management is not available in single photographer mode", 
      variant: "destructive",
    });
    return { success: false, error: 'Team management not available' };
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    toast({
      title: "Not Available",
      description: "Role management is not available in single photographer mode",
      variant: "destructive", 
    });
    return { success: false, error: 'Role management not available' };
  };

  const fetchTeamData = async () => {
    // No-op for single photographer mode
  };

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