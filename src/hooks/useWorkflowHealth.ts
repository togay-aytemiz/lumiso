import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getUserOrganizationId } from '@/lib/organizationUtils';

interface WorkflowMetrics {
  id: string;
  organization_id: string;
  date: string;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  average_execution_time_ms: number;
}

interface WorkflowHealth {
  totalWorkflows: number;
  activeWorkflows: number;
  pausedWorkflows: number;
  recentExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  failedExecutions: number;
  stuckExecutions: number;
  metrics: WorkflowMetrics[];
}

export function useWorkflowHealth() {
  const [health, setHealth] = useState<WorkflowHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchWorkflowHealth = async () => {
    try {
      setLoading(true);
      const organizationId = await getUserOrganizationId();
      if (!organizationId) return;

      // Get workflow counts
      const { data: workflows, error: workflowsError } = await supabase
        .from('workflows')
        .select('id, is_active')
        .eq('organization_id', organizationId);

      if (workflowsError) throw workflowsError;

      // Get execution metrics for the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: metrics, error: metricsError } = await supabase
        .from('workflow_execution_metrics')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (metricsError) throw metricsError;

      // Get recent executions (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: recentExecutions, error: executionsError } = await supabase
        .from('workflow_executions')
        .select('id, status, started_at, completed_at')
        .eq('workflows.organization_id', organizationId)
        .gte('created_at', yesterday.toISOString());

      if (executionsError) {
        console.warn('Could not fetch recent executions:', executionsError);
      }

      // Check for stuck executions (running for more than 5 minutes)
      const fiveMinutesAgo = new Date();
      fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

      const { data: stuckExecutions, error: stuckError } = await supabase
        .from('workflow_executions')
        .select('id')
        .eq('status', 'running')
        .lt('started_at', fiveMinutesAgo.toISOString());

      if (stuckError) {
        console.warn('Could not check for stuck executions:', stuckError);
      }

      // Calculate health metrics
      const totalWorkflows = workflows?.length || 0;
      const activeWorkflows = workflows?.filter(w => w.is_active).length || 0;
      const pausedWorkflows = totalWorkflows - activeWorkflows;

      const totalMetrics = metrics?.reduce((acc, m) => ({
        total_executions: acc.total_executions + m.total_executions,
        successful_executions: acc.successful_executions + m.successful_executions,
        failed_executions: acc.failed_executions + m.failed_executions,
        total_execution_time: acc.total_execution_time + (m.average_execution_time_ms * m.total_executions),
      }), {
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        total_execution_time: 0,
      }) || {
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        total_execution_time: 0,
      };

      const successRate = totalMetrics.total_executions > 0 
        ? (totalMetrics.successful_executions / totalMetrics.total_executions) * 100 
        : 100;

      const averageExecutionTime = totalMetrics.total_executions > 0
        ? totalMetrics.total_execution_time / totalMetrics.total_executions
        : 0;

      setHealth({
        totalWorkflows,
        activeWorkflows,
        pausedWorkflows,
        recentExecutions: recentExecutions?.length || 0,
        successRate,
        averageExecutionTime,
        failedExecutions: totalMetrics.failed_executions,
        stuckExecutions: stuckExecutions?.length || 0,
        metrics: metrics || [],
      });

    } catch (error) {
      console.error('Error fetching workflow health:', error);
      toast({
        title: 'Error',
        description: 'Failed to load workflow health metrics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const cleanupStuckExecutions = async () => {
    try {
      const { data, error } = await supabase.rpc('cleanup_workflow_executions');
      
      if (error) throw error;

      toast({
        title: 'Success',
        description: `Cleaned up ${data || 0} stuck executions`,
      });

      // Refresh health metrics
      await fetchWorkflowHealth();
    } catch (error) {
      console.error('Error cleaning up executions:', error);
      toast({
        title: 'Error',
        description: 'Failed to cleanup stuck executions',
        variant: 'destructive',
      });
    }
  };

  const getHealthStatus = (): 'healthy' | 'warning' | 'critical' => {
    if (!health) return 'warning';
    
    if (health.stuckExecutions > 0) return 'critical';
    if (health.successRate < 80) return 'critical';
    if (health.successRate < 95) return 'warning';
    if (health.activeWorkflows === 0 && health.totalWorkflows > 0) return 'warning';
    
    return 'healthy';
  };

  const getHealthColor = () => {
    const status = getHealthStatus();
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthIcon = () => {
    const status = getHealthStatus();
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '🚨';
      default: return '❓';
    }
  };

  useEffect(() => {
    fetchWorkflowHealth();
  }, []);

  return {
    health,
    loading,
    fetchWorkflowHealth,
    cleanupStuckExecutions,
    getHealthStatus,
    getHealthColor,
    getHealthIcon,
    refetch: fetchWorkflowHealth,
  };
}