import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";

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

export const useRoleManagement = () => {
  const { activeOrganizationId } = useOrganization();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [memberRoles, setMemberRoles] = useState<MemberRole[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all permissions
  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast.error('Failed to fetch permissions');
    }
  };

  // Fetch custom roles with their permissions
  const fetchCustomRoles = async () => {
    if (!activeOrganizationId) return;

    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .select(`
          id,
          name,
          description,
          sort_order,
          role_permissions (
            permission_id,
            permissions (
              id,
              name,
              description,
              category
            )
          )
        `)
        .eq('organization_id', activeOrganizationId)
        .order('sort_order');

      if (error) throw error;

      const rolesWithPermissions = (data || []).map(role => ({
        ...role,
        permissions: role.role_permissions?.map(rp => rp.permissions).filter(Boolean) || []
      }));

      setCustomRoles(rolesWithPermissions);
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

  // Create new custom role
  const createCustomRole = async (name: string, description: string, permissionIds: string[]) => {
    if (!activeOrganizationId) return;

    try {
      setLoading(true);

      // Create the role
      const { data: roleData, error: roleError } = await supabase
        .from('custom_roles')
        .insert({
          organization_id: activeOrganizationId,
          name,
          description,
          sort_order: customRoles.length + 1
        })
        .select()
        .single();

      if (roleError) throw roleError;

      // Add permissions to the role
      if (permissionIds.length > 0) {
        const rolePermissions = permissionIds.map(permissionId => ({
          role_id: roleData.id,
          permission_id: permissionId
        }));

        const { error: permissionError } = await supabase
          .from('role_permissions')
          .insert(rolePermissions);

        if (permissionError) throw permissionError;
      }

      toast.success('Role created successfully');
      await fetchCustomRoles();
    } catch (error) {
      console.error('Error creating role:', error);
      toast.error('Failed to create role');
    } finally {
      setLoading(false);
    }
  };

  // Update role permissions
  const updateRolePermissions = async (roleId: string, permissionIds: string[]) => {
    try {
      setLoading(true);

      // Remove all existing permissions for this role
      const { error: deleteError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId);

      if (deleteError) throw deleteError;

      // Add new permissions
      if (permissionIds.length > 0) {
        const rolePermissions = permissionIds.map(permissionId => ({
          role_id: roleId,
          permission_id: permissionId
        }));

        const { error: insertError } = await supabase
          .from('role_permissions')
          .insert(rolePermissions);

        if (insertError) throw insertError;
      }

      toast.success('Role permissions updated');
      await fetchCustomRoles();
    } catch (error) {
      console.error('Error updating role permissions:', error);
      toast.error('Failed to update role permissions');
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
        .update({ custom_role_id: customRoleId })
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

      // First remove all permissions for this role
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
    fetchPermissions();
  }, []);

  useEffect(() => {
    if (activeOrganizationId) {
      fetchCustomRoles();
      fetchMemberRoles();
    }
  }, [activeOrganizationId]);

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
      fetchCustomRoles();
      fetchMemberRoles();
    }
  };
};