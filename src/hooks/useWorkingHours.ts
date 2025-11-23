import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface WorkingHour {
  id?: string;
  day_of_week: number;
  enabled: boolean;
  start_time: string | null;
  end_time: string | null;
}

export function useWorkingHours() {
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation(["messages", "common"]);

  const fetchWorkingHours = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('working_hours')
        .select('*')
        .eq('user_id', user.id)
        .order('day_of_week');

      if (error) throw error;

      setWorkingHours(data || []);
    } catch (error) {
      console.error('Error fetching working hours:', error);
      toast({
        title: t("toast.error", { ns: "common" }),
        description: t("workingHours.loadError", { ns: "messages" }),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateWorkingHour = async (dayOfWeek: number, updates: Partial<WorkingHour>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("No user found");

      const { data, error } = await supabase
        .from('working_hours')
        .update(updates)
        .eq('user_id', user.id)
        .eq('day_of_week', dayOfWeek)
        .select()
        .single();

      if (error) throw error;

      setWorkingHours(prev => 
        prev.map(wh => 
          wh.day_of_week === dayOfWeek ? { ...wh, ...updates } : wh
        )
      );

      return { success: true };
    } catch (error) {
      console.error('Error updating working hour:', error);
      toast({
        title: t("toast.error", { ns: "common" }),
        description: t("workingHours.updateError", { ns: "messages" }),
        variant: "destructive",
      });
      return { success: false, error };
    }
  };

  useEffect(() => {
    void fetchWorkingHours();
  }, [fetchWorkingHours]);

  return {
    workingHours,
    loading,
    updateWorkingHour,
    refetch: fetchWorkingHours
  };
}
