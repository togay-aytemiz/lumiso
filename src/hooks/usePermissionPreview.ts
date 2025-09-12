import { useState, useMemo, useCallback } from 'react';
import { useRoleManagement, type Permission } from '@/hooks/useRoleManagement';

interface PermissionPreview {
  category: string;
  permissions: Permission[];
  enabled: boolean;
  description: string;
}

export function usePermissionPreview() {
  const { permissions } = useRoleManagement();
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const previewData = useMemo((): PermissionPreview[] => {
    const categorized = permissions.reduce((acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push(permission);
      return acc;
    }, {} as Record<string, Permission[]>);

    return Object.entries(categorized).map(([category, perms]) => {
      const enabledPerms = perms.filter(p => selectedPermissions.includes(p.id));
      const enabled = enabledPerms.length > 0;
      
      let description = '';
      if (enabledPerms.length === 0) {
        description = 'No access';
      } else if (enabledPerms.length === perms.length) {
        description = 'Full access';
      } else {
        description = `${enabledPerms.length} of ${perms.length} permissions`;
      }

      return {
        category,
        permissions: perms,
        enabled,
        description
      };
    });
  }, [permissions, selectedPermissions]);

  const updatePermissions = useCallback((permissionIds: string[]) => {
    setSelectedPermissions(permissionIds);
  }, []);

  const togglePermission = useCallback((permissionId: string) => {
    setSelectedPermissions(prev => {
      if (prev.includes(permissionId)) {
        return prev.filter(id => id !== permissionId);
      } else {
        return [...prev, permissionId];
      }
    });
  }, []);

  const toggleCategory = useCallback((category: string) => {
    const categoryPermissions = permissions
      .filter(p => p.category === category)
      .map(p => p.id);
    
    const allCategoryEnabled = categoryPermissions.every(id => 
      selectedPermissions.includes(id)
    );

    if (allCategoryEnabled) {
      // Remove all category permissions
      setSelectedPermissions(prev => 
        prev.filter(id => !categoryPermissions.includes(id))
      );
    } else {
      // Add all category permissions
      setSelectedPermissions(prev => {
        const newIds = categoryPermissions.filter(id => !prev.includes(id));
        return [...prev, ...newIds];
      });
    }
  }, [permissions, selectedPermissions]);

  const getPermissionSummary = useCallback(() => {
    const total = permissions.length;
    const selected = selectedPermissions.length;
    
    if (selected === 0) return 'No permissions selected';
    if (selected === total) return 'All permissions selected';
    return `${selected} of ${total} permissions selected`;
  }, [permissions.length, selectedPermissions.length]);

  const getAccessLevel = useCallback(() => {
    const total = permissions.length;
    const selected = selectedPermissions.length;
    
    if (selected === 0) return 'no-access';
    if (selected === total) return 'full-access';
    if (selected / total > 0.7) return 'high-access';
    if (selected / total > 0.3) return 'medium-access';
    return 'low-access';
  }, [permissions.length, selectedPermissions.length]);

  return {
    previewData,
    selectedPermissions,
    updatePermissions,
    togglePermission,
    toggleCategory,
    getPermissionSummary,
    getAccessLevel
  };
}