import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectHeaderPaymentSummary {
  totalPaid: number;
  total: number;
  remaining: number;
  currency: string;
}

export interface ProjectHeaderTodoSummary {
  total: number;
  completed: number;
}

export interface ProjectHeaderServicesSummary {
  total: number;
  names: string[];
  totalValue: number;
}

interface ProjectHeaderSummaryState {
  payments: ProjectHeaderPaymentSummary;
  todos: ProjectHeaderTodoSummary;
  services: ProjectHeaderServicesSummary;
}

const DEFAULT_SUMMARY: ProjectHeaderSummaryState = {
  payments: {
    totalPaid: 0,
    total: 0,
    remaining: 0,
    currency: "TRY"
  },
  todos: {
    total: 0,
    completed: 0
  },
  services: {
    total: 0,
    names: [],
    totalValue: 0
  }
};

export function useProjectHeaderSummary(projectId?: string | null, refreshToken?: number) {
  const [summary, setSummary] = useState<ProjectHeaderSummaryState>(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    if (!projectId) {
      setSummary(DEFAULT_SUMMARY);
      return;
    }

    setLoading(true);
    try {
      const [projectResponse, servicesResponse, paymentsResponse, todosResponse] = await Promise.all([
        supabase.from("projects").select("base_price").eq("id", projectId).single(),
        supabase
          .from("project_services")
          .select(`
            services!inner (
              id,
              name,
              selling_price,
              price
            )
          `)
          .eq("project_id", projectId),
        supabase
          .from("payments")
          .select("amount, status")
          .eq("project_id", projectId),
        supabase.from("todos").select("id, is_completed").eq("project_id", projectId)
      ]);

      if (projectResponse.error) throw projectResponse.error;
      if (servicesResponse.error) throw servicesResponse.error;
      if (paymentsResponse.error) throw paymentsResponse.error;
      if (todosResponse.error) throw todosResponse.error;

      const basePrice = Number(projectResponse.data?.base_price) || 0;

      const serviceEntries = (servicesResponse.data || [])
        .map(entry => entry.services)
        .filter(Boolean) as Array<{
          id: string;
          name: string;
          selling_price?: number | null;
          price?: number | null;
        }>;
      const serviceNames = serviceEntries.map(service => service.name).filter(Boolean);
      const servicesTotal = serviceEntries.reduce((total, service) => {
        const value = service.selling_price ?? service.price ?? 0;
        return total + Number(value) || total;
      }, 0);

      const paymentRows = paymentsResponse.data || [];
      const totalPaid = paymentRows.reduce((total, payment) => {
        if (payment.status === "paid") {
          return total + Number(payment.amount) || total;
        }
        return total;
      }, 0);

      const totalProjectValue = basePrice + servicesTotal;
      const remaining = Math.max(0, totalProjectValue - totalPaid);

      const todoRows = todosResponse.data || [];
      const completedTodos = todoRows.filter(todo => todo.is_completed).length;

      setSummary({
        payments: {
          totalPaid,
          total: totalProjectValue,
          remaining,
          currency: "TRY"
        },
        todos: {
          total: todoRows.length,
          completed: completedTodos
        },
        services: {
          total: serviceNames.length,
          names: serviceNames,
          totalValue: servicesTotal
        }
      });
    } catch (error) {
      console.error("Failed to load project header summary:", error);
      setSummary(DEFAULT_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, refreshToken]);

  return {
    summary,
    loading,
    refresh: fetchSummary
  };
}
