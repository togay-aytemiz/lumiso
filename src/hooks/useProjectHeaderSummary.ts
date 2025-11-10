import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeServiceTotals } from "@/lib/payments/servicePricing";
import { fetchProjectServiceRecords } from "@/lib/services/projectServiceRecords";
import { useOrganizationTaxProfile } from "@/hooks/useOrganizationData";

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
  const taxProfileQuery = useOrganizationTaxProfile();
  const vatExempt = Boolean(taxProfileQuery.data?.vatExempt);
  const vatEnabled = !vatExempt;

  const fetchSummary = useCallback(async () => {
    if (!projectId) {
      setSummary(DEFAULT_SUMMARY);
      return;
    }

    setLoading(true);
    try {
      const [projectResponse, serviceRecords, paymentsResponse, todosResponse] = await Promise.all([
        supabase.from("projects").select("base_price").eq("id", projectId).single(),
        fetchProjectServiceRecords(projectId),
        supabase
          .from("payments")
          .select("amount, status")
          .eq("project_id", projectId)
          .eq("entry_kind", "recorded"),
        supabase.from("todos").select("id, is_completed").eq("project_id", projectId)
      ]);

      if (projectResponse.error) throw projectResponse.error;
      if (paymentsResponse.error) throw paymentsResponse.error;
      if (todosResponse.error) throw todosResponse.error;

      const basePrice = Number(projectResponse.data?.base_price) || 0;

      const serviceNames = serviceRecords.map((record) => record.service.name);
      const servicesTotal = serviceRecords
        .filter((record) => record.billingType === "extra")
        .reduce((total, record) => {
          const pricing = computeServiceTotals({
            unitPrice: record.service.selling_price ?? record.service.price ?? null,
            quantity: record.quantity,
            vatRate: vatEnabled ? record.service.vat_rate ?? null : null,
            vatMode:
              vatEnabled && record.service.price_includes_vat === false
                ? "exclusive"
                : "inclusive",
          });
          return total + pricing.gross;
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
          total: serviceRecords.length,
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
  }, [projectId, vatEnabled]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, refreshToken]);

  return {
    summary,
    loading,
    refresh: fetchSummary
  };
}
