import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkflowHealth } from "@/hooks/useWorkflowHealth";
import { Activity, AlertTriangle, CheckCircle, Clock, Zap, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export function WorkflowHealthDashboard() {
  const {
    health,
    loading,
    cleanupStuckExecutions,
    getHealthStatus,
    getHealthIcon,
    refetch
  } = useWorkflowHealth();
  const { t } = useTranslation("pages");

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
          <p className="text-muted-foreground">{t("workflows.health.unableToLoad")}</p>
        </CardContent>
      </Card>
    );
  }

  const healthStatus = getHealthStatus();

  return (
    <div className="space-y-6">
      {/* Overall Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">{getHealthIcon()}</span>
            {t("workflows.health.status.title")}
            <Badge variant={healthStatus === 'healthy' ? 'default' : healthStatus === 'warning' ? 'secondary' : 'destructive'}>
              {t(`workflows.health.status.labels.${healthStatus}`)}
            </Badge>
          </CardTitle>
          <CardDescription>
            {t("workflows.health.status.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {healthStatus === 'critical' && (
            <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
              <p className="text-sm text-destructive font-medium mb-2">
                {t("workflows.health.critical.title")}
              </p>
              {health.stuckExecutions > 0 && (
                <p className="text-sm text-muted-foreground mb-2">
                  {t("workflows.health.critical.stuckExecutions", { count: health.stuckExecutions })}
                </p>
              )}
              {health.successRate < 80 && (
                <p className="text-sm text-muted-foreground mb-2">
                  {t("workflows.health.critical.lowSuccessRate", {
                    rate: health.successRate.toFixed(1)
                  })}
                </p>
              )}
              <Button
                onClick={cleanupStuckExecutions}
                size="sm"
                variant="destructive"
                className="mt-2"
              >
                {t("workflows.health.actions.cleanup")}
              </Button>
            </div>
          )}

          {healthStatus === 'warning' && (
            <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium mb-2">
                {t("workflows.health.warning.title")}
              </p>
              {health.successRate < 95 && health.successRate >= 80 && (
                <p className="text-sm text-yellow-700">
                  {t("workflows.health.warning.improveSuccessRate", {
                    rate: health.successRate.toFixed(1)
                  })}
                </p>
              )}
              {health.activeWorkflows === 0 && health.totalWorkflows > 0 && (
                <p className="text-sm text-yellow-700">
                  {t("workflows.health.warning.allPaused")}
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
            <CardTitle className="text-sm font-medium">{t("workflows.health.metrics.totalWorkflows")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.totalWorkflows}</div>
            <p className="text-xs text-muted-foreground">
              {t("workflows.health.metrics.totalSubtitle", {
                active: health.activeWorkflows,
                paused: health.pausedWorkflows
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("workflows.health.metrics.successRate")}</CardTitle>
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
              {t("workflows.health.metrics.successRateSubtitle")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("workflows.health.metrics.recentExecutions")}</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.recentExecutions}</div>
            <p className="text-xs text-muted-foreground">
              {t("workflows.health.metrics.recentExecutionsSubtitle")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("workflows.health.metrics.averageExecutionTime")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health.averageExecutionTime > 0
                ? `${Math.round(health.averageExecutionTime)}ms`
                : t("common:abbreviations.notAvailable", "N/A")
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {t("workflows.health.metrics.averageExecutionTimeSubtitle")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      {health.metrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("workflows.health.metrics.dailyTitle")}</CardTitle>
            <CardDescription>
              {t("workflows.health.metrics.dailyDescription")}
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
                        {t("workflows.health.metrics.dailyTotal", { count: metric.total_executions })}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant={successRate >= 95 ? "default" : successRate >= 80 ? "secondary" : "destructive"}>
                        {t("workflows.health.metrics.dailySuccess", { rate: successRate.toFixed(1) })}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {t("workflows.health.metrics.dailyAverage", { time: metric.average_execution_time_ms })}
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
          <CardTitle>{t("workflows.health.actions.systemTitle")}</CardTitle>
          <CardDescription>
            {t("workflows.health.actions.systemDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={refetch} variant="outline" size="sm">
            {t("workflows.health.actions.refresh")}
          </Button>
          <Button onClick={cleanupStuckExecutions} variant="outline" size="sm">
            {t("workflows.health.actions.cleanup")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}