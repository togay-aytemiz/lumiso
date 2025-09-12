# Permission System Implementation Guide

## Overview
This document outlines the comprehensive permission system implemented for the photography CRM application. The system provides granular access control across all major features while maintaining user-friendly interfaces.

## Architecture

### Database Layer
- **permissions** table: Defines all available permissions with categories
- **roles** table: Custom roles that can be created by administrators
- **role_permissions** table: Links roles to specific permissions
- **organization_members** table: Tracks user membership and role assignments
- **user_has_permission()** function: Database function for permission checking in RLS policies

### Application Layer
- **usePermissions** hook: Manages permission loading and caching
- **ProtectedFeature** component: Wraps features that require specific permissions
- **PermissionErrorBoundary**: Handles permission-related errors gracefully
- **Permission utilities**: Helper functions for permission validation

## Permission Categories

### 1. Automation Permissions
- `view_workflows` - View automation workflows
- `create_workflows` - Create new workflows  
- `edit_workflows` - Modify existing workflows
- `delete_workflows` - Delete workflows
- `manage_templates` - Manage email/SMS templates

### 2. Lead Management Permissions
- `view_assigned_leads` - View leads assigned to user
- `manage_all_leads` - Full access to all leads
- `create_leads` - Create new leads
- `edit_assigned_leads` - Edit leads assigned to user
- `delete_leads` - Delete leads

### 3. Project Management Permissions
- `view_assigned_projects` - View projects assigned to user
- `manage_all_projects` - Full access to all projects
- `create_projects` - Create new projects
- `edit_assigned_projects` - Edit projects assigned to user
- `delete_projects` - Delete projects

### 4. Settings Permissions
- `view_lead_statuses` - View lead status configurations
- `manage_lead_statuses` - Modify lead statuses
- `view_project_statuses` - View project status configurations
- `manage_project_statuses` - Modify project statuses
- `view_project_types` - View project type configurations
- `manage_project_types` - Modify project types
- `view_session_statuses` - View session status configurations
- `manage_session_statuses` - Modify session statuses
- `view_services` - View services and packages
- `manage_services` - Modify services and packages
- `view_packages` - View service packages
- `manage_packages` - Modify service packages

### 5. Administrative Permissions
- `manage_team` - Manage team members and invitations
- `manage_roles` - Create and modify custom roles
- `manage_billing` - Access billing and subscription settings
- `manage_integrations` - Configure third-party integrations
- `manage_contracts` - Manage contract templates
- `manage_client_messaging` - Configure client communication settings
- `admin` - Full administrative access

## Implementation Details

### Component Protection
```tsx
<ProtectedFeature 
  requiredPermissions={['create_leads', 'manage_all_leads']}
  title="Lead Creation Access Required"
  description="You need permission to create leads."
>
  <AddLeadButton />
</ProtectedFeature>
```

### Permission Checking
```tsx
const { hasPermission, hasAnyPermission } = usePermissions();

// Check single permission
if (hasPermission('create_leads')) {
  // Show create button
}

// Check multiple permissions (OR logic)
if (hasAnyPermission(['edit_assigned_leads', 'manage_all_leads'])) {
  // Show edit button
}
```

### Database Security
Row Level Security (RLS) policies automatically enforce permissions:
- Users can only see data they have permission to access
- All database operations respect permission boundaries
- Owner role bypasses restrictions for organization owners

## User Experience

### Permission Denied States
- Graceful fallbacks when permissions are insufficient
- Clear messaging about required permissions
- Options to contact administrators for access

### Role-Based Access
- **Owner**: Full access to all features and settings
- **Custom Roles**: Granular permission assignment
- **Flexible Assignment**: Permissions can be combined as needed

### Debug Features (Development Only)
- Permission Debug Panel shows current user permissions
- Real-time permission status updates
- Easy testing of permission boundaries

## Security Considerations

### Database Security
- All database functions use SECURITY DEFINER with restricted search paths
- RLS policies prevent unauthorized data access
- Permission checks happen at multiple layers

### Application Security  
- Client-side permission checks for UI/UX
- Server-side enforcement via database policies
- Comprehensive error handling and logging

### Error Handling
- Permission errors don't expose system internals
- Graceful degradation when permissions change
- Automatic cache invalidation and refresh

## Testing and Validation

### Permission Validation
- Database functions validate permission existence
- Client-side validation prevents invalid states
- Comprehensive error boundaries catch edge cases

### Role Management
- Safe role modification with validation
- Prevention of self-lockout scenarios
- Audit trail for permission changes

## Maintenance

### Adding New Permissions
1. Add permission to database via migration
2. Update permission constants in `permissionUtils.ts`
3. Add UI protection where needed
4. Update RLS policies if required

### Debugging Issues
- Check Permission Debug Panel (development)
- Verify database function logs
- Check RLS policy matches
- Validate organization membership

## Best Practices

### Implementation
- Always use `ProtectedFeature` for UI elements requiring permissions
- Implement both client and server-side validation
- Provide meaningful error messages and fallbacks
- Cache permission results to improve performance

### Security
- Never rely solely on client-side permission checks
- Use database-level enforcement via RLS
- Regularly audit permission assignments
- Monitor for permission escalation attempts

### User Experience
- Show loading states during permission checks
- Provide clear feedback when access is denied
- Offer paths to request additional permissions
- Maintain consistent permission messaging across the app