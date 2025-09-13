import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Simplified permissions hook - single user organization has all permissions
export function usePermissions() {
  const [permissions] = useState<string[]>([]);
  const [loading] = useState(false);

  // In single-user mode, all permissions are granted
  const hasPermission = (permission: string): boolean => {
    return true; // Always allow in single-user mode
  };

  const hasAnyPermission = (permissionList: string[]): boolean => {
    return true; // Always allow in single-user mode
  };

  const canEditLead = async (leadUserId: string, leadAssignees?: string[]): Promise<boolean> => {
    return true; // Always allow in single-user mode
  };

  const canEditProject = async (projectUserId: string, projectAssignees?: string[]): Promise<boolean> => {
    return true; // Always allow in single-user mode
  };

  return {
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    canEditLead,
    canEditProject,
    refetch: () => {},
    clearCache: () => {}
  };
}