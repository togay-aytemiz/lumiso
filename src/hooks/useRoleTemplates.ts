import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";

export interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  sort_order: number;
  is_system: boolean;
}

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  template_id?: string;
  template?: RoleTemplate;
  sort_order: number;
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

export const useRoleTemplates = () => {
  const { activeOrganizationId } = useOrganization();
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [memberRoles, setMemberRoles] = useState<MemberRole[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch role templates
  const fetchRoleTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('role_templates')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setRoleTemplates(data || []);
    } catch (error) {
      console.error('Error fetching role templates:', error);
      toast.error('Failed to fetch role templates');
    }
  };

  // Fetch custom roles with their templates
  const fetchCustomRoles = async () => {
    if (!activeOrganizationId) return;

    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .select(`
          id,
          name,
          description,
          template_id,
          sort_order,
          role_templates (
            id,
            name,
            description,
            permissions,
            sort_order,
            is_system
          )
        `)
        .eq('organization_id', activeOrganizationId)
        .order('sort_order');

      if (error) throw error;

      const rolesWithTemplates = (data || []).map(role => ({
        ...role,
        template: role.role_templates || undefined
      }));

      setCustomRoles(rolesWithTemplates);
    } catch (error) {
      console.error('Error fetching custom roles:', error);
      toast.error('Failed to fetch roles');
    }
  };

  // Fetch member roles
  const fetchMemberRoles = async () => {
    if (!activeOrganizationId) return;

    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          id,
          user_id,
          role,
          system_role,
          custom_role_id
        `)
        .eq('organization_id', activeOrganizationId)
        .eq('status', 'active');

      if (error) throw error;

      // For each member, get their profile data
      const membersWithDetails = await Promise.all(
        (data || []).map(async (member) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, profile_photo_url')
            .eq('user_id', member.user_id)
            .single();

          return {
            ...member,
            full_name: profile?.full_name,
            profile_photo_url: profile?.profile_photo_url,
            email: '' // We'll need to handle email separately if needed
          };
        })
      );

      setMemberRoles(membersWithDetails);
    } catch (error) {
      console.error('Error fetching member roles:', error);
      toast.error('Failed to fetch team members');
    }
  };

  // Create new custom role from template
  const createRoleFromTemplate = async (templateId: string, customName?: string) => {
    if (!activeOrganizationId) {
      toast.error('No active organization found');
      return;
    }

    const template = roleTemplates.find(t => t.id === templateId);
    if (!template) {
      toast.error('Template not found');
      return;
    }

    try {
      setLoading(true);

      // Create the role
      const { data: roleData, error: roleError } = await supabase
        .from('custom_roles')
        .insert({
          organization_id: activeOrganizationId,
          name: customName || template.name,
          description: template.description,
          template_id: templateId,
          sort_order: customRoles.length + 1
        })
        .select()
        .single();

      if (roleError) throw roleError;

      // Add permissions to the role
      if (template.permissions.length > 0) {
        // Get permission IDs from permission names
        const { data: permissions, error: permError } = await supabase
          .from('permissions')
          .select('id, name')
          .in('name', template.permissions);

        if (permError) throw permError;

        const rolePermissions = permissions.map(permission => ({
          role_id: roleData.id,
          permission_id: permission.id
        }));

        const { error: permissionError } = await supabase
          .from('role_permissions')
          .insert(rolePermissions);

        if (permissionError) throw permissionError;
      }

      toast.success('Role created successfully');
      await fetchCustomRoles();
    } catch (error) {
      console.error('Error creating role from template:', error);
      toast.error('Failed to create role');
    } finally {
      setLoading(false);
    }
  };

  // Assign role to member
  const assignRoleToMember = async (memberId: string, customRoleId: string) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('organization_members')
        .update({ 
          custom_role_id: customRoleId,
          system_role: 'Member'
        })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Role assigned successfully');
      await fetchMemberRoles();
    } catch (error) {
      console.error('Error assigning role:', error);
      toast.error('Failed to assign role');
    } finally {
      setLoading(false);
    }
  };

  // Delete custom role
  const deleteCustomRole = async (roleId: string) => {
    try {
      setLoading(true);

      // Remove all permissions for this role
      const { error: permissionError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId);

      if (permissionError) throw permissionError;

      // Remove role assignment from members
      const { error: memberError } = await supabase
        .from('organization_members')
        .update({ custom_role_id: null })
        .eq('custom_role_id', roleId);

      if (memberError) throw memberError;

      // Delete the role
      const { error: roleError } = await supabase
        .from('custom_roles')
        .delete()
        .eq('id', roleId);

      if (roleError) throw roleError;

      toast.success('Role deleted successfully');
      await fetchCustomRoles();
      await fetchMemberRoles();
    } catch (error) {
      console.error('Error deleting role:', error);
      toast.error('Failed to delete role');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoleTemplates();
  }, []);

  useEffect(() => {
    if (activeOrganizationId) {
      fetchCustomRoles();
      fetchMemberRoles();
    }
  }, [activeOrganizationId]);

  return {
    roleTemplates,
    customRoles,
    memberRoles,
    loading,
    createRoleFromTemplate,
    assignRoleToMember,
    deleteCustomRole,
    refetch: () => {
      fetchCustomRoles();
      fetchMemberRoles();
    }
  };
};