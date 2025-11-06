import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { computeServiceTotals } from '@/lib/payments/servicePricing';

interface PaymentSummary {
  totalPaid: number;
  totalProject: number;
  remaining: number;
  currency: string;
}

export const useProjectPayments = (projectId: string, refreshTrigger?: number) => {
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary>({
    totalPaid: 0,
    totalProject: 0,
    remaining: 0,
    currency: 'TRY',
  });
  const [loading, setLoading] = useState(true);

  const fetchPaymentSummary = useCallback(async () => {
    try {
      setLoading(true);
      // Get project base price
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('base_price')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      // Get total cost of added services
      const { data: servicesData, error: servicesError } = await supabase
        .from('project_services')
        .select(`
          quantity,
          unit_price_override,
          vat_rate_override,
          vat_mode_override,
          services!inner (
            selling_price,
            price,
            vat_rate,
            price_includes_vat
          )
        `)
        .eq('project_id', projectId);

      if (servicesError) throw servicesError;

      // Get total paid amount
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('project_id', projectId)
        .eq('status', 'paid');

      if (paymentsError) throw paymentsError;

      const basePrice = projectData?.base_price || 0;
      const servicesCost =
        servicesData?.reduce((sum, entry) => {
          const service = entry?.services;
          if (!service) return sum;
          const pricing = computeServiceTotals({
            unitPrice: entry?.unit_price_override ?? service.selling_price ?? service.price ?? null,
            quantity: entry?.quantity ?? 1,
            vatRate: entry?.vat_rate_override ?? service.vat_rate ?? null,
            vatMode:
              entry?.vat_mode_override ??
              (service.price_includes_vat === false ? "exclusive" : "inclusive"),
          });
          return sum + pricing.gross;
        }, 0) || 0;
      
      const totalProject = basePrice + servicesCost;
      const totalPaid = paymentsData?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
      const remaining = Math.max(0, totalProject - totalPaid);

      setPaymentSummary({
        totalPaid,
        totalProject,
        remaining,
        currency: 'TRY',
      });
    } catch (error) {
      console.error('Error fetching payment summary:', error);
      setPaymentSummary({
        totalPaid: 0,
        totalProject: 0,
        remaining: 0,
        currency: 'TRY',
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchPaymentSummary();
  }, [fetchPaymentSummary, refreshTrigger]);

  return { paymentSummary, loading, refetch: fetchPaymentSummary };
};
