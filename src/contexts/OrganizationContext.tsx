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

  // Set up global presence tracking
  useEffect(() => {
    let presenceChannel: any = null;
    let presenceInterval: any = null;

    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !activeOrganizationId) return;

      const channelName = `organization_${activeOrganizationId}_presence`;
      presenceChannel = supabase.channel(channelName);

      // Track presence events
      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          console.log('Presence synced for organization:', activeOrganizationId);
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          console.log('User joined:', newPresences);
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          console.log('User left:', leftPresences);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Global presence channel subscribed, tracking user:', user.id);
            // Track current user's presence
            await presenceChannel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
          }
        });

      // Update last_active timestamp every 5 minutes
      presenceInterval = setInterval(async () => {
        try {
          await supabase
            .from('organization_members')
            .update({ last_active: new Date().toISOString() })
            .eq('user_id', user.id)
            .eq('organization_id', activeOrganizationId);
          
          // Re-track presence to keep connection alive
          if (presenceChannel) {
            await presenceChannel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.warn('Failed to update global presence:', error);
        }
      }, 300000); // Update every 5 minutes
    };

    if (activeOrganizationId) {
      setupPresence();
    }

    return () => {
      if (presenceChannel) {
        console.log('Cleaning up global presence channel');
        presenceChannel.unsubscribe();
      }
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