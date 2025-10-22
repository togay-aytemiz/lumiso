import { Calendar, CheckSquare, CreditCard, ListChecks } from "lucide-react";
import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import type { EntitySummaryItem } from "@/components/EntityHeader";
import type {
  ProjectHeaderPaymentSummary,
  ProjectHeaderServicesSummary,
  ProjectHeaderTodoSummary
} from "@/hooks/useProjectHeaderSummary";
import type { ProjectSessionsSummary } from "@/hooks/useProjectSessionsSummary";
import { formatDate, formatTime } from "@/lib/utils";

interface BuildProjectSummaryItemsParams {
  t: TFunction<"pages">;
  payments: ProjectHeaderPaymentSummary;
  todos: ProjectHeaderTodoSummary;
  services: ProjectHeaderServicesSummary;
  sessionsSummary: ProjectSessionsSummary;
}

const DEFAULT_LOCALE = "tr-TR";

const getDateKey = (value: string | null) => (value ? value.slice(0, 10) : null);

const formatSessionDate = (session: ProjectSessionsSummary["overdueNext"]) => {
  if (!session?.session_date) return null;
  try {
    return formatDate(session.session_date);
  } catch {
    return null;
  }
};

const formatSessionTime = (session: ProjectSessionsSummary["overdueNext"]) => {
  if (!session?.session_time) return null;
  try {
    return formatTime(session.session_time);
  } catch {
    return null;
  }
};

function buildSessionChips(
  t: TFunction<"pages">,
  summary: ProjectSessionsSummary
): ReactNode {
  const chips: ReactNode[] = [];

  if (!summary) {
    return chips;
  }

  if (summary.overdueCount > 0) {
    chips.push(
      <span
        key="overdue"
        className="inline-flex items-center rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700"
      >
        {t("projectDetail.header.sessions.chips.overdue", { count: summary.overdueCount })}
      </span>
    );
  }

  const todayTime = formatSessionTime(summary.todayNext);
  if (summary.todayCount > 0) {
    let label: string;
    if (todayTime) {
      label = summary.todayCount > 1
        ? t("projectDetail.header.sessions.chips.todayMultiple", {
            count: summary.todayCount,
            time: todayTime
          })
        : t("projectDetail.header.sessions.chips.todaySingle", { time: todayTime });
    } else {
      label = t("projectDetail.header.sessions.chips.todayMultipleNoTime", {
        count: summary.todayCount
      });
    }

    chips.push(
      <span
        key="today"
        className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700"
      >
        {label}
      </span>
    );
  }

  const upcomingDate = formatSessionDate(summary.nextUpcoming);
  const upcomingTime = formatSessionTime(summary.nextUpcoming);
  if (summary.nextUpcoming && upcomingDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(
      tomorrow.getDate()
    ).padStart(2, "0")}`;

    const upcomingDateKey = getDateKey(summary.nextUpcoming.session_date);
    const upcomingIsTomorrow = upcomingDateKey !== null && upcomingDateKey === tomorrowKey;

    let label: string;
    if (upcomingIsTomorrow && upcomingTime) {
      label = t("projectDetail.header.sessions.chips.tomorrow", { time: upcomingTime });
    } else if (upcomingTime) {
      label = t("projectDetail.header.sessions.chips.upcomingWithTime", {
        date: upcomingDate,
        time: upcomingTime
      });
    } else {
      label = t("projectDetail.header.sessions.chips.upcoming", { date: upcomingDate });
    }

    chips.push(
      <span
        key="upcoming"
        className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700"
      >
        {label}
      </span>
    );
  }

  if (chips.length === 0) {
    return t("projectDetail.header.sessions.hint");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips}
    </div>
  );
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
  sessionsSummary
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

  const sessionsPrimary = sessionsSummary.total > 0
    ? t("projectDetail.header.sessions.count", { count: sessionsSummary.total })
    : t("projectDetail.header.sessions.none");

  const sessionsSecondary = buildSessionChips(t, sessionsSummary);
  const sessionsSecondaryClass = typeof sessionsSecondary === "string" ? "text-muted-foreground" : undefined;

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
    ? t("projectDetail.header.services.viewList")
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
