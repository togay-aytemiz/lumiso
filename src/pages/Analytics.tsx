import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { format, subDays, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval, addDays } from "date-fns";
import { getDateFnsLocale } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import GlobalSearch from "@/components/GlobalSearch";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
import { PageLoadingSkeleton } from "@/components/ui/loading-presets";
import { useTranslation } from "react-i18next";

interface SessionsByDayData {
  date: string;
  sessions: number;
}

interface SessionsByStatusData {
  status: string;
  count: number;
  fill: string;
}

interface LeadsByMonthData {
  month: string;
  leads: number;
}

const Analytics = () => {
  const { t } = useTranslation("pages");
  const [sessionsPerDay, setSessionsPerDay] = useState<SessionsByDayData[]>([]);
  const [sessionsByStatus, setSessionsByStatus] = useState<SessionsByStatusData[]>([]);
  const [leadsByMonth, setLeadsByMonth] = useState<LeadsByMonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionDateMode, setSessionDateMode] = useState<'scheduled' | 'created'>('scheduled');

  const fetchSessionsPerDay = useCallback(async () => {
    const today = new Date();
    
    if (sessionDateMode === 'scheduled') {
      // Next 30 days for scheduled sessions
      const startDate = today;
      const endDate = addDays(today, 29);

      const { data, error } = await supabase
        .from('sessions')
        .select('session_date')
        .gte('session_date', format(startDate, 'yyyy-MM-dd'))
        .lte('session_date', format(endDate, 'yyyy-MM-dd'));

      if (error) throw error;

      // Create array of all days in the range
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      
      // Count sessions per day
      const sessionCounts = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const count = data?.filter(session => 
          session.session_date === dayStr
        ).length || 0;
        
        return {
          date: format(day, 'MMM dd'),
          sessions: count
        };
      });

      setSessionsPerDay(sessionCounts);
    } else {
      // Last 30 days for created sessions
      const endDate = today;
      const startDate = subDays(endDate, 29);

      const { data, error } = await supabase
        .from('sessions')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      // Create array of all days in the range
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      
      // Count sessions per day
      const sessionCounts = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const count = data?.filter(session => 
          format(new Date(session.created_at), 'yyyy-MM-dd') === dayStr
        ).length || 0;
        
        return {
          date: format(day, 'MMM dd'),
          sessions: count
        };
      });

      setSessionsPerDay(sessionCounts);
    }
  }, [sessionDateMode]);

  const fetchSessionsByStatus = useCallback(async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('status');

    if (error) throw error;

    const statusColors = {
      planned: '#3b82f6',      // blue
      completed: '#22c55e',    // green
      cancelled: '#ef4444',    // red
      delivered: '#8b5cf6',    // purple
      in_post_processing: '#f59e0b' // amber
    };

    const statusCounts = data?.reduce((acc: Record<string, number>, session) => {
      acc[session.status] = (acc[session.status] || 0) + 1;
      return acc;
    }, {}) || {};

    const statusData = Object.entries(statusCounts).map(([status, count]) => ({
      status: status === 'in_post_processing' ? 'In Post-Processing' : 
              status.charAt(0).toUpperCase() + status.slice(1),
      count: count as number,
      fill: statusColors[status as keyof typeof statusColors] || '#6b7280'
    }));

    setSessionsByStatus(statusData);
  }, []);

  const fetchLeadsByMonth = useCallback(async () => {
    const endDate = new Date();
    const startDate = subMonths(endDate, 5); // Last 6 months

    const { data, error } = await supabase
      .from('leads')
      .select('created_at')
      .gte('created_at', startOfMonth(startDate).toISOString())
      .lte('created_at', endOfMonth(endDate).toISOString());

    if (error) throw error;

    // Create array of the last 6 months
    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    
    // Count leads per month
    const leadCounts = months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const count = data?.filter(lead => {
        const leadDate = new Date(lead.created_at);
        return leadDate >= monthStart && leadDate <= monthEnd;
      }).length || 0;
      
      return {
        month: format(month, 'MMM', { locale: getDateFnsLocale() }),
        leads: count
      };
    });

    setLeadsByMonth(leadCounts);
  }, []);

  const translationRef = useRef(t);

  useEffect(() => {
    translationRef.current = t;
  }, [t]);

  useEffect(() => {
    let isMounted = true;

    const loadAnalytics = async () => {
      try {
        await Promise.all([
          fetchSessionsByStatus(),
          fetchLeadsByMonth(),
        ]);
      } catch (error: unknown) {
        let message = "Something went wrong";
        if (error instanceof Error) {
          message = error.message;
        } else if (
          typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof (error as { message?: unknown }).message === "string"
        ) {
          message = (error as { message: string }).message;
        }
        toast({
          title: translationRef.current("analytics.errorFetching"),
          description: message,
          variant: "destructive"
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadAnalytics();

    return () => {
      isMounted = false;
    };
  }, [fetchLeadsByMonth, fetchSessionsByStatus]);

  useEffect(() => {
    if (!loading) {
      void fetchSessionsPerDay();
    }
  }, [fetchSessionsPerDay, loading]);

  const chartConfig = {
    sessions: {
      label: t("analytics.chartLabels.sessions"),
      color: "#3b82f6",
    },
    leads: {
      label: t("analytics.chartLabels.leads"),
      color: "#22c55e",
    },
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      <PageHeader
        title={t("analytics.title")}
        subtitle={t("analytics.subtitle")}
      >
        <PageHeaderSearch>
          <GlobalSearch />
        </PageHeaderSearch>
      </PageHeader>

      <div className="p-4 sm:p-6 space-y-6">
        {loading ? (
          <PageLoadingSkeleton />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sessions per Day Chart */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle>{t("analytics.sessionsPerDay.title")}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {sessionDateMode === 'scheduled' 
                      ? t("analytics.sessionsPerDay.scheduled")
                      : t("analytics.sessionsPerDay.created")
                    }
                  </p>
                </div>
                <ToggleGroup
                  type="single"
                  value={sessionDateMode}
                  onValueChange={(value) => value && setSessionDateMode(value as 'scheduled' | 'created')}
                  className="border rounded-md"
                  size="sm"
                >
                  <ToggleGroupItem value="scheduled" className="text-xs px-3">
                    {t("analytics.toggle.scheduled")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="created" className="text-xs px-3">
                    {t("analytics.toggle.created")}
                  </ToggleGroupItem>
                </ToggleGroup>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <LineChart data={sessionsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="sessions" 
                      stroke={chartConfig.sessions.color}
                      strokeWidth={2}
                      dot={{ fill: chartConfig.sessions.color, strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Sessions by Status Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("analytics.sessionsByStatus.title")}</CardTitle>
          </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <PieChart>
                    <Pie
                      data={sessionsByStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ status, count, percent }) => 
                        `${status}: ${count} (${(percent * 100).toFixed(1)}%)`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {sessionsByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* New Leads per Month Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t("analytics.leadsByMonth.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <BarChart data={leadsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar 
                      dataKey="leads" 
                      fill={chartConfig.leads.color}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
