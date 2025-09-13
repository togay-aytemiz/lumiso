import { useState } from 'react';
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";

// Simplified interfaces for single-photographer mode
export interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  sort_order: number;
  permissions: Permission[];
}

export interface MemberRole {
  id: string;
  user_id: string;
  role: string;
  system_role: 'Owner' | 'Member';
  custom_role_id?: string;
  full_name?: string;
  email?: string;
  profile_photo_url?: string;
}

// For single-photographer mode, simplified role management
export const useRoleManagement = () => {
  const { activeOrganizationId } = useOrganization();
  
  // Static permissions for single-photographer mode
  const [permissions] = useState<Permission[]>([
    { id: '1', name: 'manage_leads', description: 'Manage leads', category: 'Leads' },
    { id: '2', name: 'view_leads', description: 'View leads', category: 'Leads' },
    { id: '3', name: 'manage_projects', description: 'Manage projects', category: 'Projects' },
    { id: '4', name: 'view_projects', description: 'View projects', category: 'Projects' },
    { id: '5', name: 'manage_sessions', description: 'Manage sessions', category: 'Sessions' },
    { id: '6', name: 'view_sessions', description: 'View sessions', category: 'Sessions' },
  ]);
  
  // In single-photographer mode, there's only the owner
  const [customRoles] = useState<CustomRole[]>([]);
  const [memberRoles] = useState<MemberRole[]>([]);
  const [loading] = useState(false);

  // Simplified functions for single-photographer mode
  const createCustomRole = async (name: string, description: string, permissionIds: string[]) => {
    toast.error('Custom roles are not available in single-photographer mode');
    return null;
  };

  const updateRolePermissions = async (roleId: string, permissionIds: string[]) => {
    toast.error('Role permissions cannot be modified in single-photographer mode');
  };

  const assignRoleToMember = async (memberId: string, customRoleId: string) => {
    toast.error('Role assignment is not available in single-photographer mode');
  };

  const deleteCustomRole = async (roleId: string) => {
    toast.error('Role deletion is not available in single-photographer mode');
  };

  return {
    permissions,
    customRoles,
    memberRoles,
    loading,
    createCustomRole,
    updateRolePermissions,
    assignRoleToMember,
    deleteCustomRole,
    refetch: () => {
      // No-op for single-photographer mode
    }
  };
};