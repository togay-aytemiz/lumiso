import { Calendar, CheckSquare, CreditCard, ListChecks } from "lucide-react";
import type { TFunction } from "i18next";
import type { EntitySummaryItem } from "@/components/EntityHeader";
import type {
  ProjectHeaderPaymentSummary,
  ProjectHeaderServicesSummary,
  ProjectHeaderTodoSummary
} from "@/hooks/useProjectHeaderSummary";
import type { SessionWithStatus } from "@/lib/sessionSorting";
import { formatDate, formatDateTime } from "@/lib/utils";

interface SessionSnapshot {
  count: number;
  upcomingPlannedSession: SessionWithStatus | null;
  upcomingPlannedDate: Date | null;
  overduePlannedSession: SessionWithStatus | null;
  overduePlannedDate: Date | null;
  recentSession: SessionWithStatus | null;
}

interface BuildProjectSummaryItemsParams {
  t: TFunction<"pages">;
  payments: ProjectHeaderPaymentSummary;
  todos: ProjectHeaderTodoSummary;
  services: ProjectHeaderServicesSummary;
  sessions: SessionWithStatus[];
}

const DEFAULT_LOCALE = "tr-TR";

function parseSessionDateTime(session: SessionWithStatus): Date | null {
  if (!session.session_date) return null;

  const timePart = (session.session_time ?? "").trim();
  const dateTime = timePart
    ? new Date(`${session.session_date}T${timePart}`)
    : new Date(session.session_date);

  if (!Number.isNaN(dateTime.getTime())) {
    return dateTime;
  }

  const fallback = new Date(session.session_date);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function computeSessionSnapshot(sessions: SessionWithStatus[]): SessionSnapshot {
  const now = Date.now();
  let upcoming: { session: SessionWithStatus; date: Date } | null = null;
  let overdue: { session: SessionWithStatus; date: Date } | null = null;

  sessions.forEach(session => {
    if (session.status !== "planned") return;
    const sessionDate = parseSessionDateTime(session);
    if (!sessionDate) return;
    const timestamp = sessionDate.getTime();

    if (timestamp >= now) {
      if (!upcoming || timestamp < upcoming.date.getTime()) {
        upcoming = { session, date: sessionDate };
      }
    } else if (!overdue || timestamp > overdue.date.getTime()) {
      overdue = { session, date: sessionDate };
    }
  });

  const recentSession = sessions.length > 0 ? sessions[0] : null;

  return {
    count: sessions.length,
    upcomingPlannedSession: upcoming?.session ?? null,
    upcomingPlannedDate: upcoming?.date ?? null,
    overduePlannedSession: overdue?.session ?? null,
    overduePlannedDate: overdue?.date ?? null,
    recentSession
  };
}

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: "currency",
      currency: (currency || "TRY") as Intl.NumberFormatOptions["currency"],
      minimumFractionDigits: 0
    }).format(amount);
  } catch (error) {
    console.error("Failed to format currency", error);
    return `${Number.isFinite(amount) ? Math.round(amount) : 0} ${currency || "TRY"}`;
  }
}

export function buildProjectSummaryItems({
  t,
  payments,
  todos,
  services,
  sessions
}: BuildProjectSummaryItemsParams): EntitySummaryItem[] {
  const paymentPrimary = payments.total > 0 || payments.totalPaid > 0
    ? t("projectDetail.header.payments.primary", { paid: formatCurrency(payments.totalPaid, payments.currency) })
    : t("projectDetail.header.payments.primaryZero");

  const paymentSecondary = payments.total > 0
    ? payments.remaining > 0
      ? t("projectDetail.header.payments.secondary", {
          remaining: formatCurrency(payments.remaining, payments.currency),
          total: formatCurrency(payments.total, payments.currency)
        })
      : t("projectDetail.header.payments.paidInFull")
    : t("projectDetail.header.payments.secondaryZero");

  const paymentSecondaryClass = payments.total > 0 && payments.remaining <= 0 ? "text-emerald-600" : undefined;

  const snapshot = computeSessionSnapshot(sessions);
  let sessionsSecondaryClass: string | undefined;
  let sessionsSecondary = t("projectDetail.header.sessions.hint");

  if (snapshot.count && snapshot.upcomingPlannedSession && snapshot.upcomingPlannedDate) {
    const plannedDisplay = formatDateTime(
      snapshot.upcomingPlannedSession.session_date,
      snapshot.upcomingPlannedSession.session_time || undefined
    );
    sessionsSecondary = t("projectDetail.header.sessions.next", { date: plannedDisplay });
  } else if (snapshot.count && snapshot.overduePlannedSession && snapshot.overduePlannedDate) {
    sessionsSecondary = t("projectDetail.header.sessions.overdueSummary");
    sessionsSecondaryClass = "text-amber-600";
  } else if (snapshot.count && snapshot.recentSession) {
    const recentDisplay = formatDate(snapshot.recentSession.session_date);
    sessionsSecondary = t("projectDetail.header.sessions.last", { date: recentDisplay });
  }

  const sessionsPrimary = snapshot.count
    ? t("projectDetail.header.sessions.count", { count: snapshot.count })
    : t("projectDetail.header.sessions.none");

  const progressPercentage = todos.total > 0 ? Math.round((todos.completed / todos.total) * 100) : 0;

  const todosPrimary = todos.total > 0
    ? t("projectDetail.header.todos.primary", { completed: todos.completed, total: todos.total })
    : t("projectDetail.header.todos.none");

  const todosSecondary = todos.total > 0
    ? t("projectDetail.header.todos.secondary", { progress: progressPercentage })
    : t("projectDetail.header.todos.hint");

  const servicesPrimary = services.total > 0
    ? t("projectDetail.header.services.primary", { count: services.total })
    : t("projectDetail.header.services.none");

  const servicesSecondary = services.total > 0
    ? t("projectDetail.header.services.secondary", { total: formatCurrency(services.totalValue, payments.currency) })
    : t("projectDetail.header.services.hint");

  const servicesInfo = services.total > 0
    ? {
        content: (
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">
              {t("projectDetail.header.services.infoTitle")}
            </p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {services.names.map(name => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        ),
        ariaLabel: t("projectDetail.header.services.infoLabel", { count: services.total })
      }
    : undefined;

  return [
    {
      key: "payments",
      icon: CreditCard,
      label: t("projectDetail.header.payments.label"),
      primary: paymentPrimary,
      secondary: paymentSecondary,
      secondaryClassName: paymentSecondaryClass
    },
    {
      key: "sessions",
      icon: Calendar,
      label: t("projectDetail.header.sessions.label"),
      primary: sessionsPrimary,
      secondary: sessionsSecondary,
      secondaryClassName: sessionsSecondaryClass
    },
    {
      key: "todos",
      icon: CheckSquare,
      label: t("projectDetail.header.todos.label"),
      primary: todosPrimary,
      secondary: todosSecondary
    },
    {
      key: "services",
      icon: ListChecks,
      label: t("projectDetail.header.services.label"),
      primary: servicesPrimary,
      secondary: servicesSecondary,
      info: servicesInfo
    }
  ];
}
