import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface QueueStatus {
  total: number;
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  by_type: Record<string, any>;
}

interface RecentLog {
  notification_type: string;
  status: string;
  sent_at: string;
  error_message?: string;
}

interface QueueData {
  queue: QueueStatus;
  recent_logs: RecentLog[];
}

export function NotificationScheduleManager() {
  const [loading, setLoading] = useState(false);
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const { toast } = useToast();

  const handleQueueAction = async (action: string, options: any = {}) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-notification-queue', {
        body: { action, ...options }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Action "${action}" completed successfully`,
      });

      if (action === 'status') {
        setQueueData(data.result);
      }

      // Refresh status after other actions
      if (action !== 'status') {
        await handleQueueAction('status');
      }

    } catch (error: any) {
      console.error('Queue action error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to execute action',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestSend = async () => {
    setLoading(true);
    try {
      // Get current user's organization ID
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!userSettings?.active_organization_id) {
        throw new Error('No active organization found');
      }

      const { data, error } = await supabase.functions.invoke('manage-notification-queue', {
        body: { 
          action: 'test-send', 
          organizationId: userSettings.active_organization_id 
        }
      });

      if (error) throw error;

      toast({
        title: 'Test Email Sent',
        description: 'Check your email for the test daily summary',
      });

    } catch (error: any) {
      console.error('Test send error:', error);
      toast({
        variant: 'destructive',
        title: 'Test Failed',
        description: error.message || 'Failed to send test email',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification Schedule Management</CardTitle>
          <CardDescription>
            Monitor and manage your scheduled email notifications. The system automatically sends daily summaries at your configured time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => handleQueueAction('status')}
              disabled={loading}
              variant="outline"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Refresh Status
            </Button>
            
            <Button
              onClick={handleTestSend}
              disabled={loading}
              variant="secondary"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send Test Email
            </Button>
            
            <Button
              onClick={() => handleQueueAction('populate')}
              disabled={loading}
              variant="outline"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Schedule Tomorrow's Notifications
            </Button>
          </div>
        </CardContent>
      </Card>

      {queueData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Queue Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{queueData.queue.total}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-muted-foreground">{queueData.queue.pending}</div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{queueData.queue.processing}</div>
                  <div className="text-sm text-muted-foreground">Processing</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-success">{queueData.queue.sent}</div>
                  <div className="text-sm text-muted-foreground">Sent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-destructive">{queueData.queue.failed}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>

              {Object.keys(queueData.queue.by_type).length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <h4 className="font-medium mb-2">By Type</h4>
                    <div className="space-y-2">
                      {Object.entries(queueData.queue.by_type).map(([type, stats]: [string, any]) => (
                        <div key={type} className="flex items-center justify-between">
                          <Badge variant="outline">{type}</Badge>
                          <div className="flex gap-2 text-sm">
                            <span className="text-muted-foreground">Pending: {stats.pending}</span>
                            <span className="text-success">Sent: {stats.sent}</span>
                            <span className="text-destructive">Failed: {stats.failed}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {queueData.recent_logs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {queueData.recent_logs.map((log, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                      {getStatusIcon(log.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{log.notification_type}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(log.sent_at)}
                          </span>
                        </div>
                        {log.error_message && (
                          <div className="text-sm text-destructive mt-1">
                            {log.error_message}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}