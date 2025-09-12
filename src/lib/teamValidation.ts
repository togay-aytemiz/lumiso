import { supabase } from "@/integrations/supabase/client";
import { useOrganizationTimezone } from "@/hooks/useOrganizationTimezone";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class TeamValidationService {
  private organizationId: string | null = null;

  constructor(organizationId: string | null = null) {
    this.organizationId = organizationId;
  }

  // Validate team member permissions and assignments
  async validateTeamMemberAccess(userId: string, entityType: 'leads' | 'projects', entityId: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: false,
      errors: [],
      warnings: []
    };

    try {
      // Check if user exists and is active in organization
      const { data: member, error: memberError } = await supabase
        .from('organization_members')
        .select(`
          id,
          user_id,
          system_role,
          status,
          custom_role_id,
          custom_roles (
            role_permissions (
              permissions (name)
            )
          )
        `)
        .eq('organization_id', this.organizationId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (memberError || !member) {
        result.errors.push('User is not an active member of the organization');
        return result;
      }

      // Get user permissions
      let userPermissions: string[] = [];
      if (member.system_role === 'Owner') {
        // Owner has all permissions
        userPermissions = ['*']; 
      } else if (member.custom_roles) {
        userPermissions = member.custom_roles.role_permissions
          ?.map((rp: any) => rp.permissions.name) || [];
      }

      // Check entity exists and user has access
      const { data: entity, error: entityError } = await supabase
        .from(entityType)
        .select('id, assignees, user_id, organization_id')
        .eq('id', entityId)
        .single();

      if (entityError || !entity) {
        result.errors.push(`${entityType.slice(0, -1)} not found`);
        return result;
      }

      if (entity.organization_id !== this.organizationId) {
        result.errors.push('Entity does not belong to user\'s organization');
        return result;
      }

      // Check permissions
      const hasManageAllPermission = userPermissions.includes(`manage_all_${entityType}`) || userPermissions.includes('*');
      const hasViewAssignedPermission = userPermissions.includes(`view_assigned_${entityType}`) || userPermissions.includes('*');
      const hasEditAssignedPermission = userPermissions.includes(`edit_assigned_${entityType}`) || userPermissions.includes('*');
      
      const isAssigned = entity.assignees?.includes(userId) || entity.user_id === userId;

      if (hasManageAllPermission) {
        result.isValid = true;
      } else if (isAssigned && (hasViewAssignedPermission || hasEditAssignedPermission)) {
        result.isValid = true;
      } else {
        result.errors.push('Insufficient permissions to access this entity');
      }

      // Add warnings for potential issues
      if (!isAssigned && !hasManageAllPermission) {
        result.warnings.push('User is not assigned to this entity');
      }

      if (userPermissions.length === 0 && member.system_role !== 'Owner') {
        result.warnings.push('User has no explicit permissions assigned');
      }

    } catch (error) {
      console.error('Validation error:', error);
      result.errors.push('Validation service error');
    }

    return result;
  }

  // Validate team data consistency
  async validateTeamDataIntegrity(): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!this.organizationId) {
      result.isValid = false;
      result.errors.push('No organization ID provided');
      return result;
    }

    try {
      // Check for orphaned organization members
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, custom_role_id')
        .eq('organization_id', this.organizationId)
        .eq('status', 'active');

      const userIds = members?.map(m => m.user_id) || [];

      // Check for members with invalid custom roles
      const customRoleIds = members?.filter(m => m.custom_role_id).map(m => m.custom_role_id) || [];
      
      if (customRoleIds.length > 0) {
        const { data: validRoles } = await supabase
          .from('custom_roles')
          .select('id')
          .eq('organization_id', this.organizationId)
          .in('id', customRoleIds);

        const validRoleIds = validRoles?.map(r => r.id) || [];
        const invalidRoleAssignments = customRoleIds.filter(roleId => !validRoleIds.includes(roleId));

        if (invalidRoleAssignments.length > 0) {
          result.warnings.push(`${invalidRoleAssignments.length} members have invalid role assignments`);
        }
      }

      // Check for expired invitations
      const { data: expiredInvites } = await supabase
        .from('invitations')
        .select('id')
        .eq('organization_id', this.organizationId)
        .is('accepted_at', null)
        .lt('expires_at', new Date().toISOString());

      if (expiredInvites && expiredInvites.length > 0) {
        result.warnings.push(`${expiredInvites.length} expired invitations should be cleaned up`);
      }

      // Check organization settings
      const { data: orgSettings } = await supabase
        .from('organization_settings')
        .select('timezone, date_format, time_format')
        .eq('organization_id', this.organizationId)
        .maybeSingle();

      if (!orgSettings) {
        result.warnings.push('Organization settings are missing');
      } else {
        if (!orgSettings.timezone) {
          result.warnings.push('Organization timezone is not set');
        }
        if (!orgSettings.date_format) {
          result.warnings.push('Organization date format is not set');
        }
      }

      // Check for duplicate team member entries
      const userIdCounts = userIds.reduce((acc, userId) => {
        acc[userId] = (acc[userId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const duplicateUsers = Object.entries(userIdCounts).filter(([_, count]) => count > 1);
      if (duplicateUsers.length > 0) {
        result.errors.push(`Duplicate team member entries found for ${duplicateUsers.length} users`);
        result.isValid = false;
      }

    } catch (error) {
      console.error('Data integrity validation error:', error);
      result.errors.push('Failed to validate team data integrity');
      result.isValid = false;
    }

    return result;
  }

  // Validate timezone-aware operations
  async validateTimezoneOperations(): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Get organization timezone settings
      const { data: orgSettings } = await supabase
        .from('organization_settings')
        .select('timezone, date_format, time_format')
        .eq('organization_id', this.organizationId)
        .maybeSingle();

      if (!orgSettings) {
        result.warnings.push('No organization settings found');
        return result;
      }

      // Validate timezone format
      if (orgSettings.timezone) {
        try {
          const testDate = new Date();
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: orgSettings.timezone
          });
          formatter.format(testDate);
        } catch (timezoneError) {
          result.errors.push(`Invalid timezone: ${orgSettings.timezone}`);
          result.isValid = false;
        }
      }

      // Validate date format
      const validDateFormats = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
      if (orgSettings.date_format && !validDateFormats.includes(orgSettings.date_format)) {
        result.warnings.push(`Non-standard date format: ${orgSettings.date_format}`);
      }

      // Validate time format
      const validTimeFormats = ['12-hour', '24-hour'];
      if (orgSettings.time_format && !validTimeFormats.includes(orgSettings.time_format)) {
        result.warnings.push(`Invalid time format: ${orgSettings.time_format}`);
      }

      // Check for recent activity timestamps that might be timezone-affected
      const { data: recentActivities } = await supabase
        .from('organization_members')
        .select('last_active')
        .eq('organization_id', this.organizationId)
        .not('last_active', 'is', null)
        .order('last_active', { ascending: false })
        .limit(5);

      if (recentActivities && recentActivities.length > 0) {
        recentActivities.forEach((activity, index) => {
          try {
            const date = new Date(activity.last_active);
            if (isNaN(date.getTime())) {
              result.warnings.push(`Invalid timestamp found in recent activity ${index + 1}`);
            }
          } catch (dateError) {
            result.warnings.push(`Cannot parse timestamp in recent activity ${index + 1}`);
          }
        });
      }

    } catch (error) {
      console.error('Timezone validation error:', error);
      result.errors.push('Failed to validate timezone operations');
      result.isValid = false;
    }

    return result;
  }

  // Comprehensive validation method
  async validateAll(): Promise<ValidationResult> {
    const results = await Promise.all([
      this.validateTeamDataIntegrity(),
      this.validateTimezoneOperations()
    ]);

    const combinedResult: ValidationResult = {
      isValid: results.every(r => r.isValid),
      errors: results.flatMap(r => r.errors),
      warnings: results.flatMap(r => r.warnings)
    };

    return combinedResult;
  }
}

// Export convenience functions
export const validateTeamMemberAccess = async (
  organizationId: string,
  userId: string, 
  entityType: 'leads' | 'projects', 
  entityId: string
): Promise<ValidationResult> => {
  const validator = new TeamValidationService(organizationId);
  return await validator.validateTeamMemberAccess(userId, entityType, entityId);
};

export const validateTeamDataIntegrity = async (organizationId: string): Promise<ValidationResult> => {
  const validator = new TeamValidationService(organizationId);
  return await validator.validateTeamDataIntegrity();
};

export const validateTimezoneOperations = async (organizationId: string): Promise<ValidationResult> => {
  const validator = new TeamValidationService(organizationId);
  return await validator.validateTimezoneOperations();
};