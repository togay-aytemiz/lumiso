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
      
      // Use the organization utils function
      const { getUserOrganizationId } = await import('@/lib/organizationUtils');
      const orgId = await getUserOrganizationId();
      
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
    // In single-photographer model, organization is determined by ownership
    // No need to update user settings since getUserOrganizationId handles this
    console.log('Organization switch not needed in single-photographer mode:', orgId);
    
    // Just refresh the organization data
    await refreshOrganization();
    
    toast({
      title: "Success", 
      description: "Organization data refreshed",
    });
  };

  // Set up simplified presence tracking for single-photographer
  useEffect(() => {
    let presenceInterval: any = null;

    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !activeOrganizationId) return;

      // Simple periodic activity update - no complex presence channels needed
      presenceInterval = setInterval(async () => {
        try {
          // Just update user_settings to show activity
          await supabase
            .from('user_settings')
            .update({ updated_at: new Date().toISOString() })
            .eq('user_id', user.id);
        } catch (error) {
          console.warn('Failed to update activity timestamp:', error);
        }
      }, 300000); // Update every 5 minutes
    };

    if (activeOrganizationId) {
      setupPresence();
    }

    return () => {
      if (presenceInterval) {
        clearInterval(presenceInterval);
      }
    };
  }, [activeOrganizationId]);

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