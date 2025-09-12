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
  const [loading, setLoading] = useState(true);
  const { activeOrganizationId, loading: orgLoading } = useOrganization();

  useEffect(() => {
    // Clear cache when organization changes
    if (activeOrganizationId && activeOrganizationId !== cachedOrgId && cachedOrgId !== null) {
      console.log('Organization changed, clearing permissions cache');
      cachedPermissions = [];
      cachedUserId = null;
      cachedOrgId = null;
      cacheExpiry = 0;
    }

    // Only start loading permissions when organization context is ready
    if (!orgLoading) {
      fetchUserPermissions();
    }
  }, [activeOrganizationId, orgLoading]);

  const fetchUserPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
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

      // Use RPC to safely resolve permissions server-side (bypasses RLS pitfalls)
      const { data, error } = await supabase.rpc('get_user_permissions', {});
      if (error) {
        throw error;
      }

      const userPermissions: string[] = Array.isArray(data) ? (data as string[]) : [];

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

  const refreshPermissions = async () => {
    // Clear cache and re-fetch
    cachedPermissions = [];
    cachedUserId = null;
    cachedOrgId = null;
    cacheExpiry = 0;
    await fetchUserPermissions();
  };

  return {
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    canEditLead,
    canEditProject,
    refetch: fetchUserPermissions,
    refreshPermissions,
    clearCache: () => {
      cachedPermissions = [];
      cachedUserId = null;
      cachedOrgId = null;
      cacheExpiry = 0;
      console.log('Permissions cache manually cleared');
    }
  };
}