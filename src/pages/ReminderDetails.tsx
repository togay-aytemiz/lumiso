import { useState, useEffect, useMemo, useCallback } from "react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
import GlobalSearch from "@/components/GlobalSearch";
import { FilterBar } from "@/components/FilterBar";
import { ListLoadingSkeleton } from "@/components/ui/loading-presets";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import {
  ArrowUpRight,
  Bell,
  BellRing,
  CalendarRange,
  CheckCircle2,
  Clock,
  RotateCcw,
  SunMedium,
  UserCircle
} from "lucide-react";
import { cn, formatGroupDate, formatTime, formatDateTime, getWeekRange } from "@/lib/utils";

interface Activity {
  id: string;
  content: string;
  reminder_date: string;
  reminder_time: string | null;
  type: string;
  lead_id: string;
  created_at: string;
  updated_at: string;
  completed?: boolean;
}

interface Lead {
  id: string;
  name: string;
  status: string;
}

type FilterType = "all" | "overdue" | "today" | "tomorrow" | "thisWeek" | "nextWeek" | "thisMonth";

interface ReminderSummaryCardProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  accentClassName: string;
  title: string;
  value: number;
  description: string;
  meta?: ReactNode;
}

interface ReminderTimelineLabels {
  lead: string;
  markComplete: string;
  markIncomplete: string;
  openLead: string;
  noTime: string;
  overdue: string;
  today: string;
  tomorrow: string;
  completed: string;
}

interface ReminderTimelineItemProps {
  activity: Activity;
  leadName: string;
  onToggleCompletion: (activityId: string, completed: boolean) => void;
  onNavigate: () => void;
  isOverdue: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  labels: ReminderTimelineLabels;
}

const filterPillBaseClasses =
  "h-9 rounded-full px-3 border border-border/60 bg-background text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0";
const filterPillActiveClasses =
  "bg-primary/10 text-primary border-primary/40 shadow-sm hover:bg-primary/15";
const filterPillBadgeBaseClasses =
  "ml-2 h-5 min-w-[2rem] rounded-full border border-border/50 bg-muted/40 px-2 text-xs font-medium text-muted-foreground transition-colors";
const filterPillBadgeActiveClasses =
  "border-primary/30 bg-primary/15 text-primary";

const ReminderSummaryCard = ({
  icon: Icon,
  accentClassName,
  title,
  value,
  description,
  meta
}: ReminderSummaryCardProps) => (
  <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      </div>
      <span
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-full border-2",
          accentClassName
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
    </div>
    <p className="mt-4 text-sm text-muted-foreground">{description}</p>
    {meta && <div className="mt-3 text-xs text-muted-foreground">{meta}</div>}
  </div>
);

