import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Organization {
  id: string;
  name: string;
  owner_id: string;
}

interface OrganizationContextType {
  activeOrganizationId: string | null;
  activeOrganization: Organization | null;
  loading: boolean;
  refreshOrganization: () => Promise<void>;
  setActiveOrganization: (orgId: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchActiveOrganization = async () => {
    try {
      setLoading(true);
      
      // Use the optimized database function
      const { data: orgId, error: orgError } = await supabase.rpc('get_user_active_organization_id');
      
      if (orgError) {
        console.error('Error getting active organization ID:', orgError);
        return;
      }

      if (!orgId) {
        setActiveOrganizationId(null);
        setActiveOrganization(null);
        return;
      }

      // Fetch organization details
      const { data: org, error: orgDetailsError } = await supabase
        .from('organizations')
        .select('id, name, owner_id')
        .eq('id', orgId)
        .single();

      if (orgDetailsError) {
        console.error('Error getting organization details:', orgDetailsError);
        return;
      }

      setActiveOrganizationId(orgId);
      setActiveOrganization(org);
    } catch (error) {
      console.error('Error in fetchActiveOrganization:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshOrganization = async () => {
    await fetchActiveOrganization();
  };

  const setActiveOrganizationHandler = async (orgId: string) => {
    try {
      // Update user settings
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_settings')
        .update({ active_organization_id: orgId })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating active organization:', error);
        toast({
          title: "Error",
          description: "Failed to switch organization",
          variant: "destructive",
        });
        return;
      }

      // Refresh the cached organization
      await refreshOrganization();
      
      toast({
        title: "Success",
        description: "Organization switched successfully",
      });
    } catch (error) {
      console.error('Error setting active organization:', error);
      toast({
        title: "Error",
        description: "Failed to switch organization",
        variant: "destructive",
      });
    }
  };

  // Initialize on mount and when auth state changes
  useEffect(() => {
    const initializeOrganization = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await fetchActiveOrganization();
      } else {
        setActiveOrganizationId(null);
        setActiveOrganization(null);
        setLoading(false);
      }
    };

    initializeOrganization();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          fetchActiveOrganization();
        } else if (event === 'SIGNED_OUT') {
          setActiveOrganizationId(null);
          setActiveOrganization(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <OrganizationContext.Provider
      value={{
        activeOrganizationId,
        activeOrganization,
        loading,
        refreshOrganization,
        setActiveOrganization: setActiveOrganizationHandler,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}