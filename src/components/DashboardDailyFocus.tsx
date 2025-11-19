import { useCallback, useEffect, useMemo, useState } from "react";
import { Trans } from "react-i18next";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Briefcase,
  Calendar as CalendarIcon,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  DollarSign,
  MapPin,
  Sparkles,
  StickyNote
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { formatTime, getUserLocale } from "@/lib/utils";
import { useDashboardTranslation } from "@/hooks/useTypedTranslation";
import { ADD_ACTION_EVENTS, type AddActionType, type AddActionEventDetail } from "@/constants/addActionEvents";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SessionSheetView from "@/components/SessionSheetView";
import { computeLeadInitials } from "@/components/leadInitialsUtils";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];

export type SessionWithLead = SessionRow & { lead_name?: string };

interface DashboardDailyFocusProps {
  leads: LeadRow[];
  sessions: SessionWithLead[];
  activities: ActivityRow[];
  loading: boolean;
  userName?: string | null;
  inactiveLeadCount: number;
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
      data: ActivityRow & { leadName?: string | null };
    }
  | {
      type: "now";
      id: string;
      time: string;
      displayTime: string;
      sortValue: number;
    };

type DaySegment = "night" | "morning" | "midday" | "evening";

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
  inactiveLeadCount
}: DashboardDailyFocusProps) => {
  const [now, setNow] = useState(new Date());
  const { t, i18n } = useDashboardTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionSheetOpen, setIsSessionSheetOpen] = useState(false);
  const getLeadInitials = useCallback(
    (name?: string | null) => computeLeadInitials(name, "??", 2),
    []
  );

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const todayIso = useMemo(() => now.toISOString().split("T")[0], [now]);
  const locale = i18n.language || getUserLocale();

  const middayVariants = useMemo(() => {
    const phrases = t("daily_focus.greetings.midday_variants", {
      returnObjects: true
    }) as string[] | string;
    return Array.isArray(phrases) ? phrases : [];
  }, [i18n.language, t]);

  const todaysSessions = useMemo(
    () =>
      sessions
        .filter((session) => session.session_date === todayIso)
        .sort((a, b) => a.session_time.localeCompare(b.session_time)),
    [sessions, todayIso]
  );

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const nextSession = useMemo(() => {
    if (todaysSessions.length === 0) {
      return undefined;
    }
    return (
      todaysSessions.find((session) => parseTimeToMinutes(session.session_time) > nowMinutes) ||
      todaysSessions[0]
    );
  }, [todaysSessions, nowMinutes]);

  const laterSessions = useMemo(() => {
    if (!nextSession) return [];
    const nextSessionMinutes = parseTimeToMinutes(nextSession.session_time);
    return todaysSessions.filter(
      (session) => parseTimeToMinutes(session.session_time) > nextSessionMinutes
    );
  }, [nextSession, todaysSessions]);

  const leadLookup = useMemo(() => {
    return leads.reduce<Record<string, string>>((acc, lead) => {
      acc[lead.id] = lead.name;
      return acc;
    }, {});
  }, [leads]);

  const activeActivities = useMemo(
    () => activities.filter((activity) => !activity.completed && activity.reminder_date),
    [activities]
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

  const totalActiveTasks = overdueTasks.length + todayTasks.length;
  const nowDisplayTime = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit"
  });
  const daySegment = getDaySegment(now.getHours());
  const isTurkish = locale?.toLowerCase().startsWith("tr");
  const hasScheduleItems = todaysSessions.length > 0 || todayTasks.length > 0;

  const allDayLabel = t("daily_focus.all_day");
  const sessionFallbackLabel = t("daily_focus.session_fallback");
  const statusFallbackLabel = t("daily_focus.status_fallback");
  const locationFallbackLabel = t("daily_focus.location_fallback");
  const clientPlaceholder = t("daily_focus.client_placeholder");
  const paymentTagLabel = t("daily_focus.payment_tag");
  const firstName = useMemo(() => {
    if (!userName) return null;
    const trimmed = userName.trim();
    if (!trimmed) return null;
    return trimmed.split(/\s+/)[0];
  }, [userName]);

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

    const reminderItems: TimelineItem[] = todayTasks.map((task) => ({
      type: "reminder",
      id: task.id,
      time: task.reminder_time ?? allDayLabel,
      displayTime: formatReminderTime(task.reminder_time, allDayLabel),
      sortValue: getReminderSortValue(task.reminder_time),
      data: { ...task, leadName: leadLookup[task.lead_id] }
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
  }, [allDayLabel, hasScheduleItems, leadLookup, nowDisplayTime, nowMinutes, todayTasks, todaysSessions]);

  const greeting = useMemo(() => {
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
  const formattedDate = now.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });

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
            {firstName ? `, ${firstName}` : ""}
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
                {t("daily_focus.up_next")}
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
                  <div className="flex items-center gap-3 text-sm text-slate-200 mb-2 flex-wrap">
                    <div className="w-6 h-6 rounded-full border border-white/20 bg-white/10 text-white/80 text-[11px] font-semibold flex items-center justify-center">
                      {getLeadInitials(nextSession.lead_name)}
                    </div>
                    <div className="flex items-center gap-3 text-slate-100 text-sm w-full">
                      <span className="truncate flex-1 min-w-0">{nextSession.lead_name}</span>
                      <span className="block w-px h-5 bg-white/25" />
                      <span className="flex items-center gap-1 text-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-slate-200" />
                        <span className="truncate max-w-[140px]">
                          {nextSession.location || locationFallbackLabel}
                        </span>
                      </span>
                    </div>
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

            <div className="grid grid-cols-2 gap-3">
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
              <div className="absolute left-[5.75rem] top-0 bottom-0 hidden sm:block w-px bg-gradient-to-b from-indigo-100 via-slate-200 to-transparent pointer-events-none" />
              {timelineItems.map((item, index) => {
                const isLast = index === timelineItems.length - 1;

                if (item.type === "now") {
                  return (
                    <div key={item.id} className="relative flex flex-col sm:flex-row gap-6 items-center mb-6 mt-2">
                      <div className="sm:w-20 flex-shrink-0 flex justify-end items-center">
                        <div className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm shadow-rose-200">
                          {item.displayTime}
                        </div>
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
                    className={`relative flex flex-col sm:flex-row gap-6 group mb-8 ${isLast ? "!mb-0" : ""}`}
                  >
                    <div className="sm:w-20 flex-shrink-0 flex flex-col items-start sm:items-end text-left sm:text-right pt-1">
                      <span className="text-xl font-bold text-slate-800 leading-none">{item.displayTime}</span>
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
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                              <div className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">
                                {getLeadInitials(displayLeadName)}
                              </div>
                              <span className="truncate max-w-[140px]">{displayLeadName}</span>
                            </div>
                            <div className="w-px h-3 bg-slate-200" />
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <MapPin className={`w-3.5 h-3.5 ${theme.icon}`} />
                              <span className="truncate max-w-[140px]">
                                {displayLocation}
                              </span>
                            </div>
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

              return (
                <div
                  key={item.id}
                  className={`relative flex flex-col sm:flex-row gap-6 group mb-3 ${isLast ? "!mb-0" : ""}`}
                >
                  <div className="sm:w-20 flex-shrink-0 flex flex-col items-start sm:items-end text-left sm:text-right pt-0.5">
                    <span className="text-xs font-medium text-slate-400 font-mono">{item.displayTime}</span>
                  </div>

                  <div
                    className="hidden sm:flex absolute left-[5.75rem] -translate-x-1/2 z-10 items-center justify-center"
                    style={{ top: "0.35rem" }}
                  >
                    <div className="w-2 h-2 rounded-full bg-slate-300 ring-4 ring-white/60" />
                  </div>

                  <div className="flex-1 min-w-0 relative sm:pl-6">
                    <div className="flex items-center justify-between pt-0.5 pr-2 pl-2 py-1 rounded-lg group hover:bg-white/40 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm text-slate-600 font-medium truncate">
                          {item.data.content}
                        </span>
                        {item.data.leadName && (
                          <span className="hidden sm:flex items-center gap-1 text-xs text-slate-400">
                            <Briefcase className="w-3 h-3" />
                            <span className="truncate max-w-[120px]">{item.data.leadName}</span>
                          </span>
                        )}
                        {item.data.type === "payment" && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                            <DollarSign className="w-2.5 h-2.5" />
                            {paymentTagLabel}
                          </span>
                        )}
                      </div>
                      <button className="text-slate-400 hover:text-indigo-600 transition-all">
                        <CheckSquare className="w-4 h-4" />
                      </button>
                    </div>
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
    </>
  );
};

export default DashboardDailyFocus;
