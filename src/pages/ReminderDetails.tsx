import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useThrottledRefetchOnFocus } from "@/hooks/useThrottledRefetchOnFocus";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { getKpiIconPreset } from "@/components/ui/kpi-presets";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
import GlobalSearch from "@/components/GlobalSearch";
import { FilterBar } from "@/components/FilterBar";
import { ListLoadingSkeleton } from "@/components/ui/loading-presets";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
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
  UserCircle,
} from "lucide-react";
import { cn, formatGroupDate, formatTime, getWeekRange } from "@/lib/utils";

interface Activity {
  id: string;
  content: string;
  reminder_date: string;
  reminder_time: string | null;
  type: string;
  lead_id: string;
  project_id?: string | null;
  created_at: string;
  updated_at: string;
  completed?: boolean;
}

interface Lead {
  id: string;
  name: string;
  status: string;
}

type ReminderProject = {
  id: string;
  name: string;
  description: string | null;
  lead_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  status_id?: string | null;
  previous_status_id?: string | null;
  project_type_id?: string | null;
};

type FilterType =
  | "all"
  | "overdue"
  | "today"
  | "tomorrow"
  | "thisWeek"
  | "nextWeek"
  | "thisMonth";

interface ReminderTimelineLabels {
  lead: string;
  markComplete: string;
  markIncomplete: string;
  openLead: string;
  openProject: string;
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
  onNavigateProject?: () => void;
  isOverdue: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  labels: ReminderTimelineLabels;
  hasProject?: boolean;
}

const filterPillBaseClasses =
  "h-9 rounded-full px-3 border border-border/60 bg-background text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0";
const filterPillActiveClasses =
  "bg-primary/10 text-primary border-primary/40 shadow-sm hover:bg-primary/15";
const filterPillBadgeBaseClasses =
  "ml-2 h-5 min-w-[2rem] rounded-full border border-border/50 bg-muted/40 px-2 text-xs font-medium text-muted-foreground transition-colors";
const filterPillBadgeActiveClasses =
  "border-primary/30 bg-primary/15 text-primary";

const INITIAL_REMINDER_BATCH = 25;

// Legacy summary card removed in favor of shared <KpiCard /> component used across the app

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
};

const parseTimeValue = (
  time?: string | null,
  direction: "asc" | "desc" = "asc"
) => {
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
      return order === "desc"
        ? secondValue - firstValue
        : firstValue - secondValue;
    }),
  }));
};

