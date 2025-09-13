import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

// Cache for permissions to prevent re-fetching
let cachedPermissions: string[] = [];
let cachedUserId: string | null = null;
let cachedOrgId: string | null = null;
let cacheExpiry: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>(cachedPermissions);
  const [loading, setLoading] = useState(cachedPermissions.length === 0);
  const { activeOrganizationId } = useOrganization();

  useEffect(() => {
    fetchUserPermissions();
  }, [activeOrganizationId]);

  const fetchUserPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !activeOrganizationId) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      // Check cache first
      if (
        cachedPermissions.length > 0 &&
        cachedUserId === user.id &&
        cachedOrgId === activeOrganizationId &&
        Date.now() < cacheExpiry
      ) {
        setPermissions(cachedPermissions);
        setLoading(false);
        return;
      }

      // Get user's organization membership - simplified query
      const { data: membership } = await supabase
        .from('organization_members')
        .select('system_role, custom_role_id')
        .eq('user_id', user.id)
        .eq('organization_id', activeOrganizationId)
        .eq('status', 'active')
        .single();

      let userPermissions: string[] = [];

      // If user is Owner, they have all permissions
      if (membership?.system_role === 'Owner') {
        const { data: allPermissions } = await supabase
          .from('permissions')
          .select('name');
        
        userPermissions = allPermissions?.map(p => p.name) || [];
      } else if (membership?.custom_role_id) {
        // Get permissions from custom role
        const { data: rolePermissions } = await supabase
          .from('role_permissions')
          .select(`
            permissions!inner(name)
          `)
          .eq('role_id', membership.custom_role_id);

        userPermissions = rolePermissions?.map(rp => rp.permissions.name) || [];
      }

      // Update cache
      cachedPermissions = userPermissions;
      cachedUserId = user.id;
      cachedOrgId = activeOrganizationId;
      cacheExpiry = Date.now() + CACHE_DURATION;

      setPermissions(userPermissions);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (permissionList: string[]): boolean => {
    return permissionList.some(permission => permissions.includes(permission));
  };

  const canEditLead = async (leadUserId: string, leadAssignees?: string[]): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id;
    
    if (!currentUserId) return false;
    
    // Can edit if has manage_all_leads permission
    if (hasPermission('manage_all_leads')) return true;
    
    // Can edit if has edit_assigned_leads permission AND is assigned to the lead
    if (hasPermission('edit_assigned_leads')) {
      return leadUserId === currentUserId || leadAssignees?.includes(currentUserId);
    }
    
    return false;
  };

  const canEditProject = async (projectUserId: string, projectAssignees?: string[]): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id;
    
    if (!currentUserId) return false;
    
    // Can edit if has manage_all_projects permission
    if (hasPermission('manage_all_projects')) return true;
    
    // Can edit if has edit_assigned_projects permission AND is assigned to the project
    if (hasPermission('edit_assigned_projects')) {
      return projectUserId === currentUserId || projectAssignees?.includes(currentUserId);
    }
    
    return false;
  };

  return {
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    canEditLead,
    canEditProject,
    refetch: fetchUserPermissions,
    clearCache: () => {
      cachedPermissions = [];
      cachedUserId = null;
      cachedOrgId = null;
      cacheExpiry = 0;
    }
  };
}