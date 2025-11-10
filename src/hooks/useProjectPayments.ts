import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { computeServiceTotals } from '@/lib/payments/servicePricing';
import { fetchProjectServiceRecords } from '@/lib/services/projectServiceRecords';
import { useOrganizationTaxProfile } from '@/hooks/useOrganizationData';

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
  const taxProfileQuery = useOrganizationTaxProfile();
  const vatExempt = Boolean(taxProfileQuery.data?.vatExempt);
  const vatEnabled = !vatExempt;

  const fetchPaymentSummary = useCallback(async () => {
    try {
      setLoading(true);
      const [projectResponse, serviceRecords, paymentsResponse] = await Promise.all([
        supabase
          .from('projects')
          .select('base_price')
          .eq('id', projectId)
          .single(),
        fetchProjectServiceRecords(projectId),
        supabase
          .from('payments')
          .select('amount')
          .eq('project_id', projectId)
          .eq('status', 'paid')
          .eq('entry_kind', 'recorded'),
      ]);

      if (projectResponse.error) throw projectResponse.error;
      if (paymentsResponse.error) throw paymentsResponse.error;

      const basePrice = projectResponse.data?.base_price || 0;
      const servicesCost = serviceRecords
        .filter((record) => record.billingType === 'extra')
        .reduce((sum, record) => {
          const pricing = computeServiceTotals({
            unitPrice: record.service.selling_price ?? record.service.price ?? null,
            quantity: record.quantity,
            vatRate: vatEnabled ? record.service.vat_rate ?? null : null,
            vatMode:
              vatEnabled && record.service.price_includes_vat === false
                ? 'exclusive'
                : 'inclusive',
          });
          return sum + pricing.gross;
        }, 0);

      const paymentsData = paymentsResponse.data ?? [];
      const totalProject = basePrice + servicesCost;
      const totalPaid = paymentsData.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
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
  }, [projectId, vatEnabled]);

  useEffect(() => {
    void fetchPaymentSummary();
  }, [fetchPaymentSummary, refreshTrigger]);

  return { paymentSummary, loading, refetch: fetchPaymentSummary };
};
