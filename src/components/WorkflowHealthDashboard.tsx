import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useWorkflowHealth } from "@/hooks/useWorkflowHealth";
import { Activity, AlertTriangle, CheckCircle, Clock, Zap, XCircle } from "lucide-react";

export function WorkflowHealthDashboard() {
  const { 
    health, 
    loading, 
    cleanupStuckExecutions, 
    getHealthStatus, 
    getHealthColor, 
    getHealthIcon,
    refetch 
  } = useWorkflowHealth();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-6 bg-muted rounded w-1/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!health) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Unable to load workflow health data</p>
        </CardContent>
      </Card>
    );
  }

  const healthStatus = getHealthStatus();
  const healthColor = getHealthColor();

  return (
    <div className="space-y-6">
      {/* Overall Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">{getHealthIcon()}</span>
            Workflow System Health
            <Badge variant={healthStatus === 'healthy' ? 'default' : healthStatus === 'warning' ? 'secondary' : 'destructive'}>
              {healthStatus.toUpperCase()}
            </Badge>
          </CardTitle>
          <CardDescription>
            Overall system status and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {healthStatus === 'critical' && (
            <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
              <p className="text-sm text-destructive font-medium mb-2">
                ⚠️ Critical Issues Detected
              </p>
              {health.stuckExecutions > 0 && (
                <p className="text-sm text-muted-foreground mb-2">
                  • {health.stuckExecutions} workflow execution(s) are stuck
                </p>
              )}
              {health.successRate < 80 && (
                <p className="text-sm text-muted-foreground mb-2">
                  • Success rate is below 80% ({health.successRate.toFixed(1)}%)
                </p>
              )}
              <Button 
                onClick={cleanupStuckExecutions} 
                size="sm" 
                variant="destructive"
                className="mt-2"
              >
                Cleanup Stuck Executions
              </Button>
            </div>
          )}
          
          {healthStatus === 'warning' && (
            <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium mb-2">
                ⚠️ Performance Issues
              </p>
              {health.successRate < 95 && health.successRate >= 80 && (
                <p className="text-sm text-yellow-700">
                  • Success rate could be improved ({health.successRate.toFixed(1)}%)
                </p>
              )}
              {health.activeWorkflows === 0 && health.totalWorkflows > 0 && (
                <p className="text-sm text-yellow-700">
                  • All workflows are paused
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.totalWorkflows}</div>
            <p className="text-xs text-muted-foreground">
              {health.activeWorkflows} active, {health.pausedWorkflows} paused
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            {health.successRate >= 95 ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : health.successRate >= 80 ? (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Executions</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.recentExecutions}</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Execution Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health.averageExecutionTime > 0 
                ? `${Math.round(health.averageExecutionTime)}ms`
                : 'N/A'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Average response time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      {health.metrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Execution Metrics</CardTitle>
            <CardDescription>
              Workflow execution statistics for the last 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {health.metrics.map((metric) => {
                const successRate = metric.total_executions > 0 
                  ? (metric.successful_executions / metric.total_executions) * 100 
                  : 0;
                  
                return (
                  <div key={metric.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {new Date(metric.date).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {metric.total_executions} total executions
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant={successRate >= 95 ? "default" : successRate >= 80 ? "secondary" : "destructive"}>
                        {successRate.toFixed(1)}% success
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {metric.average_execution_time_ms}ms avg
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>System Actions</CardTitle>
          <CardDescription>
            Maintenance and troubleshooting tools
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={refetch} variant="outline" size="sm">
            Refresh Metrics
          </Button>
          <Button onClick={cleanupStuckExecutions} variant="outline" size="sm">
            Cleanup Stuck Executions
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}