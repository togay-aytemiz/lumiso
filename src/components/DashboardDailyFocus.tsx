import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { Trans } from "react-i18next";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronRight,
  Circle,
  Coins,
  FolderOpen,
  Loader2,
  MapPin,
  Sparkles,
  StickyNote,
  TrendingUp,
  Users
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { formatTime, getUserLocale } from "@/lib/utils";
import { useDashboardTranslation } from "@/hooks/useTypedTranslation";
import { ADD_ACTION_EVENTS, type AddActionType, type AddActionEventDetail } from "@/constants/addActionEvents";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SessionSheetView from "@/components/SessionSheetView";
import { computeLeadInitials } from "@/components/leadInitialsUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useProjectSheetController } from "@/hooks/useProjectSheetController";
import { ProjectSheetView } from "@/components/ProjectSheetView";
import { useOrganizationTimezone } from "@/hooks/useOrganizationTimezone";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import StatCard from "@/components/StatCard";
import { useProfile } from "@/hooks/useProfile";
import { formatInTimeZone } from "date-fns-tz";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type LeadWithLifecycleRow = LeadRow & {
  lead_statuses?: {
    lifecycle?: string | null;
    is_system_final?: boolean | null;
    name?: string | null;
  } | null;
};
type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type SessionSummaryRow = Pick<SessionRow, "id" | "session_date" | "status" | "created_at">;
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type PaymentSummaryRow = Pick<
  PaymentRow,
  | "id"
  | "amount"
  | "status"
  | "entry_kind"
  | "log_timestamp"
  | "date_paid"
  | "created_at"
  | "scheduled_initial_amount"
  | "scheduled_remaining_amount"
>;

export type SessionWithLead = SessionRow & { lead_name?: string };

interface DashboardDailyFocusProps {
  leads: LeadWithLifecycleRow[];
  sessions: SessionWithLead[];
  activities: ActivityRow[];
  loading: boolean;
  userName?: string | null;
  inactiveLeadCount: number;
  sessionStats: SessionSummaryRow[];
  paymentStats: PaymentSummaryRow[];
  scheduledPayments: PaymentSummaryRow[];
  outstandingBalance: number;
}

type TimelineItem =
  | {
      type: "session";
      id: string;
      time: string;
      displayTime: string;
      sortValue: number;
      data: SessionWithLead;
    }
  | {
      type: "reminder";
      id: string;
      time: string;
      displayTime: string;
      sortValue: number;
      data: ActivityRow & { leadName?: string | null; projectName?: string | null };
    }
  | {
      type: "now";
      id: string;
      time: string;
      displayTime: string;
      sortValue: number;
    };

type DaySegment = "night" | "morning" | "midday" | "evening";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const isoDateToUtcMs = (iso: string) => {
  const [year, month, day] = iso.split("-").map((value) => parseInt(value, 10));
  return Date.UTC(year, month - 1, day);
};

const parseTimeToMinutes = (timeString: string) => {
  const [hours, minutes] = timeString.split(":").map((value) => parseInt(value, 10));
  return hours * 60 + (minutes || 0);
};

const formatReminderTime = (timeString?: string | null, fallbackLabel?: string) => {
  if (!timeString) return fallbackLabel ?? "All Day";
  const [hours, minutes] = timeString.split(":");
  return formatTime(`${hours?.padStart(2, "0")}:${minutes?.padStart(2, "0")}`);
};

const getReminderSortValue = (timeString?: string | null) => {
  if (!timeString) {
    return 24 * 60;
  }
  const [hours, minutes] = timeString.split(":").map((value) => parseInt(value, 10));
  return hours * 60 + (minutes || 0);
};

const getDaySegment = (hour: number): DaySegment => {
  if (hour >= 22 || hour < 5) {
    return "night";
  }
  if (hour < 12) {
    return "morning";
  }
  if (hour < 18) {
    return "midday";
  }
  return "evening";
};

const getSessionTheme = (session: SessionWithLead) => {
  const label = (session.session_name || session.status || "").toLowerCase();

  if (label.includes("wedding")) {
    return {
      border: "bg-rose-500",
      badge: "bg-rose-50 text-rose-700",
      icon: "text-rose-500"
    };
  }
  if (label.includes("portrait")) {
    return {
      border: "bg-violet-500",
      badge: "bg-violet-50 text-violet-700",
      icon: "text-violet-500"
    };
  }
  if (label.includes("commercial")) {
    return {
      border: "bg-blue-500",
      badge: "bg-blue-50 text-blue-700",
      icon: "text-blue-500"
    };
  }
  if (label.includes("family")) {
    return {
      border: "bg-emerald-500",
      badge: "bg-emerald-50 text-emerald-700",
      icon: "text-emerald-500"
    };
  }

  return {
    border: "bg-slate-500",
    badge: "bg-slate-100 text-slate-700",
    icon: "text-slate-500"
  };
};

const PLANNED_SESSION_STATUSES = new Set(["planned", "scheduled", "upcoming", "confirmed"]);

const AuroraBackground = () => (
  <div className="absolute inset-0 bg-slate-900">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#4f46e5_0%,transparent_60%)] opacity-40 mix-blend-screen" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,#06b6d4_0%,transparent_50%)] opacity-30 mix-blend-screen" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_80%,#9333ea_0%,transparent_50%)] opacity-30 mix-blend-screen" />
    <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-slate-950 via-slate-900/50 to-transparent" />
  </div>
);

const LightAuroraBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute -top-[40%] -right-[20%] w-[100%] h-[100%] bg-blue-200/50 rounded-full blur-[100px]" />
    <div className="absolute -bottom-[40%] -left-[20%] w-[100%] h-[100%] bg-teal-200/40 rounded-full blur-[100px]" />
    <div className="absolute top-[20%] left-[30%] w-[70%] h-[70%] bg-fuchsia-200/40 rounded-full blur-[120px]" />
  </div>
);

