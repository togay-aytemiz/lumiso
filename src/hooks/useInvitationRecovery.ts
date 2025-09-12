import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';

export function useInvitationRecovery() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { activeOrganization } = useOrganization();

  const validateEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, []);

  const checkExistingInvitation = useCallback(async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('id, email, expires_at, accepted_at')
        .eq('email', email.toLowerCase())
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking existing invitation:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error checking existing invitation:', error);
      return null;
    }
  }, []);

  const resendInvitation = useCallback(async (invitationId: string) => {
    setLoading(true);
    try {
      // Update the invitation expiry to extend it
      const newExpiryDate = new Date();
      newExpiryDate.setDate(newExpiryDate.getDate() + 7); // Extend by 7 days

      const { error } = await supabase
        .from('invitations')
        .update({ 
          expires_at: newExpiryDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', invitationId);

      if (error) {
        throw error;
      }

      toast({
        title: "Invitation extended",
        description: "The invitation has been extended for 7 more days",
      });

      return { success: true };
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast({
        title: "Error",
        description: "Failed to resend invitation. Please try again.",
        variant: "destructive"
      });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const cancelInvitation = useCallback(async (invitationId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId);

      if (error) {
        throw error;
      }

      toast({
        title: "Invitation cancelled",
        description: "The invitation has been successfully cancelled",
      });

      return { success: true };
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast({
        title: "Error",
        description: "Failed to cancel invitation. Please try again.",
        variant: "destructive"
      });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const recoverFailedInvitation = useCallback(async (email: string, role: string) => {
    setLoading(true);
    try {
      if (!activeOrganization?.id) {
        throw new Error('No active organization');
      }

      // First, clean up any failed invitations for this email
      await supabase
        .from('invitations')
        .delete()
        .eq('email', email.toLowerCase())
        .eq('organization_id', activeOrganization.id)
        .is('accepted_at', null)
        .lt('expires_at', new Date().toISOString());

      // Create a new invitation
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7);

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('invitations')
        .insert({
          email: email.toLowerCase(),
          role: role,
          invited_by: user.user.id,
          organization_id: activeOrganization.id,
          expires_at: expiryDate.toISOString(),
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Invitation recovered",
        description: `New invitation sent to ${email}`,
      });

      return { success: true };
    } catch (error) {
      console.error('Error recovering invitation:', error);
      toast({
        title: "Recovery failed",
        description: "Failed to recover invitation. Please try again.",
        variant: "destructive"
      });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      setLoading(false);
    }
  }, [toast, activeOrganization?.id]);

  return {
    loading,
    validateEmail,
    checkExistingInvitation,
    resendInvitation,
    cancelInvitation,
    recoverFailedInvitation,
  };
}