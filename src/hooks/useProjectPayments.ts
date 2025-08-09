import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  const fetchPaymentSummary = async () => {
    try {
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
          services!inner (
            selling_price,
            price
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
      const servicesCost = servicesData?.reduce((sum, ps) => {
        const service = ps.services;
        const price = service.selling_price || service.price || 0;
        return sum + Number(price);
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
  };

  useEffect(() => {
    fetchPaymentSummary();
  }, [projectId, refreshTrigger]);

  return { paymentSummary, loading, refetch: fetchPaymentSummary };
};