const DashboardDailyFocus = ({
  leads,
  sessions,
  activities,
  loading,
  userName,
  inactiveLeadCount,
  sessionStats,
  paymentStats,
  scheduledPayments,
  outstandingBalance
}: DashboardDailyFocusProps) => {
  const { timezone, timeFormat } = useOrganizationTimezone();
  const [now, setNow] = useState(new Date());
  const { t, i18n } = useDashboardTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionSheetOpen, setIsSessionSheetOpen] = useState(false);
  const [completingReminderId, setCompletingReminderId] = useState<string | null>(null);
  const [projectLookup, setProjectLookup] = useState<Record<string, string>>({});
  const [leadTimeframe, setLeadTimeframe] = useState<"mtd" | "ytd">("mtd");
  const [sessionTimeframe, setSessionTimeframe] = useState<"mtd" | "ytd">("mtd");
  const [revenueTimeframe, setRevenueTimeframe] = useState<"mtd" | "ytd">("mtd");
  const getLeadInitials = useCallback(
    (name?: string | null) => computeLeadInitials(name, "??", 2),
    []
  );
  const { toast } = useToast();
  const [activityList, setActivityList] = useState<ActivityRow[]>(activities);

  useEffect(() => {
    setActivityList(activities);
  }, [activities]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const locale = i18n.language || getUserLocale();
  const todayIso = useMemo(
    () => formatInTimeZone(now, timezone, "yyyy-MM-dd"),
    [now, timezone]
  );
  const tomorrowIso = useMemo(() => {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatInTimeZone(tomorrow, timezone, "yyyy-MM-dd");
  }, [now, timezone]);

  const middayVariants = useMemo(() => {
    const phrases = t("daily_focus.greetings.midday_variants", {
      returnObjects: true
    }) as string[] | string;
    return Array.isArray(phrases) ? phrases : [];
  }, [t]);

  const dateBoundaries = useMemo(() => {
    const reference = now;
    const startOfMonth = new Date(reference.getFullYear(), reference.getMonth(), 1);
    const startOfPrevMonth = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(reference.getFullYear(), reference.getMonth(), 0, 23, 59, 59, 999);
    const startOfYear = new Date(reference.getFullYear(), 0, 1);
    const startOfLastYear = new Date(reference.getFullYear() - 1, 0, 1);
    const endOfLastYear = new Date(reference.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    return {
      startOfMonth,
      startOfPrevMonth,
      endOfPrevMonth,
      startOfYear,
      startOfLastYear,
      endOfLastYear,
      now: reference
    };
  }, [now]);

  const sessionBoundaryIsos = useMemo(() => {
    const isoFor = (date: Date) => formatInTimeZone(date, timezone, "yyyy-MM-dd");
    const reference = now;
    const startOfMonth = new Date(reference.getFullYear(), reference.getMonth(), 1);
    const startOfPrevMonth = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(reference.getFullYear(), reference.getMonth(), 0);
    const startOfYear = new Date(reference.getFullYear(), 0, 1);
    const startOfLastYear = new Date(reference.getFullYear() - 1, 0, 1);
    const endOfLastYear = new Date(reference.getFullYear() - 1, 11, 31);
    return {
      monthStartIso: isoFor(startOfMonth),
      previousMonthStartIso: isoFor(startOfPrevMonth),
      previousMonthEndIso: isoFor(endOfPrevMonth),
      yearStartIso: isoFor(startOfYear),
      lastYearStartIso: isoFor(startOfLastYear),
      lastYearEndIso: isoFor(endOfLastYear)
    };
  }, [now, timezone]);

  const isDateWithinRange = (value: string | null | undefined, start: Date, end: Date) => {
    if (!value) return false;
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return false;
    return timestamp >= start.getTime() && timestamp <= end.getTime();
  };

  const deriveLeadLifecycle = (lead: LeadWithLifecycleRow) => {
    const lifecycle = lead.lead_statuses?.lifecycle?.toLowerCase().trim();
    if (lifecycle) {
      return lifecycle;
    }
    if (lead.lead_statuses?.is_system_final) {
      return "closed";
    }
    const normalizedStatus = (lead.status || "").toLowerCase();
    if (
      ["lost", "completed", "archived", "inactive", "closed", "cancelled"].some((keyword) =>
        normalizedStatus.includes(keyword)
      )
    ) {
      return "closed";
    }
    return "active";
  };

  const isLeadActive = useCallback(
    (lead: LeadWithLifecycleRow) => deriveLeadLifecycle(lead) === "active",
    []
  );

  const isPlannedSession = (status?: string | null) =>
    PLANNED_SESSION_STATUSES.has((status || "").toLowerCase());

  const getPaymentTimestamp = (payment: PaymentSummaryRow): number | null => {
    const rawDate = payment.log_timestamp || payment.date_paid || payment.created_at;
    if (!rawDate) return null;
    const parsed = new Date(rawDate).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  };

  const isPaidPayment = (payment: PaymentSummaryRow) => {
    const normalizedStatus = (payment.status || "").toLowerCase();
    return normalizedStatus === "paid" && Number(payment.amount ?? 0) > 0;
  };

  const isTimestampWithin = (timestamp: number | null, start: Date, end: Date) => {
    if (timestamp == null) return false;
    return timestamp >= start.getTime() && timestamp <= end.getTime();
  };

  const getTrendDirection = (value: number): "up" | "down" | "flat" => {
    if (value > 0) return "up";
    if (value < 0) return "down";
    return "flat";
  };

  const getTrendTone = (value: number): "positive" | "negative" | "neutral" => {
    if (value > 0) return "positive";
    if (value < 0) return "negative";
    return "neutral";
  };

  const formatInteger = (value: number) =>
    value.toLocaleString(locale, { maximumFractionDigits: 0 });

  const formatSignedInteger = (value: number) => {
    if (value === 0) return "0";
    const formatted = formatInteger(Math.abs(value));
    return value > 0 ? `+${formatted}` : `-${formatted}`;
  };

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }),
    []
  );

  const currencySymbol = useMemo(() => {
    const parts = currencyFormatter.formatToParts(0);
    const symbol = parts.find((part) => part.type === "currency")?.value;
    return symbol || currencyFormatter.resolvedOptions().currency || "TRY";
  }, [currencyFormatter]);

  const formatCurrencyValue = (value: number) => formatInteger(Math.round(value));

  const formatSignedCurrency = (value: number) => {
    if (value === 0) return currencyFormatter.format(0);
    const formatted = currencyFormatter.format(Math.round(Math.abs(value)));
    return value > 0 ? `+${formatted}` : `-${formatted}`;
  };

  const renderCurrencyValue = (value: number) => (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-xl font-semibold text-slate-500">{currencySymbol}</span>
      <span>{formatCurrencyValue(value)}</span>
    </span>
  );

  const leadMetrics = useMemo(() => {
    const {
      startOfMonth,
      startOfPrevMonth,
      endOfPrevMonth,
      startOfYear,
      startOfLastYear,
      endOfLastYear,
      now: current
    } = dateBoundaries;

    let activeLeadsThisMonth = 0;
    let activeLeadsPreviousMonth = 0;
    let totalLeadsYtd = 0;
    let totalLeadsLastYear = 0;

    leads.forEach((lead) => {
      if (isLeadActive(lead)) {
        if (isDateWithinRange(lead.created_at, startOfMonth, current)) {
          activeLeadsThisMonth += 1;
        } else if (isDateWithinRange(lead.created_at, startOfPrevMonth, endOfPrevMonth)) {
          activeLeadsPreviousMonth += 1;
        }
      }

      if (isDateWithinRange(lead.created_at, startOfYear, current)) {
        totalLeadsYtd += 1;
      } else if (isDateWithinRange(lead.created_at, startOfLastYear, endOfLastYear)) {
        totalLeadsLastYear += 1;
      }
    });

    return {
      activeLeadsThisMonth,
      activeLeadsPreviousMonth,
      totalLeadsYtd,
      totalLeadsLastYear
    };
  }, [leads, dateBoundaries, isLeadActive]);

  const sessionMetrics = useMemo(() => {
    const {
      monthStartIso,
      previousMonthStartIso,
      previousMonthEndIso,
      yearStartIso,
      lastYearStartIso,
      lastYearEndIso
    } = sessionBoundaryIsos;

    let plannedThisMonth = 0;
    let plannedPreviousMonth = 0;
    let createdYtd = 0;
    let createdLastYear = 0;
    let upcomingPlanned = 0;

    sessionStats.forEach((session) => {
      const date = session.session_date;
      if (date >= yearStartIso && date <= todayIso) {
        createdYtd += 1;
      } else if (date >= lastYearStartIso && date <= lastYearEndIso) {
        createdLastYear += 1;
      }

      if (isPlannedSession(session.status)) {
        if (date >= monthStartIso && date <= todayIso) {
          plannedThisMonth += 1;
        } else if (date >= previousMonthStartIso && date <= previousMonthEndIso) {
          plannedPreviousMonth += 1;
        }

        if (date >= todayIso) {
          upcomingPlanned += 1;
        }
      }
    });

    return {
      plannedThisMonth,
      plannedPreviousMonth,
      createdYtd,
      createdLastYear,
      upcomingPlanned
    };
  }, [sessionStats, sessionBoundaryIsos, todayIso]);

  const revenueMetrics = useMemo(() => {
    const {
      startOfMonth,
      startOfPrevMonth,
      endOfPrevMonth,
      startOfYear,
      startOfLastYear,
      endOfLastYear,
      now: current
    } = dateBoundaries;

    const sumInRange = (start: Date, end: Date) =>
      paymentStats.reduce((sum, payment) => {
        if (!isPaidPayment(payment)) {
          return sum;
        }
        const timestamp = getPaymentTimestamp(payment);
        if (!isTimestampWithin(timestamp, start, end)) {
          return sum;
        }
        return sum + Number(payment.amount ?? 0);
      }, 0);

    return {
      paidThisMonth: sumInRange(startOfMonth, current),
      paidPreviousMonth: sumInRange(startOfPrevMonth, endOfPrevMonth),
      paidYtd: sumInRange(startOfYear, current),
      paidLastYear: sumInRange(startOfLastYear, endOfLastYear)
    };
  }, [paymentStats, dateBoundaries]);

  const leadValue =
    leadTimeframe === "mtd" ? leadMetrics.activeLeadsThisMonth : leadMetrics.totalLeadsYtd;
  const leadComparison =
    leadTimeframe === "mtd"
      ? leadMetrics.activeLeadsThisMonth - leadMetrics.activeLeadsPreviousMonth
      : leadMetrics.totalLeadsYtd - leadMetrics.totalLeadsLastYear;

  const sessionValue =
    sessionTimeframe === "mtd" ? sessionMetrics.plannedThisMonth : sessionMetrics.createdYtd;
  const sessionComparison =
    sessionTimeframe === "mtd"
      ? sessionMetrics.plannedThisMonth - sessionMetrics.plannedPreviousMonth
      : sessionMetrics.createdYtd - sessionMetrics.createdLastYear;

  const revenueValue =
    revenueTimeframe === "mtd" ? revenueMetrics.paidThisMonth : revenueMetrics.paidYtd;
  const revenueComparison =
    revenueTimeframe === "mtd"
      ? revenueMetrics.paidThisMonth - revenueMetrics.paidPreviousMonth
      : revenueMetrics.paidYtd - revenueMetrics.paidLastYear;

  const timeframeToggleLabels = useMemo(
    () => ({
      month: t("daily_focus.stats.toggle.month_short"),
      year: t("daily_focus.stats.toggle.year_short"),
      monthAria: t("daily_focus.stats.toggle.month_aria"),
      yearAria: t("daily_focus.stats.toggle.year_aria")
    }),
    [t]
  );

  const getTimeframeLabel = (timeframe: "mtd" | "ytd") =>
    timeframe === "mtd"
      ? t("daily_focus.stats.labels.this_month")
      : t("daily_focus.stats.labels.year_to_date");

  const getSectionLabel = (section: "leads" | "schedule" | "finance" | "action") =>
    t(`daily_focus.stats.sections.${section}`);

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        if (a.session_date === b.session_date) {
          return a.session_time.localeCompare(b.session_time);
        }
        return a.session_date.localeCompare(b.session_date);
      }),
    [sessions]
  );

  const todaysSessions = useMemo(
    () => sortedSessions.filter((session) => session.session_date === todayIso),
    [sortedSessions, todayIso]
  );

  const currentHour = Number(formatInTimeZone(now, timezone, "H"));
  const currentMinute = Number(formatInTimeZone(now, timezone, "m"));
  const nowMinutes = currentHour * 60 + currentMinute;

  const nextSession = useMemo(() => {
    return sortedSessions.find((session) => {
      if (session.session_date > todayIso) {
        return true;
      }
      if (session.session_date < todayIso) {
        return false;
      }
      return parseTimeToMinutes(session.session_time) >= nowMinutes;
    });
  }, [sortedSessions, todayIso, nowMinutes]);

  const laterSessions = useMemo(() => {
    if (!nextSession) return [];
    const nextSessionMinutes = parseTimeToMinutes(nextSession.session_time);
    return sortedSessions.filter(
      (session) =>
        session.session_date === nextSession.session_date &&
        parseTimeToMinutes(session.session_time) > nextSessionMinutes
    );
  }, [nextSession, sortedSessions]);

  const nextSessionTimingLabel = useMemo(() => {
    if (!nextSession) return null;
    if (nextSession.session_date === todayIso) {
      return t("daily_focus.up_next_labels.today", { defaultValue: "Today" });
    }
    if (nextSession.session_date === tomorrowIso) {
      return t("daily_focus.up_next_labels.tomorrow", { defaultValue: "Tomorrow" });
    }
    const diffInDays = Math.round(
      (isoDateToUtcMs(nextSession.session_date) - isoDateToUtcMs(todayIso)) / MS_PER_DAY
    );
    const formatOptions: Intl.DateTimeFormatOptions =
      Number.isFinite(diffInDays) && diffInDays <= 6
        ? { weekday: "long" }
        : { month: "short", day: "numeric" };
    try {
      return new Intl.DateTimeFormat(locale, { ...formatOptions, timeZone: "UTC" }).format(
        new Date(isoDateToUtcMs(nextSession.session_date))
      );
    } catch {
      return nextSession.session_date;
    }
  }, [locale, nextSession, t, todayIso, tomorrowIso]);

  const leadLookup = useMemo(() => {
    return leads.reduce<Record<string, string>>((acc, lead) => {
      acc[lead.id] = lead.name;
      return acc;
    }, {});
  }, [leads]);

  useEffect(() => {
    const projectIds = Array.from(
      new Set(
        activityList
          .map((activity) => activity.project_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    if (projectIds.length === 0) {
      setProjectLookup({});
      return;
    }
    let isMounted = true;
    const fetchProjects = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", projectIds);
      if (error) {
        console.error("Failed to fetch project names", error);
        return;
      }
      if (!isMounted || !data) return;
      const lookup = data.reduce<Record<string, string>>((acc, project) => {
        if (project.id) {
          acc[project.id] = project.name ?? "";
        }
        return acc;
      }, {});
      setProjectLookup(lookup);
    };
    void fetchProjects();
    return () => {
      isMounted = false;
    };
  }, [activityList]);

  const {
    viewingProject,
    projectSheetOpen,
    onProjectSheetOpenChange,
    projectSheetLeadName,
    openProjectSheet
  } = useProjectSheetController({
    resolveLeadName: (leadId) => leadLookup[leadId]
  });

  const activeActivities = useMemo(
    () => activityList.filter((activity) => !activity.completed && activity.reminder_date),
    [activityList]
  );

  const todayTasks = useMemo(
    () =>
      activeActivities.filter((activity) => {
        const date = activity.reminder_date?.split("T")[0];
        return date === todayIso;
      }),
    [activeActivities, todayIso]
  );

  const overdueTasks = useMemo(
    () =>
      activeActivities.filter((activity) => {
        const date = activity.reminder_date?.split("T")[0];
        return date ? date < todayIso : false;
      }),
    [activeActivities, todayIso]
  );

  const todayScheduleReminders = useMemo(
    () =>
      activityList.filter((activity) => {
        if (!activity.reminder_date) return false;
        const date = activity.reminder_date.split("T")[0];
        return date === todayIso;
      }),
    [activityList, todayIso]
  );

  const totalActiveTasks = overdueTasks.length + todayTasks.length;
  const nowDisplayTime = useMemo(() => {
    const uses24Hour = timeFormat === "24-hour";
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: !uses24Hour,
      timeZone: timezone
    }).format(now);
  }, [locale, now, timeFormat, timezone]);
  const daySegment = getDaySegment(currentHour);
  const isTurkish = locale?.toLowerCase().startsWith("tr");
  const hasScheduleItems = todaysSessions.length > 0 || todayScheduleReminders.length > 0;

  const allDayLabel = t("daily_focus.all_day");
  const sessionFallbackLabel = t("daily_focus.session_fallback");
  const statusFallbackLabel = t("daily_focus.status_fallback");
  const locationFallbackLabel = t("daily_focus.location_fallback");
  const clientPlaceholder = t("daily_focus.client_placeholder");
  const projectPlaceholder = t("daily_focus.project_placeholder", { defaultValue: "Project" });
  const paymentTagLabel = t("daily_focus.payment_tag");
  const reminderCompletedLabel = t("daily_focus.completed_reminder", {
    defaultValue: "Completed"
  });
  const reminderCompleteTooltip = t("daily_focus.reminder_tooltip_complete", {
    defaultValue: "Click to mark this reminder as done"
  });
  const reminderReopenTooltip = t("daily_focus.reminder_tooltip_reopen", {
    defaultValue: "Click to bring this reminder back to today"
  });
  const reminderCompleteLabel = t("daily_focus.reminder_action_complete", {
    defaultValue: "Click to complete"
  });
  const greetingName = userName ?? profile?.full_name ?? null;
  const firstName = useMemo(() => {
    if (!greetingName) return null;
    const trimmed = greetingName.trim();
    if (!trimmed) return null;
    return trimmed.split(/\s+/)[0];
  }, [greetingName]);

  const timelineItems: TimelineItem[] = useMemo(() => {
    if (!hasScheduleItems) {
      return [];
    }
    const sessionItems: TimelineItem[] = todaysSessions.map((session) => ({
      type: "session",
      id: session.id,
      time: session.session_time,
      displayTime: formatTime(session.session_time.slice(0, 5)),
      sortValue: parseTimeToMinutes(session.session_time),
      data: session
    }));

    const reminderItems: TimelineItem[] = todayScheduleReminders.map((task) => ({
      type: "reminder",
      id: task.id,
      time: task.reminder_time ?? allDayLabel,
      displayTime: formatReminderTime(task.reminder_time, allDayLabel),
      sortValue: getReminderSortValue(task.reminder_time),
      data: {
        ...task,
        leadName: leadLookup[task.lead_id],
        projectName: task.project_id ? projectLookup[task.project_id] : undefined
      }
    }));

    const nowItem: TimelineItem = {
      type: "now",
      id: "now-indicator",
      time: nowDisplayTime,
      displayTime: nowDisplayTime,
      sortValue: nowMinutes
    };

    return [...sessionItems, ...reminderItems, nowItem].sort(
      (a, b) => a.sortValue - b.sortValue
    );
  }, [
    allDayLabel,
    hasScheduleItems,
    leadLookup,
    nowDisplayTime,
    nowMinutes,
    projectLookup,
    todayScheduleReminders,
    todaysSessions
  ]);

  const baseGreeting = useMemo(() => {
    if (daySegment === "midday" && isTurkish) {
      if (middayVariants.length > 0) {
        const randomIndex = Math.floor(Math.random() * middayVariants.length);
        return middayVariants[randomIndex];
      }
      return t("daily_focus.greetings.midday_default");
    }

    switch (daySegment) {
      case "morning":
        return t("daily_focus.greetings.morning");
      case "midday":
        return t("daily_focus.greetings.afternoon");
      case "evening":
        return t("daily_focus.greetings.evening");
      case "night":
      default:
        return t("daily_focus.greetings.night");
    }
  }, [daySegment, isTurkish, middayVariants, t]);

  const greeting = useMemo(() => {
    if (!firstName) return baseGreeting;
    return t("daily_focus.greetings.personalized", {
      greeting: baseGreeting,
      name: firstName,
      defaultValue: `${baseGreeting}, ${firstName}`
    });
  }, [baseGreeting, firstName, t]);

  const formattedDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: timezone
      }).format(now),
    [locale, now, timezone]
  );

  const triggerAddAction = (type: AddActionType) => {
    if (typeof window === "undefined") return;
    const eventName = ADD_ACTION_EVENTS[type];
    const event = new CustomEvent<AddActionEventDetail>(eventName, {
      detail: { source: "dashboard", type },
      cancelable: true
    });
    window.dispatchEvent(event);
  };

  const goToReminders = (params: Record<string, string>) => {
    const search = new URLSearchParams(params);
    navigate(`/reminders?${search.toString()}`);
  };

  const handleOverdueClick = () => {
    goToReminders({ filter: "overdue" });
  };

  const handleDueTodayClick = () => {
    goToReminders({ filter: "today", hideOverdue: "1" });
  };

  const handleInactiveLeadsClick = () => {
    navigate("/leads?inactive=1");
  };

  const handleReminderLeadClick = (leadId?: string | null) => {
    if (!leadId) return;
    navigate(`/leads/${leadId}`);
  };

  const handleReminderProjectClick = (projectId?: string | null) => {
    if (!projectId) return;
    void openProjectSheet(projectId);
  };

  const handleToggleReminderCompletion = async (
    reminderId: string,
    nextCompletedState: boolean
  ) => {
    if (completingReminderId) return;
    setCompletingReminderId(reminderId);
    try {
      const { error } = await supabase
        .from("activities")
        .update({ completed: nextCompletedState })
        .eq("id", reminderId);
      if (error) throw error;
      setActivityList((current) =>
        current.map((activity) =>
          activity.id === reminderId ? { ...activity, completed: nextCompletedState } : activity
        )
      );
      const toastTitle = nextCompletedState ? "Reminder completed" : "Reminder reopened";
      const toastDescription = nextCompletedState
        ? "We'll keep it visible in today's schedule."
        : "It's back in your active reminders.";
      toast({
        title: toastTitle,
        description: toastDescription
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not complete reminder.";
      toast({
        title: "Error marking reminder",
        description: message,
        variant: "destructive"
      });
    } finally {
      setCompletingReminderId(null);
    }
  };

  const handleSessionCardClick = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsSessionSheetOpen(true);
  };

  const handleSessionSheetOpenChange = (open: boolean) => {
    setIsSessionSheetOpen(open);
    if (!open) {
      setSelectedSessionId(null);
    }
  };

  const handleViewFullSessionDetails = () => {
    if (!selectedSessionId) return;
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    navigate(`/sessions/${selectedSessionId}`, { state: { from: currentPath } });
  };

  const handleNavigateToLead = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

  const handleNavigateToProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1 h-[420px] rounded-2xl bg-slate-900/80 border border-white/5 animate-pulse" />
        <div className="lg:col-span-2 h-[420px] rounded-2xl bg-white/40 border border-slate-100 animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1 relative overflow-hidden rounded-2xl p-8 text-white flex flex-col shadow-2xl min-h-[440px] border border-white/5 bg-slate-950">
          <AuroraBackground />

        <div className="relative z-10 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-cyan-200 font-bold text-xs uppercase tracking-[0.35em]">
              <Activity className="w-4 h-4 text-cyan-400" />
              Lumiso Pulse
            </div>
            <div className="text-indigo-300/60 text-[11px] font-mono">{formattedDate}</div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight mb-2 drop-shadow-sm">
            {greeting}
          </h1>
          <p className="text-slate-300 text-sm mb-8">
            <Trans
              i18nKey="daily_focus.active_tasks"
              ns="dashboard"
              values={{ count: totalActiveTasks }}
              components={{ highlight: <span className="text-cyan-300 font-semibold" /> }}
            />
          </p>

          {nextSession ? (
            <div className="mb-6">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>
                  {t("daily_focus.up_next")}
                  {nextSessionTimingLabel ? (
                    <>
                      {" \u00b7 "}
                      {nextSessionTimingLabel}
                    </>
                  ) : null}
                </span>
              </div>

              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-5 transition-all group shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500" />
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-base leading-tight text-white/95 group-hover:text-indigo-200 transition-colors">
                    {nextSession.session_name || nextSession.lead_name || sessionFallbackLabel}
                  </h3>
                  <span className="bg-indigo-500/40 border border-indigo-500/30 text-indigo-100 text-[11px] font-bold px-2 py-1 rounded">
                    {formatTime(nextSession.session_time.slice(0, 5))}
                  </span>
                </div>
                {nextSession.lead_name && (
                  <div className="flex flex-col gap-2 text-sm text-slate-200 mb-2 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-6 h-6 rounded-full border border-white/20 bg-white/10 text-white/80 text-[11px] font-semibold flex items-center justify-center">
                        {getLeadInitials(nextSession.lead_name)}
                      </div>
                      <span className="truncate flex-1 min-w-0">{nextSession.lead_name}</span>
                    </div>
                    <span className="hidden sm:block w-px h-5 bg-white/25" />
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-1 text-slate-200 min-w-0 cursor-default w-full sm:w-auto">
                            <MapPin className="w-3.5 h-3.5 text-slate-200" />
                            <span className="truncate w-full sm:w-auto sm:max-w-[140px]">
                              {nextSession.location || locationFallbackLabel}
                            </span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {nextSession.location || locationFallbackLabel}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
                {!nextSession.lead_name && (
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{nextSession.location || locationFallbackLabel}</span>
                  </div>
                )}
              </div>

              {laterSessions.length > 0 && (
                <div className="mt-3 flex items-center gap-3 px-1">
                  <div className="flex -space-x-2">
                    {laterSessions.slice(0, 3).map((session) => (
                      <div
                        key={session.id}
                        className="w-6 h-6 rounded-full border border-slate-800 bg-indigo-900 text-indigo-200 text-[9px] flex items-center justify-center font-bold"
                      >
                        {getLeadInitials(session.lead_name || clientPlaceholder)}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                    <span className="w-1 h-1 rounded-full bg-slate-500" />
                    <span>{t("daily_focus.more_sessions", { count: laterSessions.length })}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mb-6 rounded-xl border border-white/5 bg-white/5 p-5 backdrop-blur-md">
              <div className="text-sm text-slate-300">{t("daily_focus.no_sessions_today")}</div>
            </div>
          )}

          <div className="space-y-3 mt-auto">
            <button
              type="button"
              onClick={handleOverdueClick}
              className="w-full group bg-slate-900/40 backdrop-blur-sm border border-white/5 hover:bg-white/10 hover:border-rose-500/30 rounded-xl p-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-bold text-white leading-none mb-1">{overdueTasks.length}</div>
                  <div className="text-[10px] font-bold text-rose-400/80 uppercase tracking-wider">
                    {t("daily_focus.overdue_items")}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition-all" />
            </button>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleInactiveLeadsClick}
                className="w-full group bg-slate-900/40 backdrop-blur-sm border border-white/5 hover:bg-white/10 hover:border-amber-500/30 rounded-xl p-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                  <div className="text-lg font-bold text-white leading-none mb-1">{inactiveLeadCount}</div>
                    <div className="text-[10px] font-bold text-amber-400/80 uppercase tracking-wider truncate">
                      {t("daily_focus.inactive_leads")}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-all" />
              </button>

              <button
                type="button"
                onClick={handleDueTodayClick}
                className="w-full group bg-slate-900/40 backdrop-blur-sm border border-white/5 hover:bg-white/10 hover:border-indigo-500/30 rounded-xl p-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-white leading-none mb-1">{todayTasks.length}</div>
                    <div className="text-[10px] font-bold text-indigo-400/80 uppercase tracking-wider truncate">
                      {t("daily_focus.due_today")}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-all" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 relative overflow-hidden rounded-2xl flex flex-col bg-white/60 border border-slate-100 shadow-sm">
        <LightAuroraBackground />

        <div className="relative z-10 px-6 pt-6 pb-2 flex justify-between items-center">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
            <CalendarIcon className="w-5 h-5 text-indigo-600" />
            {t("daily_focus.schedule_heading")}
          </h2>
          {hasScheduleItems && (
            <span className="text-sm text-slate-500">
              {t("daily_focus.schedule_summary", {
                sessions: todaysSessions.length,
                reminders: todayTasks.length
              })}
            </span>
          )}
        </div>

        <div className="relative z-10 px-6">
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        </div>

        <div className="relative z-10 px-6 py-6">
          {hasScheduleItems ? (
            <div className="relative">
              <div className="absolute left-16 top-0 bottom-0 block sm:hidden w-px bg-gradient-to-b from-indigo-100 via-slate-200 to-transparent pointer-events-none" />
              <div className="absolute left-[5.75rem] top-0 bottom-0 hidden sm:block w-px bg-gradient-to-b from-indigo-100 via-slate-200 to-transparent pointer-events-none" />
              {timelineItems.map((item, index) => {
                const isLast = index === timelineItems.length - 1;

                if (item.type === "now") {
                  return (
                    <div
                      key={item.id}
                      className="relative flex w-full flex-row items-center gap-3 sm:gap-6 mb-6 mt-2"
                    >
                      <div className="sm:w-20 flex-shrink-0 flex justify-end items-center">
                        <div className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm shadow-rose-200">
                          {item.displayTime}
                        </div>
                      </div>
                      <div className="flex sm:hidden absolute left-16 -translate-x-1/2 z-20 items-center justify-center">
                        <div className="absolute w-3 h-3 bg-rose-400 rounded-full animate-ping opacity-60" />
                        <div className="relative w-2.5 h-2.5 bg-rose-600 rounded-full ring-2 ring-white shadow-sm" />
                      </div>
                      <div className="hidden sm:flex absolute left-[5.75rem] -translate-x-1/2 z-20 items-center justify-center">
                        <div className="absolute w-3 h-3 bg-rose-400 rounded-full animate-ping opacity-60" />
                        <div className="relative w-2.5 h-2.5 bg-rose-600 rounded-full ring-2 ring-white shadow-sm" />
                      </div>
                      <div className="flex-1 w-full flex items-center relative pl-2">
                        <div className="w-full">
                          <div className="w-full border-t border-dashed border-rose-400/70" />
                        </div>
                        <div className="absolute right-0 -top-3 text-[10px] font-bold text-rose-500 uppercase tracking-[0.35em] bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded border border-rose-100 shadow-sm">
                          {t("daily_focus.now_label")}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (item.type === "session") {
                  const theme = getSessionTheme(item.data);
                  const displayLeadName = item.data.lead_name || clientPlaceholder;
                  const displaySessionName =
                    item.data.session_name || item.data.lead_name || sessionFallbackLabel;
                  const displayStatus = item.data.status || statusFallbackLabel;
                  const displayLocation = item.data.location || locationFallbackLabel;

                  return (
                    <div
                      key={item.id}
                      className={`relative flex flex-row gap-3 sm:gap-6 items-start group mb-8 ${isLast ? "!mb-0" : ""}`}
                    >
                      <div className="w-16 sm:w-20 flex-shrink-0 flex flex-col items-start sm:items-end text-left sm:text-right pt-1">
                        <span className="text-base sm:text-xl font-bold text-slate-800 leading-none">
                          {item.displayTime}
                        </span>
                      </div>

                      <div
                        className="flex sm:hidden absolute left-16 -translate-x-1/2 z-10 items-center justify-center"
                        style={{ top: "0.65rem" }}
                      >
                        <div className="w-3 h-3 rounded-full bg-indigo-600 shadow-[0_0_0_4px_rgba(199,210,254,0.5)]" />
                      </div>
                      <div
                        className="hidden sm:flex absolute left-[5.75rem] -translate-x-1/2 z-10 items-center justify-center"
                        style={{ top: "0.65rem" }}
                      >
                        <div className="w-3 h-3 rounded-full bg-indigo-600 shadow-[0_0_0_4px_rgba(199,210,254,0.5)]" />
                      </div>

                      <div className="flex-1 min-w-0 relative sm:pl-6">
                        <button
                          type="button"
                          onClick={() => handleSessionCardClick(item.data.id)}
                          className="w-full bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all relative flex items-center p-3 pl-4 gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${theme.border}`} />
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-slate-900/90 truncate">
                                {displaySessionName}
                              </h3>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${theme.badge}`}>
                                {displayStatus}
                              </span>
                            </div>
                            <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:gap-3">
                              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                <div className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">
                                  {getLeadInitials(displayLeadName)}
                                </div>
                                <span className="truncate">{displayLeadName}</span>
                              </div>
                              <div className="hidden sm:block w-px h-3 bg-slate-200" />
                              <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1.5 text-slate-500 cursor-default min-w-0 w-full sm:w-auto">
                                      <MapPin className={`w-3.5 h-3.5 ${theme.icon}`} />
                                      <span className="truncate w-full sm:w-auto sm:max-w-[140px]">
                                        {displayLocation}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {displayLocation}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {item.data.notes && (
                                <>
                                  <div className="w-px h-3 bg-slate-200" />
                                  <div className="flex items-center gap-1.5 text-slate-500">
                                    <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                                    <span className="truncate max-w-[140px]">{item.data.notes}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="p-1.5 rounded-full text-slate-300 group-hover:text-indigo-600 group-hover:bg-slate-50 transition-all">
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        </button>
                      </div>
                    </div>
                  );
                }

                const reminder = item.data;
                const isReminderCompleted = reminder.completed;
                const reminderRowClass = `flex items-start gap-3 sm:gap-4 rounded-2xl px-2 py-1.5 sm:px-3 sm:py-2 w-full group transition-all ${
                  isReminderCompleted
                    ? "opacity-70 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    : "hover:bg-white/30"
                }`;
                const reminderTextClass = `text-sm font-semibold truncate ${
                  isReminderCompleted
                    ? "text-slate-400 line-through decoration-slate-400/70"
                    : "text-slate-800"
                }`;
                const reminderRowProps = isReminderCompleted
                  ? {
                      role: "button" as const,
                      tabIndex: 0,
                      onClick: () => handleToggleReminderCompletion(reminder.id, false),
                      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleToggleReminderCompletion(reminder.id, false);
                        }
                      }
                    }
                  : undefined;

                const reminderRowInner = (
                  <div className={reminderRowClass} {...(reminderRowProps ?? {})}>
                    <div className="min-w-0 sm:flex-1">
                      <div className="flex items-start gap-3">
                        <p className={`${reminderTextClass} flex-1 min-w-0`}>{reminder.content}</p>
                        {reminder.type === "payment" && (
                          <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50/90 px-1.5 py-0.5 rounded-full whitespace-nowrap border border-emerald-100">
                            <Coins className="w-2.5 h-2.5" />
                            {paymentTagLabel}
                          </span>
                        )}
                      </div>
                      {(reminder.leadName || reminder.project_id) && (
                        <div className="mt-1.5 flex flex-col gap-1 text-xs text-slate-500">
                          {reminder.leadName && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleReminderLeadClick(reminder.lead_id);
                              }}
                              className="inline-flex touch-target-compact items-center gap-1.5 text-left text-slate-500 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-md px-0.5 py-0.5 transition-colors"
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span className="truncate">{reminder.leadName}</span>
                            </button>
                          )}
                          {reminder.project_id && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleReminderProjectClick(reminder.project_id);
                              }}
                              className="inline-flex touch-target-compact items-center gap-1.5 text-left text-slate-500 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-md px-0.5 py-0.5 transition-colors"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              <span className="truncate">
                                {reminder.projectName || projectPlaceholder}
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {isReminderCompleted ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 sm:ml-auto sm:mt-0 mt-1">
                        <CheckCircle2 className="w-4 h-4" />
                        {reminderCompletedLabel}
                      </span>
                    ) : (
                      <div className="flex-shrink-0 sm:ml-auto sm:mt-0 mt-1">
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleToggleReminderCompletion(reminder.id, true);
                              }}
                              disabled={completingReminderId === reminder.id}
                              className="flex h-8 w-8 touch-target-compact items-center justify-center rounded-full border border-slate-200 bg-white/30 text-slate-400 transition-all hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-60 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              {completingReminderId === reminder.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                              ) : (
                                <Circle className="w-4 h-4" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {reminderCompleteTooltip}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}
                  </div>
                );
                return (
                  <div
                    key={item.id}
                    className={`relative flex flex-row items-start gap-6 group mb-4 ${isLast ? "!mb-0" : ""}`}
                  >
                    <div className="w-16 sm:w-20 flex-shrink-0 flex justify-end text-right pt-1.5">
                      <span className="text-xs font-semibold text-slate-400 font-mono">{item.displayTime}</span>
                    </div>

                    <div
                      className="flex sm:hidden absolute left-16 -translate-x-1/2 -translate-y-1/2 z-10 items-center justify-center"
                      style={{ top: "1.4rem" }}
                    >
                      <div className="w-2 h-2 rounded-full bg-slate-300 ring-4 ring-white/60" />
                    </div>
                    <div
                      className="hidden sm:flex absolute left-[5.75rem] -translate-x-1/2 -translate-y-1/2 z-10 items-center justify-center"
                      style={{ top: "1.4rem" }}
                    >
                      <div className="w-2 h-2 rounded-full bg-slate-300 ring-4 ring-white/60" />
                    </div>

                    <div className="flex-1 min-w-0 relative sm:pl-6">
                      {isReminderCompleted ? (
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>{reminderRowInner}</TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {reminderReopenTooltip}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        reminderRowInner
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-5">
              <img
                src="/timeline.png"
                alt={t("daily_focus.empty_alt")}
                className="w-14 h-14 object-contain opacity-90 drop-shadow-lg"
              />
              <div className="space-y-2 max-w-md">
                <h3 className="text-xl font-bold text-slate-800">{t("daily_focus.empty_title")}</h3>
                <p className="text-slate-500 text-sm">{t("daily_focus.empty_subtitle")}</p>
              </div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                {t("daily_focus.empty_description")}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="surface"
                  className="flex-1 sm:flex-none rounded-full bg-white text-slate-900 shadow-md hover:bg-slate-50 hover:text-slate-900"
                  onClick={() => triggerAddAction("lead")}
                >
                  {t("daily_focus.cta_lead")}
                </Button>
                <Button
                  type="button"
                  variant="surface"
                  className="flex-1 sm:flex-none rounded-full bg-white text-slate-900 shadow-md hover:bg-slate-50 hover:text-slate-900"
                  onClick={() => triggerAddAction("project")}
                >
                  {t("daily_focus.cta_project")}
                </Button>
                <Button
                  type="button"
                  variant="surface"
                  className="flex-1 sm:flex-none rounded-full !bg-indigo-600 !text-white shadow-md hover:!bg-indigo-500"
                  onClick={() => triggerAddAction("session")}
                >
                  {t("daily_focus.cta_session")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 mb-8">
        <StatCard
          context={`${getSectionLabel("leads")} · ${getTimeframeLabel(leadTimeframe)}`}
          label={
            leadTimeframe === "mtd"
              ? t("daily_focus.stats.titles.active_leads")
              : t("daily_focus.stats.titles.total_leads")
          }
          value={formatInteger(leadValue)}
          icon={Users}
          color="blue"
          chip={{
            tone: getTrendTone(leadComparison) === "negative" ? "negative" : "positive",
            icon: <TrendingUp className="h-3 w-3" />,
            label: t(
              leadTimeframe === "mtd"
                ? "daily_focus.stats.trend.month"
                : "daily_focus.stats.trend.year",
              { value: formatSignedInteger(leadComparison) }
            )
          }}
          timeframe={leadTimeframe === "mtd" ? "month" : "year"}
          onTimeframeChange={(next) => setLeadTimeframe(next === "month" ? "mtd" : "ytd")}
          info={{
            content: t(
              leadTimeframe === "mtd"
                ? "daily_focus.stats.tooltips.active_leads.month"
                : "daily_focus.stats.tooltips.active_leads.year"
            )
          }}
          timeframeLabels={timeframeToggleLabels}
        />

        <StatCard
          context={`${getSectionLabel("schedule")} · ${getTimeframeLabel(sessionTimeframe)}`}
          label={
            sessionTimeframe === "mtd"
              ? t("daily_focus.stats.titles.scheduled_sessions")
              : t("daily_focus.stats.titles.sessions_created")
          }
          value={formatInteger(sessionValue)}
          icon={CalendarIcon}
          color="amber"
          chip={{
            tone: "neutral",
            label: t("daily_focus.stats.chips.upcoming_sessions", {
              count: formatInteger(sessionMetrics.upcomingPlanned)
            })
          }}
          timeframe={sessionTimeframe === "mtd" ? "month" : "year"}
          onTimeframeChange={(next) => setSessionTimeframe(next === "month" ? "mtd" : "ytd")}
          info={{
            content: t(
              sessionTimeframe === "mtd"
                ? "daily_focus.stats.tooltips.sessions.month"
                : "daily_focus.stats.tooltips.sessions.year"
            )
          }}
          timeframeLabels={timeframeToggleLabels}
        />

        <StatCard
          context={`${getSectionLabel("finance")} · ${getTimeframeLabel(revenueTimeframe)}`}
          label={t("daily_focus.stats.titles.total_revenue")}
          value={renderCurrencyValue(revenueValue)}
          icon={Coins}
          color="violet"
          chip={{
            tone: getTrendTone(revenueComparison),
            icon: <TrendingUp className="h-3 w-3" />,
            label: t(
              revenueTimeframe === "mtd"
                ? "daily_focus.stats.trend.month"
                : "daily_focus.stats.trend.year",
              { value: formatSignedCurrency(revenueComparison) }
            )
          }}
          timeframe={revenueTimeframe === "mtd" ? "month" : "year"}
          onTimeframeChange={(next) => setRevenueTimeframe(next === "month" ? "mtd" : "ytd")}
          info={{
            content: t(
              revenueTimeframe === "mtd"
                ? "daily_focus.stats.tooltips.revenue.month"
                : "daily_focus.stats.tooltips.revenue.year"
            )
          }}
          timeframeLabels={timeframeToggleLabels}
        />

        <StatCard
          context={`${getSectionLabel("action")} · ${t("daily_focus.stats.labels.overdue")}`}
          label={t("daily_focus.stats.titles.outstanding")}
          value={renderCurrencyValue(outstandingBalance)}
          icon={AlertTriangle}
          color="rose"
          chip={{
            tone: "negative",
            icon: <ArrowRight className="h-3 w-3" />,
            label: t("daily_focus.stats.chips.needs_action")
          }}
          info={{
            content: t("daily_focus.stats.tooltips.outstanding")
          }}
        />
      </section>
      {selectedSessionId && (
        <SessionSheetView
          sessionId={selectedSessionId}
          isOpen={isSessionSheetOpen}
          onOpenChange={handleSessionSheetOpenChange}
          onViewFullDetails={handleViewFullSessionDetails}
          onNavigateToLead={handleNavigateToLead}
          onNavigateToProject={handleNavigateToProject}
        />
      )}
      <ProjectSheetView
        project={viewingProject}
        open={projectSheetOpen}
        onOpenChange={onProjectSheetOpenChange}
        onProjectUpdated={() => undefined}
        leadName={projectSheetLeadName}
        mode="sheet"
        onViewFullDetails={() => {
          if (viewingProject) {
            onProjectSheetOpenChange(false);
            navigate(`/projects/${viewingProject.id}`);
          }
        }}
      />
    </>
  );
};

export default DashboardDailyFocus;
