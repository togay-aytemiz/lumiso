import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Mail, Clock, Crown, AlarmClockCheck, Gift } from "lucide-react";
import { useTranslation } from "react-i18next";
import { UserStatusBadge } from "./UserStatusBadge";
import type {
  AdminUserAccount,
  AdminUserLeadSummary,
  AdminUserProjectSummary,
  AdminUserSessionSummary,
  AdminUserCalendarEventSummary,
  AdminUserPaymentSummary,
  AdminUserServiceSummary,
  AdminUserPackageSummary,
  AdminUserSessionTypeSummary,
} from "../types";
import { DataTable, type Column } from "@/components/ui/data-table";

interface AdminUserDetailSheetProps {
  user: AdminUserAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value ?? "—";
  }
};

const formatDateOnly = (value?: string | null) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value ?? "—";
  }
};

const formatRelativeTime = (value?: string) => {
  if (!value) return "—";
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return value;
  }
};

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

export function AdminUserDetailSheet({ user, open, onOpenChange }: AdminUserDetailSheetProps) {
  const { t } = useTranslation("pages");
  const { t: tCommon } = useTranslation("common");

  const kisiColumns = useMemo<Column<AdminUserLeadSummary>[]>(() => [
    {
      key: "name",
      header: t("admin.users.detail.tables.kisiler.columns.name"),
      sortable: true,
    },
    {
      key: "status",
      header: t("admin.users.detail.tables.kisiler.columns.status"),
      sortable: true,
      render: (lead) => lead.status || "—",
    },
    {
      key: "email",
      header: t("admin.users.detail.tables.kisiler.columns.email"),
      render: (_, value) => value || "—",
    },
    {
      key: "phone",
      header: t("admin.users.detail.tables.kisiler.columns.phone"),
      render: (_, value) => value || "—",
    },
    {
      key: "due_date",
      header: t("admin.users.detail.tables.kisiler.columns.due"),
      render: (lead) => formatDateOnly(lead.due_date),
    },
    {
      key: "updated_at",
      header: t("admin.users.detail.tables.kisiler.columns.updated"),
      render: (lead) => formatDateTime(lead.updated_at),
    },
  ], [t]);

  const projectColumns = useMemo<Column<AdminUserProjectSummary>[]>(() => [
    {
      key: "name",
      header: t("admin.users.detail.tables.projects.columns.name"),
      sortable: true,
    },
    {
      key: "status_label",
      header: t("admin.users.detail.tables.projects.columns.status"),
      render: (project) => project.status_label || "—",
    },
    {
      key: "lead_name",
      header: t("admin.users.detail.tables.projects.columns.kisi"),
      render: (project) => project.lead_name || "—",
    },
    {
      key: "base_price",
      header: t("admin.users.detail.tables.projects.columns.budget"),
      render: (project) => (project.base_price ? currencyFormatter.format(project.base_price) : "—"),
    },
    {
      key: "updated_at",
      header: t("admin.users.detail.tables.projects.columns.updated"),
      render: (project) => formatDateTime(project.updated_at),
    },
  ], [t]);

  const sessionColumns = useMemo<Column<AdminUserSessionSummary>[]>(() => [
    {
      key: "session_name",
      header: t("admin.users.detail.tables.sessions.columns.name"),
      sortable: true,
      render: (session) => session.session_name || "—",
    },
    {
      key: "status",
      header: t("admin.users.detail.tables.sessions.columns.status"),
      render: (session) => session.status || "—",
    },
    {
      key: "session_type_label",
      header: t("admin.users.detail.tables.sessions.columns.type"),
      render: (session) => session.session_type_label || "—",
    },
    {
      key: "session_date",
      header: t("admin.users.detail.tables.sessions.columns.schedule"),
      render: (session) =>
        session.session_date
          ? `${formatDateOnly(session.session_date)} ${session.session_time ?? ""}`.trim()
          : "—",
    },
    {
      key: "project_id",
      header: t("admin.users.detail.tables.sessions.columns.project"),
      render: (session) => session.project_id || "—",
    },
    {
      key: "updated_at",
      header: t("admin.users.detail.tables.sessions.columns.updated"),
      render: (session) => formatDateTime(session.updated_at),
    },
  ], [t]);

  const calendarColumns = useMemo<Column<AdminUserCalendarEventSummary>[]>(() => [
    {
      key: "content",
      header: t("admin.users.detail.tables.calendar.columns.title"),
      sortable: true,
    },
    {
      key: "type",
      header: t("admin.users.detail.tables.calendar.columns.type"),
    },
    {
      key: "reminder_date",
      header: t("admin.users.detail.tables.calendar.columns.date"),
      render: (event) => formatDateOnly(event.reminder_date),
    },
    {
      key: "reminder_time",
      header: t("admin.users.detail.tables.calendar.columns.time"),
      render: (_, value) => value || "—",
    },
    {
      key: "completed",
      header: t("admin.users.detail.tables.calendar.columns.completed"),
      render: (event) => (event.completed ? tCommon("yes") : tCommon("no")),
    },
  ], [t, tCommon]);

  const paymentColumns = useMemo<Column<AdminUserPaymentSummary>[]>(() => [
    {
      key: "amount",
      header: t("admin.users.detail.tables.payments.columns.amount"),
      render: (payment) => currencyFormatter.format(payment.amount ?? 0),
    },
    {
      key: "status",
      header: t("admin.users.detail.tables.payments.columns.status"),
    },
    {
      key: "type",
      header: t("admin.users.detail.tables.payments.columns.type"),
    },
    {
      key: "date_paid",
      header: t("admin.users.detail.tables.payments.columns.date"),
      render: (payment) => formatDateOnly(payment.date_paid ?? payment.created_at),
    },
    {
      key: "project_id",
      header: t("admin.users.detail.tables.payments.columns.project"),
      render: (payment) => payment.project_id || "—",
    },
  ], [t]);

  const servicesColumns = useMemo<Column<AdminUserServiceSummary>[]>(() => [
    {
      key: "name",
      header: t("admin.users.detail.tables.services.columns.name"),
      sortable: true,
    },
    {
      key: "category",
      header: t("admin.users.detail.tables.services.columns.category"),
      render: (_, value) => value || "—",
    },
    {
      key: "service_type",
      header: t("admin.users.detail.tables.services.columns.type"),
      render: (_, value) => value || "—",
    },
    {
      key: "price",
      header: t("admin.users.detail.tables.services.columns.price"),
      render: (service) => (service.price ? currencyFormatter.format(service.price) : "—"),
    },
    {
      key: "updated_at",
      header: t("admin.users.detail.tables.services.columns.updated"),
      render: (service) => formatDateTime(service.updated_at),
    },
  ], [t]);

  const packagesColumns = useMemo<Column<AdminUserPackageSummary>[]>(() => [
    {
      key: "name",
      header: t("admin.users.detail.tables.packages.columns.name"),
      sortable: true,
    },
    {
      key: "price",
      header: t("admin.users.detail.tables.packages.columns.price"),
      render: (pkg) => currencyFormatter.format(pkg.price ?? pkg.client_total ?? 0),
    },
    {
      key: "client_total",
      header: t("admin.users.detail.tables.packages.columns.clientTotal"),
      render: (pkg) => (pkg.client_total ? currencyFormatter.format(pkg.client_total) : "—"),
    },
    {
      key: "is_active",
      header: t("admin.users.detail.tables.packages.columns.status"),
      render: (pkg) => (pkg.is_active ? tCommon("yes") : tCommon("no")),
    },
    {
      key: "updated_at",
      header: t("admin.users.detail.tables.packages.columns.updated"),
      render: (pkg) => formatDateTime(pkg.updated_at),
    },
  ], [t, tCommon]);

  const sessionTypeColumns = useMemo<Column<AdminUserSessionTypeSummary>[]>(() => [
    {
      key: "name",
      header: t("admin.users.detail.tables.sessionTypes.columns.name"),
      sortable: true,
    },
    {
      key: "category",
      header: t("admin.users.detail.tables.sessionTypes.columns.category"),
      render: (_, value) => value || "—",
    },
    {
      key: "duration_minutes",
      header: t("admin.users.detail.tables.sessionTypes.columns.duration"),
      render: (sessionType) => `${sessionType.duration_minutes} min`,
    },
    {
      key: "updated_at",
      header: t("admin.users.detail.tables.sessionTypes.columns.updated"),
      render: (sessionType) => formatDateTime(sessionType.updated_at),
    },
  ], [t]);

  const tabDisabledMap = useMemo(
    () => ({
      kisiler: !user?.detail.leads.length,
      projects: !user?.detail.projects.length,
      sessions: !user?.detail.sessions.length,
      calendar: !user?.detail.calendar.length,
      payments: !user?.detail.payments.length,
      services: !user?.detail.services.length,
      packages: !user?.detail.packages.length,
      sessionTypes: !user?.detail.sessionTypes.length,
    }),
    [user]
  );

  if (!user) {
    return null;
  }

  const socialEntries = Object.entries(user.business.socialChannels ?? {});

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-4xl">
        <SheetHeader className="space-y-2 text-left">
          <SheetTitle>{t("admin.users.detail.title", { name: user.name })}</SheetTitle>
          <p className="text-sm text-muted-foreground">{t("admin.users.detail.subtitle")}</p>
        </SheetHeader>

        <div className="mt-6">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid grid-cols-3 gap-2 md:grid-cols-6">
              <TabsTrigger value="overview">{t("admin.users.detail.tabs.overview")}</TabsTrigger>
              <TabsTrigger value="kisiler" disabled={tabDisabledMap.kisiler}>
                {t("admin.users.detail.tabs.kisiler")}
              </TabsTrigger>
              <TabsTrigger value="projects" disabled={tabDisabledMap.projects}>
                {t("admin.users.detail.tabs.projects")}
              </TabsTrigger>
              <TabsTrigger value="sessions" disabled={tabDisabledMap.sessions}>
                {t("admin.users.detail.tabs.sessions")}
              </TabsTrigger>
              <TabsTrigger value="calendar" disabled={tabDisabledMap.calendar}>
                {t("admin.users.detail.tabs.calendar")}
              </TabsTrigger>
              <TabsTrigger value="payments" disabled={tabDisabledMap.payments}>
                {t("admin.users.detail.tabs.payments")}
              </TabsTrigger>
              <TabsTrigger value="services" disabled={tabDisabledMap.services}>
                {t("admin.users.detail.tabs.services")}
              </TabsTrigger>
              <TabsTrigger value="packages" disabled={tabDisabledMap.packages}>
                {t("admin.users.detail.tabs.packages")}
              </TabsTrigger>
              <TabsTrigger value="sessionTypes" disabled={tabDisabledMap.sessionTypes}>
                {t("admin.users.detail.tabs.sessionTypes")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-primary" />
                    {t("admin.users.detail.membership.title")}
                  </CardTitle>
                  <CardDescription>{t("admin.users.detail.membership.subtitle")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <UserStatusBadge status={user.status} />
                    <div className="text-sm text-muted-foreground">
                      {t("admin.users.detail.membership.plan", { plan: user.planName })}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t("admin.users.detail.membership.trialEnds")}</p>
                      <p className="text-sm text-muted-foreground">{formatDateTime(user.trialEndsAt)}</p>
                      {user.trialDaysRemaining != null && (
                        <p className="text-xs text-amber-700">
                          {t("admin.users.detail.membership.daysRemaining", {
                            days: user.trialDaysRemaining,
                          })}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t("admin.users.detail.membership.lastActive")}</p>
                      <p className="text-sm text-muted-foreground">{formatRelativeTime(user.lastActiveAt)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t("admin.users.detail.membership.startedAt")}</p>
                      <p className="text-sm text-muted-foreground">{formatDateTime(user.membershipStartedAt)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t("admin.users.detail.membership.premiumActivatedAt")}</p>
                      <p className="text-sm text-muted-foreground">{formatDateTime(user.premiumActivatedAt)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    {t("admin.users.detail.usage.title")}
                  </CardTitle>
                  <CardDescription>{t("admin.users.detail.usage.subtitle")}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {[
                    { key: "projects", value: user.stats.projects },
                    { key: "activeProjects", value: user.stats.activeProjects },
                    { key: "leads", value: user.stats.leads },
                    { key: "sessions", value: user.stats.sessions },
                    { key: "upcomingSessions", value: user.stats.upcomingSessions },
                    { key: "calendarEvents", value: user.stats.calendarEvents },
                    { key: "payments", value: user.stats.payments },
                    { key: "teamMembers", value: user.stats.teamMembers },
                  ].map((stat) => (
                    <div key={stat.key} className="space-y-1 rounded-md border p-3">
                      <p className="text-sm font-medium">
                        {t(`admin.users.detail.usage.${stat.key}`)}
                      </p>
                      <p className="text-2xl font-semibold">{stat.value.toLocaleString()}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    {t("admin.users.detail.account.title")}
                  </CardTitle>
                  <CardDescription>{t("admin.users.detail.account.subtitle")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoLine label={t("admin.users.detail.account.owner")} value={user.accountOwner ?? "—"} />
                    <InfoLine label={t("admin.users.detail.account.company")} value={user.company ?? "—"} />
                    <InfoLine label={t("admin.users.detail.account.email")} value={user.email} />
                    <InfoLine label={t("admin.users.detail.account.timezone")} value={user.timezone ?? "—"} />
                    <InfoLine label={t("admin.users.detail.account.businessName")} value={user.business.businessName ?? "—"} />
                    <InfoLine label={t("admin.users.detail.account.businessEmail")} value={user.business.businessEmail ?? "—"} />
                    <InfoLine label={t("admin.users.detail.account.businessPhone")} value={user.business.businessPhone ?? "—"} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t("admin.users.detail.account.social")}</p>
                    {socialEntries.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {socialEntries.map(([channel, url]) => (
                          <a
                            key={channel}
                            href={ensureUrl(String(url))}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                          >
                            {channel}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("admin.users.detail.account.emptySocial")}</p>
                    )}
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium">{t("admin.users.detail.account.notes")}</p>
                    <p className="text-sm text-muted-foreground mt-1">{user.notes ?? t("admin.users.detail.account.emptyNotes")}</p>
                  </div>
                  {user.tags?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {user.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlarmClockCheck className="h-4 w-4 text-primary" />
                    {t("admin.users.detail.actions.title")}
                  </CardTitle>
                  <CardDescription>{t("admin.users.detail.actions.subtitle")}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button variant="default">{t("admin.users.detail.actions.extendTrial")}</Button>
                  <Button variant="secondary">{t("admin.users.detail.actions.grantPremium")}</Button>
                  <Button variant="outline">{t("admin.users.detail.actions.addComplimentary")}</Button>
                  <Button variant="outline">{t("admin.users.detail.actions.suspendAccount")}</Button>
                  <Button variant="ghost">{t("admin.users.detail.actions.contactUser")}</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary" />
                    {t("admin.users.detail.financials.title")}
                  </CardTitle>
                  <CardDescription>{t("admin.users.detail.financials.subtitle")}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {[
                    { key: "monthlyRecurringRevenue", value: user.financials.monthlyRecurringRevenue },
                    { key: "lifetimeValue", value: user.financials.lifetimeValue },
                    { key: "averageDealSize", value: user.financials.averageDealSize },
                    { key: "overdueBalance", value: user.financials.overdueBalance },
                  ].map((financial) => (
                    <div key={financial.key} className="rounded-md border p-3">
                      <p className="text-sm font-medium">
                        {t(`admin.users.detail.financials.${financial.key}`)}
                      </p>
                      <p className="text-xl font-semibold">
                        {currencyFormatter.format(financial.value)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <DetailTab
              value="kisiler"
              title={t("admin.users.detail.collections.kisiler.title")}
              description={t("admin.users.detail.collections.kisiler.description")}
              emptyLabel={t("admin.users.detail.collections.kisiler.empty")}
              data={user.detail.leads}
              columns={kisiColumns}
            />

            <DetailTab
              value="projects"
              title={t("admin.users.detail.collections.projects.title")}
              description={t("admin.users.detail.collections.projects.description")}
              emptyLabel={t("admin.users.detail.collections.projects.empty")}
              data={user.detail.projects}
              columns={projectColumns}
            />

            <DetailTab
              value="sessions"
              title={t("admin.users.detail.collections.sessions.title")}
              description={t("admin.users.detail.collections.sessions.description")}
              emptyLabel={t("admin.users.detail.collections.sessions.empty")}
              data={user.detail.sessions}
              columns={sessionColumns}
            />

            <DetailTab
              value="calendar"
              title={t("admin.users.detail.collections.calendar.title")}
              description={t("admin.users.detail.collections.calendar.description")}
              emptyLabel={t("admin.users.detail.collections.calendar.empty")}
              data={user.detail.calendar}
              columns={calendarColumns}
            />

            <DetailTab
              value="payments"
              title={t("admin.users.detail.collections.payments.title")}
              description={t("admin.users.detail.collections.payments.description")}
              emptyLabel={t("admin.users.detail.collections.payments.empty")}
              data={user.detail.payments}
              columns={paymentColumns}
            />

            <DetailTab
              value="services"
              title={t("admin.users.detail.collections.services.title")}
              description={t("admin.users.detail.collections.services.description")}
              emptyLabel={t("admin.users.detail.collections.services.empty")}
              data={user.detail.services}
              columns={servicesColumns}
              itemsPerPage={6}
            />

            <DetailTab
              value="packages"
              title={t("admin.users.detail.collections.packages.title")}
              description={t("admin.users.detail.collections.packages.description")}
              emptyLabel={t("admin.users.detail.collections.packages.empty")}
              data={user.detail.packages}
              columns={packagesColumns}
              itemsPerPage={6}
            />

            <DetailTab
              value="sessionTypes"
              title={t("admin.users.detail.collections.sessionTypes.title")}
              description={t("admin.users.detail.collections.sessionTypes.description")}
              emptyLabel={t("admin.users.detail.collections.sessionTypes.empty")}
              data={user.detail.sessionTypes}
              columns={sessionTypeColumns}
              itemsPerPage={6}
            />
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface DetailTabProps<T> {
  value: string;
  title: string;
  description: string;
  emptyLabel: string;
  data: T[];
  columns: Column<T>[];
  itemsPerPage?: number;
}

function DetailTab<T>({
  value,
  title,
  description,
  emptyLabel,
  data,
  columns,
  itemsPerPage = 8,
}: DetailTabProps<T>) {
  return (
    <TabsContent value={value}>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            <DataTable
              data={data}
              columns={columns}
              itemsPerPage={itemsPerPage}
              className="max-w-full overflow-x-auto"
              emptyState={<span className="text-sm text-muted-foreground">{emptyLabel}</span>}
            />
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}

const ensureUrl = (value: string) => {
  if (!value) return "#";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

interface InfoLineProps {
  label: string;
  value: string;
}

function InfoLine({ label, value }: InfoLineProps) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
