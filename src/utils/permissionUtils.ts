/**
 * Permission validation utilities for the photography CRM system
 */

export const AUTOMATION_PERMISSIONS = [
  'view_workflows',
  'create_workflows', 
  'edit_workflows',
  'delete_workflows',
  'manage_templates'
] as const;

export const LEAD_PERMISSIONS = [
  'view_assigned_leads',
  'manage_all_leads',
  'create_leads',
  'edit_assigned_leads', 
  'delete_leads'
] as const;

export const PROJECT_PERMISSIONS = [
  'view_assigned_projects',
  'manage_all_projects',
  'create_projects',
  'edit_assigned_projects',
  'delete_projects'
] as const;

export const SETTINGS_PERMISSIONS = [
  'view_lead_statuses',
  'manage_lead_statuses',
  'view_project_statuses', 
  'manage_project_statuses',
  'view_project_types',
  'manage_project_types',
  'view_session_statuses',
  'manage_session_statuses',
  'view_services',
  'manage_services',
  'view_packages',
  'manage_packages'
] as const;

export const ADMIN_PERMISSIONS = [
  'manage_team',
  'manage_roles',
  'manage_billing',
  'manage_integrations',
  'manage_contracts', 
  'manage_client_messaging',
  'admin'
] as const;

export type Permission = 
  | typeof AUTOMATION_PERMISSIONS[number]
  | typeof LEAD_PERMISSIONS[number] 
  | typeof PROJECT_PERMISSIONS[number]
  | typeof SETTINGS_PERMISSIONS[number]
  | typeof ADMIN_PERMISSIONS[number];

/**
 * Check if a permission is related to automation features
 */
export function isAutomationPermission(permission: string): boolean {
  return AUTOMATION_PERMISSIONS.includes(permission as typeof AUTOMATION_PERMISSIONS[number]);
}

/**
 * Check if a permission is related to lead management
 */
export function isLeadPermission(permission: string): boolean {
  return LEAD_PERMISSIONS.includes(permission as typeof LEAD_PERMISSIONS[number]);
}

/**
 * Check if a permission is related to project management  
 */
export function isProjectPermission(permission: string): boolean {
  return PROJECT_PERMISSIONS.includes(permission as typeof PROJECT_PERMISSIONS[number]);
}

/**
 * Check if a permission is admin-level
 */
export function isAdminPermission(permission: string): boolean {
  return ADMIN_PERMISSIONS.includes(permission as typeof ADMIN_PERMISSIONS[number]);
}

/**
 * Get all permissions in a category
 */
export function getPermissionsByCategory() {
  return {
    automation: [...AUTOMATION_PERMISSIONS],
    leads: [...LEAD_PERMISSIONS],
    projects: [...PROJECT_PERMISSIONS], 
    settings: [...SETTINGS_PERMISSIONS],
    admin: [...ADMIN_PERMISSIONS]
  };
}

/**
 * Check if a user can perform an action based on entity ownership and assignment
 */
export function canPerformAction(
  userPermissions: string[],
  action: 'view' | 'edit' | 'delete',
  entityType: 'lead' | 'project',
  entityData: {
    userId?: string;
    assignees?: string[];
  },
  currentUserId: string
): boolean {
  const { userId: entityUserId, assignees = [] } = entityData;
  
  // Check if user has global permission for this action and entity type
  const globalPermission = `manage_all_${entityType}s`;
  if (userPermissions.includes(globalPermission)) {
    return true;
  }
  
  // Check if user has permission for assigned entities
  const assignedPermission = action === 'view' 
    ? `view_assigned_${entityType}s`
    : `${action}_assigned_${entityType}s`;
    
  if (userPermissions.includes(assignedPermission)) {
    // Check if user is assigned to this entity or created it
    const isAssigned = assignees.includes(currentUserId) || entityUserId === currentUserId;
    return isAssigned;
  }
  
  return false;
}

/**
 * Validate permission string format
 */
export function isValidPermission(permission: string): permission is Permission {
  const allPermissions = [
    ...AUTOMATION_PERMISSIONS,
    ...LEAD_PERMISSIONS,
    ...PROJECT_PERMISSIONS, 
    ...SETTINGS_PERMISSIONS,
    ...ADMIN_PERMISSIONS
  ];
  
  return allPermissions.includes(permission as Permission);
}