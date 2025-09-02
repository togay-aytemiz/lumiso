import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";
import { 
  RefreshCw, 
  Send, 
  Calendar, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  XCircle,
  Play,
  RotateCcw
} from "lucide-react";

interface NotificationStats {
  total: number;
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  by_type: Record<string, any>;
}

interface RecentNotification {
  id: string;
  notification_type: string;
  status: string;
  created_at: string;
  sent_at?: string;
  error_message?: string;
  delivery_method: string;
}

export function NotificationSystemManager() {
  const { toast } = useToast();
  const {
    scheduleDailySummaries,
    processPendingNotifications,
    retryFailedNotifications
  } = useNotificationTriggers();

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [recentNotifications, setRecentNotifications] = useState<RecentNotification[]>([]);

  // Load notification statistics
  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Get notification statistics
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('notification_type, status, delivery_method');

      if (error) {
        throw error;
      }

      // Calculate stats
      const stats: NotificationStats = {
        total: notifications?.length || 0,
        pending: 0,
        processing: 0,
        sent: 0,
        failed: 0,
        by_type: {}
      };

      (notifications || []).forEach(notification => {
        stats[notification.status as keyof NotificationStats]++;
        
        if (!stats.by_type[notification.notification_type]) {
          stats.by_type[notification.notification_type] = {
            pending: 0,
            processing: 0,
            sent: 0,
            failed: 0
          };
        }
        stats.by_type[notification.notification_type][notification.status]++;
      });

      setStats(stats);

      // Get recent notifications
      const { data: recent } = await supabase
        .from('notifications')
        .select('id, notification_type, status, created_at, sent_at, error_message, delivery_method')
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentNotifications(recent || []);

    } catch (error: any) {
      console.error('Error loading notification stats:', error);
      toast({
        title: "Error",
        description: "Failed to load notification statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleScheduleDailySummaries = async () => {
    setLoading(true);
    try {
      await scheduleDailySummaries();
      toast({
        title: "Success",
        description: "Daily summaries scheduled for tomorrow",
      });
      await loadStats(); // Refresh stats
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPending = async () => {
    setLoading(true);
    try {
      await processPendingNotifications();
      await loadStats(); // Refresh stats
    } finally {
      setLoading(false);
    }
  };

  const handleRetryFailed = async () => {
    setLoading(true);
    try {
      await retryFailedNotifications();
      await loadStats(); // Refresh stats
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-3 w-3 text-yellow-500" />;
      case 'processing':
        return <RefreshCw className="h-3 w-3 text-blue-500 animate-spin" />;
      case 'sent':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'failed':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <AlertCircle className="h-3 w-3 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Notification System Control
          </CardTitle>
          <CardDescription>
            Manage and monitor the unified notification system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={loadStats}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Status
            </Button>
            
            <Button
              onClick={handleProcessPending}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Process Pending
            </Button>
            
            <Button
              onClick={handleScheduleDailySummaries}
              disabled={loading}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Schedule Tomorrow
            </Button>
            
            <Button
              onClick={handleRetryFailed}
              disabled={loading}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Retry Failed
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sent</p>
                  <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* By Type Statistics */}
      {stats && Object.keys(stats.by_type).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Statistics by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats.by_type).map(([type, typeStats]) => (
                <div key={type} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="font-medium capitalize">
                    {type.replace('-', ' ')}
                  </div>
                  <div className="flex gap-2">
                    {typeStats.pending > 0 && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                        {typeStats.pending} pending
                      </Badge>
                    )}
                    {typeStats.sent > 0 && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {typeStats.sent} sent
                      </Badge>
                    )}
                    {typeStats.failed > 0 && (
                      <Badge variant="secondary" className="bg-red-100 text-red-800">
                        {typeStats.failed} failed
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {recentNotifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest notification activity across the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentNotifications.map((notification) => (
                <div key={notification.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(notification.status)}
                    <div>
                      <p className="font-medium capitalize">
                        {notification.notification_type.replace('-', ' ')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(notification.created_at)}
                      </p>
                      {notification.error_message && (
                        <p className="text-xs text-red-600 mt-1">
                          {notification.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge 
                      variant="secondary" 
                      className={getStatusColor(notification.status)}
                    >
                      {notification.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      {notification.delivery_method}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}