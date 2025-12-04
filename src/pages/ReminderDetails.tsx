import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useThrottledRefetchOnFocus } from "@/hooks/useThrottledRefetchOnFocus";
import { useOrganizationTimezone } from "@/hooks/useOrganizationTimezone";
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
import { useNavigate, useSearchParams } from "react-router-dom";
import { ProjectSheetView } from "@/components/ProjectSheetView";
import {
  ReminderTimelineCard,
  type ReminderTimelineCardActivity,
} from "@/components/reminders/ReminderTimelineCard";
import { useProjectSheetController } from "@/hooks/useProjectSheetController";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ReminderEditorSheet,
  type ReminderEditorValues,
} from "@/components/reminders/ReminderEditorSheet";
import {
  Bell,
  BellRing,
  CalendarRange,
  CheckCircle2,
  SunMedium,
} from "lucide-react";
import { cn, formatGroupDate } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { formatInTimeZone } from "date-fns-tz";
import { PageVideoModal } from "@/components/PageVideoModal";
import { usePageVideoPrompt } from "@/hooks/usePageVideoPrompt";

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

type FilterType =
  | "all"
  | "overdue"
  | "today"
  | "tomorrow"
  | "thisWeek"
  | "nextWeek"
  | "thisMonth";

const filterPillBaseClasses =
  "h-9 rounded-full px-3 border border-border/60 bg-background text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0";
const filterPillActiveClasses =
  "bg-primary/10 text-primary border-primary/40 shadow-sm hover:bg-primary/15";
const filterPillBadgeBaseClasses =
  "ml-2 h-5 min-w-[2rem] rounded-full border border-border/50 bg-muted/40 px-2 text-xs font-medium text-muted-foreground transition-colors";
const filterPillBadgeActiveClasses =
  "border-primary/30 bg-primary/15 text-primary";