const parseTimeValue = (time?: string | null, direction: "asc" | "desc" = "asc") => {
  if (!time) {
    return direction === "desc" ? -1 : Number.MAX_SAFE_INTEGER;
  }

  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const groupActivitiesByDate = (
  activities: Activity[],
  order: "asc" | "desc" = "asc"
) => {
  const groups = new Map<string, Activity[]>();

  activities.forEach((activity) => {
    if (!activity.reminder_date) return;
    const existing = groups.get(activity.reminder_date);
    if (existing) {
      existing.push(activity);
    } else {
      groups.set(activity.reminder_date, [activity]);
    }
  });

  const sortedEntries = Array.from(groups.entries()).sort((a, b) => {
    const dateA = new Date(a[0]).getTime();
    const dateB = new Date(b[0]).getTime();
    return dateA - dateB;
  });

  if (order === "desc") {
    sortedEntries.reverse();
  }

  return sortedEntries.map(([date, items]) => ({
    date,
    items: items.sort((first, second) => {
      const firstValue = parseTimeValue(first.reminder_time, order);
      const secondValue = parseTimeValue(second.reminder_time, order);
      return order === "desc" ? secondValue - firstValue : firstValue - secondValue;
    })
  }));
};

const ReminderTimelineItem = ({
  activity,
  leadName,
  onToggleCompletion,
  onNavigate,
  isOverdue,
  isToday,
  isTomorrow,
  labels
}: ReminderTimelineItemProps) => {
  const statusConfig = (() => {
    if (activity.completed) {
      return {
        label: labels.completed,
        className:
          "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
        indicatorClassName: "border-emerald-300 bg-emerald-400/90"
      };
    }

    if (isOverdue) {
      return {
        label: labels.overdue,
        className:
          "bg-destructive/10 text-destructive border-destructive/20",
        indicatorClassName: "border-destructive/50 bg-destructive"
      };
    }

    if (isToday) {
      return {
        label: labels.today,
        className:
          "bg-primary/10 text-primary border-primary/20",
        indicatorClassName: "border-primary/40 bg-primary/80"
      };
    }

    if (isTomorrow) {
      return {
        label: labels.tomorrow,
        className:
          "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/30",
        indicatorClassName: "border-amber-300 bg-amber-400"
      };
    }

    return null;
  })();

  const indicatorClassName = statusConfig
    ? statusConfig.indicatorClassName
    : "border-border/70 bg-muted-foreground/70";

  return (
    <div className="relative pl-8">
      <span
        className={cn(
          "absolute left-[6px] top-5 h-2.5 w-2.5 rounded-full border-2 bg-background",
          indicatorClassName
        )}
        aria-hidden="true"
      />
      <div className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {statusConfig && (
                <Badge className={cn("text-xs", statusConfig.className)}>{statusConfig.label}</Badge>
              )}
            </div>
            <div>
              <h3
                className={cn(
                  "text-base font-medium text-foreground",
                  activity.completed && "line-through text-muted-foreground"
                )}
              >
                {activity.content}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <UserCircle className="h-4 w-4" aria-hidden="true" />
                  <span className="font-medium text-foreground">{labels.lead}:</span>
                  <span className="text-muted-foreground">{leadName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {activity.reminder_time ? formatTime(activity.reminder_time) : labels.noTime}
                  </span>
                </div>
                <span className="text-xs uppercase tracking-wide text-muted-foreground/80" title={formatDateTime(activity.reminder_date, activity.reminder_time ?? undefined)}>
                  {formatDateTime(activity.reminder_date, activity.reminder_time ?? undefined)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Button
              variant={activity.completed ? "outline" : "secondary"}
              size="sm"
              className="flex items-center gap-2"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleCompletion(activity.id, !activity.completed);
              }}
            >
              {activity.completed ? (
                <>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  {labels.markIncomplete}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {labels.markComplete}
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 text-primary"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onNavigate();
              }}
            >
              {labels.openLead}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReminderDetails = () => {
  const { t } = useTranslation("pages");
  const { t: tForms } = useFormsTranslation();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("today");
  const [showCompleted, setShowCompleted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    void fetchReminders();
  }, []);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const { data: activitiesData, error: activitiesError } = await supabase
        .from("activities")
        .select("*")
        .not("reminder_date", "is", null)
        .order("reminder_date", { ascending: true })
        .order("reminder_time", { ascending: true });

      if (activitiesError) throw activitiesError;

      if (activitiesData && activitiesData.length > 0) {
        const leadIds = [...new Set(activitiesData.map((activity) => activity.lead_id))];
        if (leadIds.length > 0) {
          const { data: leadsData, error: leadsError } = await supabase
            .from("leads")
            .select("id, name, status")
            .in("id", leadIds);

          if (leadsError) throw leadsError;
          setLeads(leadsData || []);
        }
      }

      setActivities(activitiesData || []);
    } catch (error: any) {
      toast({
        title: "Error fetching reminders",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const getLeadName = useCallback(
    (leadId: string) => {
      const lead = leads.find((item) => item.id === leadId);
      return lead?.name || "Unknown Lead";
    },
    [leads]
  );

  const isOverdue = useCallback((reminderDate: string) => {
    const today = new Date();
    const reminder = new Date(reminderDate);
    today.setHours(0, 0, 0, 0);
    reminder.setHours(0, 0, 0, 0);
    return reminder.getTime() < today.getTime();
  }, []);

  const isToday = useCallback((reminderDate: string) => {
    const today = new Date();
    const reminder = new Date(reminderDate);
    today.setHours(0, 0, 0, 0);
    reminder.setHours(0, 0, 0, 0);
    return reminder.getTime() === today.getTime();
  }, []);

  const isTomorrow = useCallback((reminderDate: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const reminder = new Date(reminderDate);
    tomorrow.setHours(0, 0, 0, 0);
    reminder.setHours(0, 0, 0, 0);
    return reminder.getTime() === tomorrow.getTime();
  }, []);

  const isThisWeek = useCallback((reminderDate: string) => {
    const today = new Date();
    const reminder = new Date(reminderDate);
    const { start: startOfWeek, end: endOfWeek } = getWeekRange(today);
    reminder.setHours(0, 0, 0, 0);
    return reminder.getTime() >= startOfWeek.getTime() && reminder.getTime() <= endOfWeek.getTime();
  }, []);

  const isNextWeek = useCallback((reminderDate: string) => {
    const today = new Date();
    const reminder = new Date(reminderDate);
    const nextWeekDate = new Date(today);
    nextWeekDate.setDate(today.getDate() + 7);
    const { start: startOfNextWeek, end: endOfNextWeek } = getWeekRange(nextWeekDate);
    startOfNextWeek.setHours(0, 0, 0, 0);
    endOfNextWeek.setHours(23, 59, 59, 999);
    reminder.setHours(0, 0, 0, 0);
    return reminder.getTime() >= startOfNextWeek.getTime() && reminder.getTime() <= endOfNextWeek.getTime();
  }, []);

  const isThisMonth = useCallback((reminderDate: string) => {
    const today = new Date();
    const reminder = new Date(reminderDate);
    return today.getFullYear() === reminder.getFullYear() && today.getMonth() === reminder.getMonth();
  }, []);

  const getReminderCountForFilter = useCallback(
    (filterType: FilterType) => {
      const baseActivities = showCompleted ? activities : activities.filter((activity) => !activity.completed);

      switch (filterType) {
        case "all":
          return baseActivities.length;
        case "overdue":
          return baseActivities.filter((activity) => isOverdue(activity.reminder_date)).length;
        case "today":
          return baseActivities.filter((activity) => isToday(activity.reminder_date)).length;
        case "tomorrow":
          return baseActivities.filter((activity) => isTomorrow(activity.reminder_date)).length;
        case "thisWeek":
          return baseActivities.filter((activity) => isThisWeek(activity.reminder_date)).length;
        case "nextWeek":
          return baseActivities.filter((activity) => isNextWeek(activity.reminder_date)).length;
        case "thisMonth":
          return baseActivities.filter((activity) => isThisMonth(activity.reminder_date)).length;
        default:
          return baseActivities.length;
      }
    },
    [activities, showCompleted, isOverdue, isToday, isTomorrow, isThisWeek, isNextWeek, isThisMonth]
  );

  const quickFilters = useMemo(
    () => [
      { key: "all", label: t("reminders.filters.all"), count: getReminderCountForFilter("all") },
      { key: "today", label: t("reminders.filters.today"), count: getReminderCountForFilter("today") },
      { key: "tomorrow", label: t("reminders.filters.tomorrow"), count: getReminderCountForFilter("tomorrow") }
    ],
    [getReminderCountForFilter, t]
  );

  const allDateFilters = useMemo(
    () => [
      { key: "all", label: t("reminders.filters.all"), count: getReminderCountForFilter("all") },
      { key: "overdue", label: t("reminders.filters.overdue"), count: getReminderCountForFilter("overdue") },
      { key: "today", label: t("reminders.filters.today"), count: getReminderCountForFilter("today") },
      { key: "tomorrow", label: t("reminders.filters.tomorrow"), count: getReminderCountForFilter("tomorrow") },
      { key: "thisWeek", label: t("reminders.filters.thisWeek"), count: getReminderCountForFilter("thisWeek") },
      { key: "nextWeek", label: t("reminders.filters.nextWeek"), count: getReminderCountForFilter("nextWeek") },
      { key: "thisMonth", label: t("reminders.filters.thisMonth"), count: getReminderCountForFilter("thisMonth") }
    ],
    [getReminderCountForFilter, t]
  );

  const stats = useMemo(() => {
    const active = activities.filter((activity) => !activity.completed);
    const overdue = active.filter((activity) => isOverdue(activity.reminder_date)).length;
    const todayCount = active.filter((activity) => isToday(activity.reminder_date)).length;
    const tomorrowCount = active.filter((activity) => isTomorrow(activity.reminder_date)).length;
    const upcoming = active.filter(
      (activity) => !isOverdue(activity.reminder_date) && !isToday(activity.reminder_date)
    ).length;
    const completed = activities.filter((activity) => activity.completed).length;

    return {
      overdue,
      today: todayCount,
      tomorrow: tomorrowCount,
      upcoming,
      completed
    };
  }, [activities, isOverdue, isToday, isTomorrow]);

  const { activeActivities, completedActivities } = useMemo(() => {
    const active = activities.filter((activity) => !activity.completed);
    const completed = activities.filter((activity) => activity.completed);

    let filteredActive: Activity[] = [];
    let filteredCompleted: Activity[] = [];

    switch (selectedFilter) {
      case "all":
        filteredActive = active;
        filteredCompleted = completed;
        break;
      case "overdue":
        filteredActive = active.filter((activity) => isOverdue(activity.reminder_date));
        break;
      case "today":
        filteredActive = active.filter((activity) => isToday(activity.reminder_date));
        break;
      case "tomorrow":
        filteredActive = active.filter((activity) => isTomorrow(activity.reminder_date));
        break;
      case "thisWeek":
        filteredActive = active.filter((activity) => isThisWeek(activity.reminder_date));
        break;
      case "nextWeek":
        filteredActive = active.filter((activity) => isNextWeek(activity.reminder_date));
        break;
      case "thisMonth":
        filteredActive = active.filter((activity) => isThisMonth(activity.reminder_date));
        break;
      default:
        filteredActive = active;
        break;
    }

    let finalActive = filteredActive;

    if (selectedFilter !== "overdue") {
      const overdueActivities = active.filter((activity) => isOverdue(activity.reminder_date));
      const nonOverdue = filteredActive.filter((activity) => !isOverdue(activity.reminder_date));
      finalActive = [...overdueActivities, ...nonOverdue];
    }

    const visibleCompleted = showCompleted || selectedFilter === "all" ? filteredCompleted : [];

    return {
      activeActivities: finalActive,
      completedActivities: visibleCompleted
    };
  }, [
    activities,
    selectedFilter,
    showCompleted,
    isOverdue,
    isToday,
    isTomorrow,
    isThisWeek,
    isNextWeek,
    isThisMonth
  ]);

  const groupedActiveActivities = useMemo(
    () => groupActivitiesByDate(activeActivities, "asc"),
    [activeActivities]
  );

  const groupedCompletedActivities = useMemo(
    () => groupActivitiesByDate(completedActivities, "desc"),
    [completedActivities]
  );

  const labels = useMemo<ReminderTimelineLabels>(
    () => ({
      lead: tForms("reminders.lead"),
      markComplete: tForms("reminders.markComplete"),
      markIncomplete: tForms("reminders.markIncomplete"),
      openLead: t("reminders.timeline.openLead"),
      noTime: tForms("reminders.noTime"),
      overdue: tForms("reminders.overdue"),
      today: tForms("reminders.today"),
      tomorrow: tForms("reminders.tomorrow"),
      completed: tForms("reminders.completed")
    }),
    [t, tForms]
  );

  const summaryCards = useMemo(
    () => {
      const upcomingLater = Math.max(stats.upcoming - stats.tomorrow, 0);

      return [
        {
          key: "overdue",
          icon: BellRing,
          accent: "border-destructive/30 bg-destructive/10 text-destructive",
          title: t("reminders.stats.overdue"),
          value: stats.overdue,
          description: t("reminders.statsDescriptions.overdue")
        },
        {
          key: "today",
          icon: SunMedium,
          accent: "border-primary/40 bg-primary/10 text-primary",
          title: t("reminders.stats.today"),
          value: stats.today,
          description: t("reminders.statsDescriptions.today")
        },
        {
          key: "upcoming",
          icon: CalendarRange,
          accent: "border-amber-300/60 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
          title: t("reminders.stats.upcoming"),
          value: stats.upcoming,
          description: t("reminders.statsDescriptions.upcoming", {
            tomorrow: stats.tomorrow,
            later: upcomingLater
          })
        },
        {
          key: "completed",
          icon: CheckCircle2,
          accent: "border-emerald-300/60 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
          title: t("reminders.stats.completed"),
          value: stats.completed,
          description: t("reminders.statsDescriptions.completed")
        }
      ];
    },
    [stats, t]
  );

  const toggleCompletion = async (activityId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from("activities")
        .update({ completed })
        .eq("id", activityId);

      if (error) throw error;

      setActivities((prev) =>
        prev.map((activity) =>
          activity.id === activityId ? { ...activity, completed } : activity
        )
      );

      toast({
        title: completed ? "Reminder marked as completed" : "Reminder marked as not completed",
        description: "Reminder status updated successfully."
      });
    } catch (error: any) {
      toast({
        title: "Error updating reminder",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleReminderClick = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={t("reminders.title")} subtitle={t("reminders.description")}> 
        <PageHeaderSearch>
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 min-w-0">
              <GlobalSearch />
            </div>
          </div>
        </PageHeaderSearch>
      </PageHeader>

      <div className="p-4 sm:p-6 space-y-6">
        {loading ? (
          <ListLoadingSkeleton />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <ReminderSummaryCard
                  key={card.key}
                  icon={card.icon}
                  accentClassName={card.accent}
                  title={card.title}
                  value={card.value}
                  description={card.description}
                  meta={card.key === "upcoming" && stats.tomorrow > 0 ? (
                    <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                      {t("reminders.stats.tomorrowBadge", { count: stats.tomorrow })}
                    </Badge>
                  ) : undefined}
                />
              ))}
            </div>

            <div className="md:hidden">
              <FilterBar
                quickFilters={quickFilters}
                activeQuickFilter={selectedFilter}
                onQuickFilterChange={(filter) => setSelectedFilter(filter as FilterType)}
                allDateFilters={allDateFilters}
                activeDateFilter={selectedFilter}
                onDateFilterChange={(filter) => setSelectedFilter(filter as FilterType)}
                showCompleted={showCompleted}
                onShowCompletedChange={setShowCompleted}
                showCompletedLabel={t("reminders.showCompleted")}
                isSticky
              />
            </div>

            <div className="hidden md:block rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {allDateFilters.map((option) => (
                    <Button
                      key={option.key}
                      variant="outline"
                      size="sm"
                      className={cn(
                        filterPillBaseClasses,
                        selectedFilter === option.key && filterPillActiveClasses
                      )}
                      onClick={() => setSelectedFilter(option.key as FilterType)}
                    >
                      <span>{option.label}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          filterPillBadgeBaseClasses,
                          selectedFilter === option.key && filterPillBadgeActiveClasses
                        )}
                      >
                        {option.count}
                      </Badge>
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {t("reminders.showCompleted")}
                  </span>
                  <Switch checked={showCompleted} onCheckedChange={setShowCompleted} />
                </div>
              </div>
            </div>

            {groupedActiveActivities.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-card/50 p-12 text-center text-muted-foreground">
                <Bell className="mx-auto mb-4 h-12 w-12 opacity-60" aria-hidden="true" />
                <h3 className="text-lg font-medium text-foreground">{t("reminders.emptyState.title")}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t("reminders.emptyState.description")}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedActiveActivities.map((group) => {
                  const relativeLabel = (() => {
                    if (isToday(group.date)) return t("reminders.filters.today");
                    if (isTomorrow(group.date)) return t("reminders.filters.tomorrow");
                    if (isOverdue(group.date)) return t("reminders.filters.overdue");
                    if (isThisWeek(group.date)) return t("reminders.filters.thisWeek");
                    if (isNextWeek(group.date)) return t("reminders.filters.nextWeek");
                    if (isThisMonth(group.date)) return t("reminders.filters.thisMonth");
                    return null;
                  })();

                  return (
                    <div key={group.date} className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          {relativeLabel && (
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                              {relativeLabel}
                            </span>
                          )}
                          <h2 className="mt-1 text-xl font-semibold text-foreground">
                            {formatGroupDate(group.date)}
                          </h2>
                        </div>
                        <Badge variant="outline" className="rounded-full">
                          {group.items.length}
                          <span className="sr-only">{t("reminders.title")}</span>
                        </Badge>
                      </div>
                      <div className="relative mt-6 space-y-6">
                        <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border/60" aria-hidden="true" />
                        {group.items.map((activity) => (
                          <ReminderTimelineItem
                            key={activity.id}
                            activity={activity}
                            leadName={getLeadName(activity.lead_id)}
                            onToggleCompletion={toggleCompletion}
                            onNavigate={() => handleReminderClick(activity.lead_id)}
                            isOverdue={isOverdue(activity.reminder_date)}
                            isToday={isToday(activity.reminder_date)}
                            isTomorrow={isTomorrow(activity.reminder_date)}
                            labels={labels}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {groupedCompletedActivities.length > 0 && (
              <div className="rounded-2xl border border-border/70 bg-card/60 shadow-sm">
                <Accordion type="single" collapsible>
                  <AccordionItem value="completed" className="border-b-0">
                    <AccordionTrigger className="px-5 text-left text-base font-semibold">
                      {t("reminders.timeline.completedTitle")} ({groupedCompletedActivities.reduce((acc, group) => acc + group.items.length, 0)})
                    </AccordionTrigger>
                    <AccordionContent className="px-5">
                      <p className="pb-4 text-sm text-muted-foreground">
                        {t("reminders.timeline.completedDescription")}
                      </p>
                      <div className="space-y-4">
                        {groupedCompletedActivities.map((group) => (
                          <div key={`completed-${group.date}`} className="space-y-4">
                            <div className="text-sm font-medium text-muted-foreground">
                              {formatGroupDate(group.date)}
                            </div>
                            <div className="relative space-y-4">
                              <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border/60" aria-hidden="true" />
                              {group.items.map((activity) => (
                                <ReminderTimelineItem
                                  key={activity.id}
                                  activity={activity}
                                  leadName={getLeadName(activity.lead_id)}
                                  onToggleCompletion={toggleCompletion}
                                  onNavigate={() => handleReminderClick(activity.lead_id)}
                                  isOverdue={isOverdue(activity.reminder_date)}
                                  isToday={isToday(activity.reminder_date)}
                                  isTomorrow={isTomorrow(activity.reminder_date)}
                                  labels={labels}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ReminderDetails;
