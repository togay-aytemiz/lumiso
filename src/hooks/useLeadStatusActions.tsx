import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

interface UseLeadStatusActionsProps {
  leadId: string;
  onStatusChange: () => void;
}

export function useLeadStatusActions({ leadId, onStatusChange }: UseLeadStatusActionsProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const updateLeadStatus = async (newStatus: string, previousStatus?: string) => {
    setIsUpdating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      // Ensure system statuses exist for this user
      await supabase.rpc('ensure_system_lead_statuses', {
        user_uuid: userData.user.id
      });

      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', leadId);

      if (error) throw error;

      onStatusChange();

      // Show toast with undo functionality
      const undoRef = { current: false };
      
      toast({
        title: "Status Updated",
        description: `Lead marked as ${newStatus}`,
        action: previousStatus ? (
          <ToastAction
            altText="Undo status change"
            onClick={async () => {
              if (undoRef.current) return; // Prevent multiple clicks
              undoRef.current = true;
              
              try {
                const { error: undoError } = await supabase
                  .from('leads')
                  .update({ status: previousStatus })
                  .eq('id', leadId);

                if (undoError) throw undoError;

                onStatusChange();
                toast({
                  title: "Undone",
                  description: `Status reverted to ${previousStatus}`
                });
              } catch (error: any) {
                toast({
                  title: "Undo failed",
                  description: error.message,
                  variant: "destructive"
                });
              }
            }}
          >
            Undo
          </ToastAction>
        ) : undefined
      });

    } catch (error: any) {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const markAsCompleted = (previousStatus?: string) => 
    updateLeadStatus('Completed', previousStatus);

  const markAsLost = (previousStatus?: string) => 
    updateLeadStatus('Lost', previousStatus);

  return {
    markAsCompleted,
    markAsLost,
    isUpdating
  };
}