const ReminderTimelineItem = ({
  activity,
  leadName,
  onToggleCompletion,
  onNavigate,
  onNavigateProject,
  isOverdue,
  isToday,
  isTomorrow,
  labels,
}: ReminderTimelineItemProps) => {
  const statusConfig = (() => {
    if (activity.completed) {
      return {
        label: labels.completed,
        className:
          "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
        indicatorClassName: "border-emerald-300 bg-emerald-400/90",
      };
    }

    if (isOverdue) {
      return {
        label: labels.overdue,
        className: "bg-destructive/10 text-destructive border-destructive/20",
        indicatorClassName: "border-destructive/50 bg-destructive",
      };
    }

    if (isToday) {
      return {
        label: labels.today,
        className: "bg-primary/10 text-primary border-primary/20",
        indicatorClassName: "border-primary/40 bg-primary/80",
      };
    }

    if (isTomorrow) {
      return {
        label: labels.tomorrow,
        className:
          "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/30",
        indicatorClassName: "border-amber-300 bg-amber-400",
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
                <Badge className={cn("text-xs", statusConfig.className)}>
                  {statusConfig.label}
                </Badge>
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
                  <span className="font-medium text-foreground">
                    {labels.lead}:
                  </span>
                  <span className="text-muted-foreground">{leadName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {activity.reminder_time
                      ? formatTime(activity.reminder_time)
                      : labels.noTime}
                  </span>
                </div>
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
            <div className="flex flex-wrap items-center gap-2 justify-end">
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
              {typeof onNavigateProject === "function" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 text-primary"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onNavigateProject?.();
                  }}
                >
                  {labels.openProject}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
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
  const [visibleReminderCount, setVisibleReminderCount] = useState(
    INITIAL_REMINDER_BATCH
  );
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("today");
  const [showCompleted, setShowCompleted] = useState(false);
  const [hideOverdue, setHideOverdue] = useState(false);
  const navigate = useNavigate();
  const [viewingProject, setViewingProject] = useState<ReminderProject | null>(
    null
  );
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const reminderLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const reminderLoadPendingRef = useRef(false);
  const prevLoadingRef = useRef(true);
  const [editingReminder, setEditingReminder] = useState<Activity | null>(null);
  const [reminderSheetOpen, setReminderSheetOpen] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState<
    string | undefined
  >(undefined);

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
        const leadIds = [
          ...new Set(activitiesData.map((activity) => activity.lead_id)),
        ];
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
    } catch (error: unknown) {
      toast({
        title: "Error fetching reminders",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReminders();
  }, [fetchReminders]);

  // Throttled refresh on focus/visibility
  useThrottledRefetchOnFocus(() => {
    void fetchReminders();
  }, 30_000);

  useEffect(() => {
    if (prevLoadingRef.current && !loading) {
      setVisibleReminderCount(INITIAL_REMINDER_BATCH);
    }
    prevLoadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    setVisibleReminderCount(INITIAL_REMINDER_BATCH);
  }, [selectedFilter, hideOverdue]);

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
    return (
      reminder.getTime() >= startOfWeek.getTime() &&
      reminder.getTime() <= endOfWeek.getTime()
    );
  }, []);

  const isNextWeek = useCallback((reminderDate: string) => {
    const today = new Date();
    const reminder = new Date(reminderDate);
    const nextWeekDate = new Date(today);
    nextWeekDate.setDate(today.getDate() + 7);
    const { start: startOfNextWeek, end: endOfNextWeek } =
      getWeekRange(nextWeekDate);
    startOfNextWeek.setHours(0, 0, 0, 0);
    endOfNextWeek.setHours(23, 59, 59, 999);
    reminder.setHours(0, 0, 0, 0);
    return (
      reminder.getTime() >= startOfNextWeek.getTime() &&
      reminder.getTime() <= endOfNextWeek.getTime()
    );
  }, []);

  const isThisMonth = useCallback((reminderDate: string) => {
    const today = new Date();
    const reminder = new Date(reminderDate);
    return (
      today.getFullYear() === reminder.getFullYear() &&
      today.getMonth() === reminder.getMonth()
    );
  }, []);

  const getReminderCountForFilter = useCallback(
    (filterType: FilterType) => {
      const baseActivities = showCompleted
        ? activities
        : activities.filter((activity) => !activity.completed);

      switch (filterType) {
        case "all":
          return baseActivities.length;
        case "overdue":
          return baseActivities.filter((activity) =>
            isOverdue(activity.reminder_date)
          ).length;
        case "today":
          return baseActivities.filter((activity) =>
            isToday(activity.reminder_date)
          ).length;
        case "tomorrow":
          return baseActivities.filter((activity) =>
            isTomorrow(activity.reminder_date)
          ).length;
        case "thisWeek":
          return baseActivities.filter((activity) =>
            isThisWeek(activity.reminder_date)
          ).length;
        case "nextWeek":
          return baseActivities.filter((activity) =>
            isNextWeek(activity.reminder_date)
          ).length;
        case "thisMonth":
          return baseActivities.filter((activity) =>
            isThisMonth(activity.reminder_date)
          ).length;
        default:
          return baseActivities.length;
      }
    },
    [
      activities,
      showCompleted,
      isOverdue,
      isToday,
      isTomorrow,
      isThisWeek,
      isNextWeek,
      isThisMonth,
    ]
  );

  const quickFilters = useMemo(
    () => [
      {
        key: "all",
        label: t("reminders.filters.all"),
        count: getReminderCountForFilter("all"),
      },
      {
        key: "today",
        label: t("reminders.filters.today"),
        count: getReminderCountForFilter("today"),
      },
      {
        key: "tomorrow",
        label: t("reminders.filters.tomorrow"),
        count: getReminderCountForFilter("tomorrow"),
      },
    ],
    [getReminderCountForFilter, t]
  );

  const allDateFilters = useMemo(
    () => [
      {
        key: "all",
        label: t("reminders.filters.all"),
        count: getReminderCountForFilter("all"),
      },
      {
        key: "overdue",
        label: t("reminders.filters.overdue"),
        count: getReminderCountForFilter("overdue"),
      },
      {
        key: "today",
        label: t("reminders.filters.today"),
        count: getReminderCountForFilter("today"),
      },
      {
        key: "tomorrow",
        label: t("reminders.filters.tomorrow"),
        count: getReminderCountForFilter("tomorrow"),
      },
      {
        key: "thisWeek",
        label: t("reminders.filters.thisWeek"),
        count: getReminderCountForFilter("thisWeek"),
      },
      {
        key: "nextWeek",
        label: t("reminders.filters.nextWeek"),
        count: getReminderCountForFilter("nextWeek"),
      },
      {
        key: "thisMonth",
        label: t("reminders.filters.thisMonth"),
        count: getReminderCountForFilter("thisMonth"),
      },
    ],
    [getReminderCountForFilter, t]
  );

  const stats = useMemo(() => {
    const active = activities.filter((activity) => !activity.completed);
    const overdue = active.filter((activity) =>
      isOverdue(activity.reminder_date)
    ).length;
    const todayCount = active.filter((activity) =>
      isToday(activity.reminder_date)
    ).length;
    const tomorrowCount = active.filter((activity) =>
      isTomorrow(activity.reminder_date)
    ).length;
    const upcoming = active.filter(
      (activity) =>
        !isOverdue(activity.reminder_date) && !isToday(activity.reminder_date)
    ).length;
    const completed = activities.filter(
      (activity) => activity.completed
    ).length;

    return {
      overdue,
      today: todayCount,
      tomorrow: tomorrowCount,
      upcoming,
      completed,
    };
  }, [activities, isOverdue, isToday, isTomorrow]);

  // Upcoming breakdown for CTA buttons and main figure
  const upcomingBreakdown = useMemo(() => {
    const active = activities.filter((a) => !a.completed);
    const tomorrow = active.filter((a) => isTomorrow(a.reminder_date)).length;
    const thisWeek = active.filter(
      (a) =>
        isThisWeek(a.reminder_date) &&
        !isToday(a.reminder_date) &&
        !isTomorrow(a.reminder_date)
    ).length;
    const nextWeek = active.filter((a) => isNextWeek(a.reminder_date)).length;
    const total = tomorrow + thisWeek + nextWeek;
    return { tomorrow, thisWeek, nextWeek, total };
  }, [activities, isThisWeek, isNextWeek, isToday, isTomorrow]);

  // Completion details
  const completedToday = useMemo(
    () =>
      activities.filter((a) => a.completed && isToday(a.reminder_date)).length,
    [activities, isToday]
  );

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
        filteredActive = active.filter((activity) =>
          isOverdue(activity.reminder_date)
        );
        filteredCompleted = completed.filter((activity) =>
          isOverdue(activity.reminder_date)
        );
        break;
      case "today":
        filteredActive = active.filter((activity) =>
          isToday(activity.reminder_date)
        );
        filteredCompleted = completed.filter((activity) =>
          isToday(activity.reminder_date)
        );
        break;
      case "tomorrow":
        filteredActive = active.filter((activity) =>
          isTomorrow(activity.reminder_date)
        );
        filteredCompleted = completed.filter((activity) =>
          isTomorrow(activity.reminder_date)
        );
        break;
      case "thisWeek":
        filteredActive = active.filter((activity) =>
          isThisWeek(activity.reminder_date)
        );
        filteredCompleted = completed.filter((activity) =>
          isThisWeek(activity.reminder_date)
        );
        break;
      case "nextWeek":
        filteredActive = active.filter((activity) =>
          isNextWeek(activity.reminder_date)
        );
        filteredCompleted = completed.filter((activity) =>
          isNextWeek(activity.reminder_date)
        );
        break;
      case "thisMonth":
        filteredActive = active.filter((activity) =>
          isThisMonth(activity.reminder_date)
        );
        filteredCompleted = completed.filter((activity) =>
          isThisMonth(activity.reminder_date)
        );
        break;
      default:
        filteredActive = active;
        filteredCompleted = completed;
        break;
    }

    let finalActive = filteredActive;

    if (selectedFilter !== "overdue") {
      const overdueActivities = active.filter((activity) =>
        isOverdue(activity.reminder_date)
      );
      const nonOverdue = filteredActive.filter(
        (activity) => !isOverdue(activity.reminder_date)
      );
      finalActive = [...overdueActivities, ...nonOverdue];
    }

    if (hideOverdue) {
      finalActive = finalActive.filter(
        (activity) => !isOverdue(activity.reminder_date)
      );
    }

    const visibleCompleted =
      showCompleted || selectedFilter === "all" ? filteredCompleted : [];

    return {
      activeActivities: finalActive,
      completedActivities: visibleCompleted,
    };
  }, [
    activities,
    selectedFilter,
    showCompleted,
    hideOverdue,
    isOverdue,
    isToday,
    isTomorrow,
    isThisWeek,
    isNextWeek,
    isThisMonth,
  ]);

  const groupedActiveActivities = useMemo(
    () => groupActivitiesByDate(activeActivities, "asc"),
    [activeActivities]
  );

  const totalActiveReminders = activeActivities.length;

  const visibleActiveGroups = useMemo(() => {
    if (visibleReminderCount >= totalActiveReminders) {
      return groupedActiveActivities;
    }

    const limited: { date: string; items: Activity[] }[] = [];
    let collected = 0;

    for (const group of groupedActiveActivities) {
      if (collected >= visibleReminderCount) {
        break;
      }
      limited.push(group);
      collected += group.items.length;
    }

    return limited;
  }, [groupedActiveActivities, totalActiveReminders, visibleReminderCount]);

  const hasMoreReminders = visibleReminderCount < totalActiveReminders;

  const handleLoadMoreReminders = useCallback(() => {
    setVisibleReminderCount((prev) => {
      if (prev >= totalActiveReminders) {
        return prev;
      }
      return Math.min(prev + INITIAL_REMINDER_BATCH, totalActiveReminders);
    });
  }, [totalActiveReminders]);

  useEffect(() => {
    if (!hasMoreReminders) {
      return;
    }

    const target = reminderLoadMoreRef.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }
        if (reminderLoadPendingRef.current) {
          return;
        }
        reminderLoadPendingRef.current = true;
        handleLoadMoreReminders();
        window.setTimeout(() => {
          reminderLoadPendingRef.current = false;
        }, 200);
      },
      {
        root: null,
        rootMargin: "320px",
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [handleLoadMoreReminders, hasMoreReminders]);

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
      openProject: t("reminders.timeline.openProject"),
      noTime: tForms("reminders.noTime"),
      overdue: tForms("reminders.overdue"),
      today: tForms("reminders.today"),
      tomorrow: tForms("reminders.tomorrow"),
      completed: tForms("reminders.completed"),
    }),
    [t, tForms]
  );

  // Icon presets to match shared KPI card design
  const overdueIconPreset = useMemo(() => getKpiIconPreset("red"), []);
  const todayIconPreset = useMemo(() => getKpiIconPreset("yellow"), []);
  const upcomingIconPreset = useMemo(() => getKpiIconPreset("sky"), []);
  const completedIconPreset = useMemo(() => getKpiIconPreset("emerald"), []);

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
        title: completed
          ? "Reminder marked as completed"
          : "Reminder marked as not completed",
        description: "Reminder status updated successfully.",
      });
    } catch (error: unknown) {
      toast({
        title: "Error updating reminder",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleReminderClick = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

  const handleProjectClick = useCallback(async (projectId?: string | null) => {
    if (!projectId) return;
    try {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, name, description, lead_id, user_id, created_at, updated_at, status_id, previous_status_id, project_type_id"
        )
        .eq("id", projectId)
        .single();
      if (error) throw error;

      const { data: leadData, error: leadError } = await supabase
        .from("leads")
        .select("id, name, status")
        .eq("id", data.lead_id)
        .single();
      if (leadError) throw leadError;

      setViewingProject(data as ReminderProject);
      setShowProjectDialog(true);
      // Ensure leads map has the project's lead name for the dialog
      setLeads((prev) => {
        const exists = prev.some((l) => l.id === data.lead_id);
        return exists
          ? prev
          : [
              ...prev,
              {
                id: data.lead_id,
                name: leadData?.name || "Unknown Lead",
                status: leadData?.status || "",
              },
            ];
      });
    } catch (error: unknown) {
      toast({
        title: "Unable to open project",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={t("reminders.title")}
        subtitle={t("reminders.description")}
      >
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
              <KpiCard
                className="h-full"
                density="compact"
                icon={BellRing}
                {...overdueIconPreset}
                title={t("reminders.stats.overdue")}
                value={stats.overdue}
                info={{
                  content: t("reminders.statsDescriptions.overdue"),
                  ariaLabel: t("reminders.stats.overdue"),
                }}
              />

              <KpiCard
                className="h-full"
                density="compact"
                icon={SunMedium}
                {...todayIconPreset}
                iconForeground="text-white"
                title={t("reminders.stats.today")}
                value={stats.today}
                info={{
                  content: t("reminders.statsDescriptions.today"),
                  ariaLabel: t("reminders.stats.today"),
                }}
              />

              <KpiCard
                className="h-full"
                density="compact"
                icon={CalendarRange}
                {...upcomingIconPreset}
                title={t("reminders.stats.upcoming")}
                value={upcomingBreakdown.total}
                info={{
                  content: t("reminders.statsDescriptions.upcoming", {
                    tomorrow: upcomingBreakdown.tomorrow,
                    later:
                      upcomingBreakdown.thisWeek + upcomingBreakdown.nextWeek,
                  }),
                  ariaLabel: t("reminders.stats.upcoming"),
                }}
              />

              <KpiCard
                className="h-full"
                density="compact"
                icon={CheckCircle2}
                {...completedIconPreset}
                title={t("reminders.stats.completed")}
                value={stats.completed}
                info={{
                  content: t("reminders.kpis.completedInfo", {
                    today: completedToday,
                    allTime: stats.completed,
                  }),
                  ariaLabel: t("reminders.stats.completed"),
                }}
              />
            </div>

            <div className="md:hidden">
              <FilterBar
                quickFilters={quickFilters}
                activeQuickFilter={selectedFilter}
                onQuickFilterChange={(filter) =>
                  setSelectedFilter(filter as FilterType)
                }
                allDateFilters={allDateFilters}
                activeDateFilter={selectedFilter}
                onDateFilterChange={(filter) =>
                  setSelectedFilter(filter as FilterType)
                }
                showCompleted={showCompleted}
                onShowCompletedChange={setShowCompleted}
                showCompletedLabel={t("reminders.showCompleted")}
                hideOverdue={hideOverdue}
                onHideOverdueChange={setHideOverdue}
                hideOverdueLabel={t("reminders.hideOverdue")}
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
                      onClick={() =>
                        setSelectedFilter(option.key as FilterType)
                      }
                    >
                      <span>{option.label}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          filterPillBadgeBaseClasses,
                          selectedFilter === option.key &&
                            filterPillBadgeActiveClasses
                        )}
                      >
                        {option.count}
                      </Badge>
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {t("reminders.showCompleted")}
                  </span>
                  <Switch
                    checked={showCompleted}
                    onCheckedChange={setShowCompleted}
                  />
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {t("reminders.hideOverdue")}
                  </span>
                  <Switch
                    checked={hideOverdue}
                    onCheckedChange={setHideOverdue}
                  />
                </div>
              </div>
            </div>

            {groupedActiveActivities.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-card/50 p-12 text-center text-muted-foreground">
                <Bell
                  className="mx-auto mb-4 h-12 w-12 opacity-60"
                  aria-hidden="true"
                />
                <h3 className="text-lg font-medium text-foreground">
                  {t("reminders.emptyState.title")}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("reminders.emptyState.description")}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {visibleActiveGroups.map((group) => {
                  const relativeLabel = (() => {
                    if (isToday(group.date))
                      return t("reminders.filters.today");
                    if (isTomorrow(group.date))
                      return t("reminders.filters.tomorrow");
                    if (isOverdue(group.date))
                      return t("reminders.filters.overdue");
                    if (isThisWeek(group.date))
                      return t("reminders.filters.thisWeek");
                    if (isNextWeek(group.date))
                      return t("reminders.filters.nextWeek");
                    if (isThisMonth(group.date))
                      return t("reminders.filters.thisMonth");
                    return null;
                  })();

                  return (
                    <div
                      key={group.date}
                      className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm"
                    >
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
                          <span className="sr-only">
                            {t("reminders.title")}
                          </span>
                        </Badge>
                      </div>
                      <div className="relative mt-6 space-y-6">
                        <div
                          className="absolute left-[11px] top-0 bottom-0 w-px bg-border/60"
                          aria-hidden="true"
                        />
                        {group.items.map((activity) => (
                          <ReminderTimelineItem
                            key={activity.id}
                            activity={activity}
                            leadName={getLeadName(activity.lead_id)}
                            onToggleCompletion={toggleCompletion}
                            onNavigate={() =>
                              handleReminderClick(activity.lead_id)
                            }
                            onNavigateProject={
                              activity.project_id
                                ? () => handleProjectClick(activity.project_id)
                                : undefined
                            }
                            isOverdue={isOverdue(activity.reminder_date)}
                            isToday={isToday(activity.reminder_date)}
                            isTomorrow={isTomorrow(activity.reminder_date)}
                            labels={labels}
                            hasProject={!!activity.project_id}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {hasMoreReminders && (
                  <div
                    ref={reminderLoadMoreRef}
                    className="flex items-center justify-center py-4"
                  >
                    <span className="sr-only">Load more reminders</span>
                  </div>
                )}
              </div>
            )}

            {groupedCompletedActivities.length > 0 && (
              <div className="rounded-2xl border border-border/70 bg-card/60 shadow-sm">
                <Accordion type="single" collapsible>
                  <AccordionItem value="completed" className="border-b-0">
                    <AccordionTrigger className="px-5 text-left text-base font-semibold">
                      {t("reminders.timeline.completedTitle")} (
                      {groupedCompletedActivities.reduce(
                        (acc, group) => acc + group.items.length,
                        0
                      )}
                      )
                    </AccordionTrigger>
                    <AccordionContent className="px-5">
                      <p className="pb-4 text-sm text-muted-foreground">
                        {t("reminders.timeline.completedDescription")}
                      </p>
                      <div className="space-y-4">
                        {groupedCompletedActivities.map((group) => (
                          <div
                            key={`completed-${group.date}`}
                            className="space-y-4"
                          >
                            <div className="text-sm font-medium text-muted-foreground">
                              {formatGroupDate(group.date)}
                            </div>
                            <div className="relative space-y-4">
                              <div
                                className="absolute left-[11px] top-0 bottom-0 w-px bg-border/60"
                                aria-hidden="true"
                              />
                              {group.items.map((activity) => (
                                <ReminderTimelineItem
                                  key={activity.id}
                                  activity={activity}
                                  leadName={getLeadName(activity.lead_id)}
                                  onToggleCompletion={toggleCompletion}
                                  onNavigate={() =>
                                    handleReminderClick(activity.lead_id)
                                  }
                                  onNavigateProject={
                                    activity.project_id
                                      ? () =>
                                          handleProjectClick(
                                            activity.project_id
                                          )
                                      : undefined
                                  }
                                  isOverdue={isOverdue(activity.reminder_date)}
                                  isToday={isToday(activity.reminder_date)}
                                  isTomorrow={isTomorrow(
                                    activity.reminder_date
                                  )}
                                  labels={labels}
                                  hasProject={!!activity.project_id}
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
      {viewingProject && (
        <ViewProjectDialog
          project={viewingProject}
          open={showProjectDialog}
          onOpenChange={setShowProjectDialog}
          onProjectUpdated={fetchReminders}
          leadName={getLeadName(viewingProject?.lead_id || "")}
        />
      )}
    </div>
  );
};

export default ReminderDetails;
