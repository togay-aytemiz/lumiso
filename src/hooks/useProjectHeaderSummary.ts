import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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

type ProjectServiceRow = Database["public"]["Tables"]["project_services"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

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
            billing_type,
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

      const serviceRows = (servicesResponse.data || []) as Array<
        ProjectServiceRow & { services: ServiceRow | null }
      >;

      const serviceEntries = serviceRows
        .map((entry) => {
          const service = entry.services;
          if (!service) return null;
          return {
            billing_type: entry.billing_type as string,
            service: {
              id: service.id,
              name: service.name,
              selling_price: service.selling_price ?? null,
              price: service.price ?? null,
            },
          };
        })
        .filter(Boolean) as Array<{
          billing_type: string;
          service: {
            id: string;
            name: string;
            selling_price: number | null;
            price: number | null;
          };
        }>;
      const serviceNames = serviceEntries.map(entry => entry.service.name).filter(Boolean);
      const servicesTotal = serviceEntries.reduce((total, entry) => {
        if (entry.billing_type !== "extra") {
          return total;
        }
        const value = entry.service.selling_price ?? entry.service.price ?? 0;
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