const INITIAL_REMINDER_BATCH = 25;
const FILTER_OPTIONS: FilterType[] = [
  "all",
  "overdue",
  "today",
  "tomorrow",
  "thisWeek",
  "nextWeek",
  "thisMonth",
];

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
  order: "asc" | "desc" = "asc",
  normalizeDate?: (value?: string | null) => string | null
) => {
  const groups = new Map<string, Activity[]>();

  activities.forEach((activity) => {
    const normalizedDate =
      normalizeDate?.(activity.reminder_date) ?? activity.reminder_date;
    if (!normalizedDate) return;
    const existing = groups.get(normalizedDate);
    if (existing) {
      existing.push(activity);
    } else {
      groups.set(normalizedDate, [activity]);
    }
  });

  const sortedEntries = Array.from(groups.entries()).sort((a, b) => {
    return a[0].localeCompare(b[0]);
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

const getReminderDateOnly = (value?: string | null) => {
  if (!value) return "";
  return value.split("T")[0] ?? value;
};

const buildReminderDateTimeValue = (
  reminder?: ReminderTimelineCardActivity | null
) => {
  const datePart = getReminderDateOnly(reminder?.reminder_date);
  if (!datePart) return "";
  return reminder?.reminder_time
    ? `${datePart}T${reminder.reminder_time}`
    : datePart;
};

const parseReminderDateTime = (value: string) => {
  const [date, time] = value.split("T");
  return { date, time: time ?? null };
};

const REMINDERS_VIDEO_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_REMINDERS_VIDEO_ID) ||
  "IQ8ZNqhjhDQ";

const ReminderDetails = () => {
  const { t, i18n } = useTranslation("pages");
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
  const [searchParams] = useSearchParams();
  const appliedInitialFiltersRef = useRef(false);
  const reminderLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const reminderLoadPendingRef = useRef(false);
  const prevLoadingRef = useRef(true);
  const [editingReminder, setEditingReminder] =
    useState<ReminderTimelineCardActivity | null>(null);
  const [reminderSheetOpen, setReminderSheetOpen] = useState(false);
  const [reminderSheetSubmitting, setReminderSheetSubmitting] = useState(false);
  const {
    isOpen: isRemindersVideoOpen,
    close: closeRemindersVideo,
    markCompleted: markRemindersVideoWatched,
    snooze: snoozeRemindersVideo
  } = usePageVideoPrompt({ pageKey: "reminders", snoozeDays: 1 });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reminderToDelete, setReminderToDelete] =
    useState<ReminderTimelineCardActivity | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const { timezone } = useOrganizationTimezone();

  const reminderEditorInitialValues = useMemo<
    ReminderEditorValues | undefined
  >(() => {
    if (!editingReminder) return undefined;
    const reminderDate = getReminderDateOnly(editingReminder.reminder_date);
    return {
      content: editingReminder.content,
      reminderDate,
      reminderDateTime: buildReminderDateTimeValue(editingReminder),
      reminderTime: editingReminder.reminder_time,
    };
  }, [editingReminder]);

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

  useEffect(() => {
    if (appliedInitialFiltersRef.current) return;
    const filterParam = searchParams.get("filter");
    if (
      filterParam &&
      FILTER_OPTIONS.includes(filterParam as FilterType)
    ) {
      setSelectedFilter(filterParam as FilterType);
    }
    const hideParam = searchParams.get("hideOverdue");
    if (hideParam && (hideParam === "1" || hideParam === "true")) {
      setHideOverdue(true);
    }
    appliedInitialFiltersRef.current = true;
  }, [searchParams]);

  const getLeadName = useCallback(
    (leadId: string) => {
      const lead = leads.find((item) => item.id === leadId);
      return lead?.name || "Unknown Lead";
    },
    [leads]
  );

  const resolveLeadName = useCallback(
    (leadId: string) => getLeadName(leadId),
    [getLeadName]
  );

  const handleDialogLeadResolved = useCallback((lead: {
    id: string;
    name: string;
    status?: string | null;
  }) => {
    setLeads((prev) => {
      const exists = prev.some((item) => item.id === lead.id);
      if (exists) return prev;
      return [
        ...prev,
        { id: lead.id, name: lead.name, status: lead.status || "" },
      ];
    });
  }, []);

  const {
    viewingProject,
    projectSheetOpen,
    onProjectSheetOpenChange,
    projectSheetLeadName,
    openProjectSheet,
  } = useProjectSheetController({
    resolveLeadName,
    onLeadResolved: handleDialogLeadResolved,
  });

  const normalizeReminderDate = useCallback(
    (reminderDate?: string | null) => {
      if (!reminderDate) return null;
      try {
        return formatInTimeZone(new Date(reminderDate), timezone, "yyyy-MM-dd");
      } catch {
        return null;
      }
    },
    [timezone]
  );

  const todayIso = useMemo(
    () => formatInTimeZone(new Date(), timezone, "yyyy-MM-dd"),
    [timezone]
  );

  const tomorrowIso = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatInTimeZone(tomorrow, timezone, "yyyy-MM-dd");
  }, [timezone]);

  const weekStartsOnMonday = useMemo(() => {
    const locale = i18n.language?.toLowerCase() ?? "";
    return (
      locale.startsWith("tr") ||
      locale.startsWith("de") ||
      locale.startsWith("fr") ||
      locale.startsWith("es") ||
      locale.startsWith("it") ||
      locale.startsWith("nl") ||
      locale.startsWith("pl")
    );
  }, [i18n.language]);

  const {
    weekStartIso,
    weekEndIso,
    nextWeekStartIso,
    nextWeekEndIso,
  } = useMemo(() => {
    const parseIsoToUtc = (iso: string) => {
      const [year, month, day] = iso.split("-").map(Number);
      if ([year, month, day].some((value) => Number.isNaN(value))) {
        return null;
      }
      return new Date(Date.UTC(year, month - 1, day));
    };

    const toIso = (date: Date) => date.toISOString().split("T")[0];
    const anchorDate = parseIsoToUtc(todayIso);

    if (!anchorDate) {
      return {
        weekStartIso: todayIso,
        weekEndIso: todayIso,
        nextWeekStartIso: todayIso,
        nextWeekEndIso: todayIso,
      };
    }

    const day = anchorDate.getUTCDay();
    const daysToSubtract = weekStartsOnMonday ? (day === 0 ? 6 : day - 1) : day;

    const start = new Date(anchorDate);
    start.setUTCDate(anchorDate.getUTCDate() - daysToSubtract);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);

    const nextStart = new Date(start);
    nextStart.setUTCDate(start.getUTCDate() + 7);
    const nextEnd = new Date(nextStart);
    nextEnd.setUTCDate(nextStart.getUTCDate() + 6);

    return {
      weekStartIso: toIso(start),
      weekEndIso: toIso(end),
      nextWeekStartIso: toIso(nextStart),
      nextWeekEndIso: toIso(nextEnd),
    };
  }, [todayIso, weekStartsOnMonday]);

  const isOverdue = useCallback(
    (reminderDate: string) => {
      const normalized = normalizeReminderDate(reminderDate);
      if (!normalized) return false;
      return normalized < todayIso;
    },
    [normalizeReminderDate, todayIso]
  );

  const isToday = useCallback(
    (reminderDate: string) => normalizeReminderDate(reminderDate) === todayIso,
    [normalizeReminderDate, todayIso]
  );

  const isTomorrow = useCallback(
    (reminderDate: string) =>
      normalizeReminderDate(reminderDate) === tomorrowIso,
    [normalizeReminderDate, tomorrowIso]
  );

  const isThisWeek = useCallback(
    (reminderDate: string) => {
      const normalized = normalizeReminderDate(reminderDate);
      if (!normalized) return false;
      return normalized >= weekStartIso && normalized <= weekEndIso;
    },
    [normalizeReminderDate, weekEndIso, weekStartIso]
  );

  const isNextWeek = useCallback(
    (reminderDate: string) => {
      const normalized = normalizeReminderDate(reminderDate);
      if (!normalized) return false;
      return normalized >= nextWeekStartIso && normalized <= nextWeekEndIso;
    },
    [normalizeReminderDate, nextWeekEndIso, nextWeekStartIso]
  );

  const isThisMonth = useCallback(
    (reminderDate: string) => {
      const normalized = normalizeReminderDate(reminderDate);
      if (!normalized) return false;
      return normalized.slice(0, 7) === todayIso.slice(0, 7);
    },
    [normalizeReminderDate, todayIso]
  );

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
    () => groupActivitiesByDate(activeActivities, "asc", normalizeReminderDate),
    [activeActivities, normalizeReminderDate]
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
    () =>
      groupActivitiesByDate(
        completedActivities,
        "desc",
        normalizeReminderDate
      ),
    [completedActivities, normalizeReminderDate]
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
          ? tForms("reminders.markCompleteSuccessTitle")
          : tForms("reminders.markIncompleteSuccessTitle"),
        description: tForms("reminders.statusUpdateDescription"),
      });
    } catch (error: unknown) {
      toast({
        title: tForms("reminders.statusUpdateErrorTitle"),
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleReminderClick = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

  const handleReminderSheetOpenChange = useCallback((open: boolean) => {
    setReminderSheetOpen(open);
    if (!open) {
      setEditingReminder(null);
    }
  }, []);

  const handleEditReminderRequest = useCallback(
    (activity: ReminderTimelineCardActivity) => {
      setEditingReminder(activity);
      setReminderSheetOpen(true);
    },
    []
  );

  const handleDeleteReminderRequest = useCallback(
    (activity: ReminderTimelineCardActivity) => {
      setReminderToDelete(activity);
      setDeleteDialogOpen(true);
    },
    []
  );

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setReminderToDelete(null);
    }
  }, []);

  const handleReminderUpdate = useCallback(
    async (values: ReminderEditorValues) => {
      if (!editingReminder) return;
      const { date, time } = parseReminderDateTime(values.reminderDateTime);
      setReminderSheetSubmitting(true);
      try {
        const { error } = await supabase
          .from("activities")
          .update({
            content: values.content,
            reminder_date: date,
            reminder_time: time,
          })
          .eq("id", editingReminder.id);

        if (error) throw error;

        setActivities((prev) =>
          prev.map((activity) =>
            activity.id === editingReminder.id
              ? {
                ...activity,
                content: values.content,
                reminder_date: date,
                reminder_time: time,
              }
              : activity
          )
        );

        toast({
          title: tForms("reminders.updateSuccessTitle"),
          description: tForms("reminders.updateSuccessDescription"),
        });

        handleReminderSheetOpenChange(false);
        void fetchReminders();
      } catch (error: unknown) {
        toast({
          title: tForms("reminders.updateErrorTitle"),
          description: getErrorMessage(error),
          variant: "destructive",
        });
      } finally {
        setReminderSheetSubmitting(false);
      }
    },
    [editingReminder, fetchReminders, handleReminderSheetOpenChange, tForms]
  );

  const handleConfirmDeleteReminder = useCallback(async () => {
    if (!reminderToDelete) return;
    setDeleteSubmitting(true);
    try {
      const { error } = await supabase
        .from("activities")
        .delete()
        .eq("id", reminderToDelete.id);

      if (error) throw error;

      setActivities((prev) =>
        prev.filter((activity) => activity.id !== reminderToDelete.id)
      );

      toast({
        title: tForms("reminders.deleteSuccessTitle"),
        description: tForms("reminders.deleteSuccessDescription"),
      });

      handleDeleteDialogOpenChange(false);
      void fetchReminders();
    } catch (error: unknown) {
      toast({
        title: tForms("reminders.deleteErrorTitle"),
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setDeleteSubmitting(false);
    }
  }, [
    fetchReminders,
    handleDeleteDialogOpenChange,
    reminderToDelete,
    tForms,
  ]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={t("reminders.title")}
        helpTitle={t("reminders.video.title", { defaultValue: "2 dakikalık hızlı tur" })}
        helpDescription={t("reminders.video.description", {
          defaultValue: "Hatırlatıcıları en iyi nasıl kullanacağınızı kısaca görün."
        })}
        helpVideoId={REMINDERS_VIDEO_ID}
        helpVideoTitle={t("reminders.video.title", { defaultValue: "See how Reminders works" })}
      >
        <PageHeaderSearch>
          <GlobalSearch variant="header" />
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
              <EmptyState
                icon={Bell}
                iconVariant="pill"
                iconColor="emerald"
                title={t("reminders.emptyState.title")}
                description={t("reminders.emptyState.description")}
              />
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
                          <ReminderTimelineCard
                            key={activity.id}
                            activity={activity}
                            leadName={getLeadName(activity.lead_id)}
                            onToggleCompletion={toggleCompletion}
                            onOpenLead={() =>
                              handleReminderClick(activity.lead_id)
                            }
                            onOpenProject={
                              activity.project_id
                                ? () => openProjectSheet(activity.project_id)
                                : undefined
                            }
                            showStatusIndicator
                            onEditReminder={handleEditReminderRequest}
                            onDeleteReminder={handleDeleteReminderRequest}
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
                                <ReminderTimelineCard
                                  key={activity.id}
                                  activity={activity}
                                  leadName={getLeadName(activity.lead_id)}
                                  onToggleCompletion={toggleCompletion}
                                  onOpenLead={() =>
                                    handleReminderClick(activity.lead_id)
                                  }
                                  onOpenProject={
                                    activity.project_id
                                      ? () => openProjectSheet(
                                        activity.project_id
                                      )
                                      : undefined
                                  }
                                  showStatusIndicator
                                  onEditReminder={handleEditReminderRequest}
                                  onDeleteReminder={handleDeleteReminderRequest}
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
      <ReminderEditorSheet
        open={reminderSheetOpen && Boolean(editingReminder)}
        onOpenChange={handleReminderSheetOpenChange}
        mode={editingReminder ? "edit" : "create"}
        initialValues={reminderEditorInitialValues}
        onSubmit={handleReminderUpdate}
        submitting={reminderSheetSubmitting}
      />

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tForms("reminders.deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tForms("reminders.deleteConfirmDescription", {
                content: reminderToDelete?.content ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>
              {tForms("reminders.deleteCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteReminder}
              disabled={deleteSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSubmitting
                ? tForms("reminders.deleteSubmitting")
                : tForms("reminders.deleteConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProjectSheetView
        project={viewingProject}
        open={projectSheetOpen}
        onOpenChange={onProjectSheetOpenChange}
        onProjectUpdated={fetchReminders}
        onActivityUpdated={fetchReminders}
        leadName={projectSheetLeadName}
        mode="sheet"
        onViewFullDetails={() => {
          if (viewingProject) {
            onProjectSheetOpenChange(false);
            navigate(`/projects/${viewingProject.id}`);
          }
        }}
      />

      <PageVideoModal
        open={isRemindersVideoOpen}
        onClose={closeRemindersVideo}
        videoId={REMINDERS_VIDEO_ID}
        title={t("reminders.video.title", { defaultValue: "See how Reminders works" })}
        description={t("reminders.video.description", {
          defaultValue: "Watch a quick overview to make the most of your reminders."
        })}
        labels={{
          remindMeLater: t("reminders.video.remindLater", { defaultValue: "Remind me later" }),
          dontShowAgain: t("reminders.video.dontShow", { defaultValue: "I watched, don't show again" })
        }}
        onSnooze={snoozeRemindersVideo}
        onDontShowAgain={markRemindersVideoWatched}
      />
    </div>
  );
};

export default ReminderDetails;
