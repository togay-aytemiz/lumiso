import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useAdminUsersData } from "@/features/admin-users/hooks/useAdminUsersData";
import type { AdminUserAccount, MembershipStatus } from "@/features/admin-users/types";
import { UsersSummaryCards } from "@/features/admin-users/components/UsersSummaryCards";
import { UsersToolbar } from "@/features/admin-users/components/UsersToolbar";
import { UserStatusBadge } from "@/features/admin-users/components/UserStatusBadge";
import { AdminUserDetailSheet } from "@/features/admin-users/components/AdminUserDetailSheet";
import { TableLoadingSkeleton } from "@/components/ui/loading-presets";

const formatRelativeTime = (value?: string) => {
  if (!value) return "—";
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return value;
  }
};

const formatLocalizedDate = (value?: string | null) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "—";
  }
};

export default function AdminUsers() {
  const { t } = useTranslation("pages");
  const {
    users,
    metrics,
    expiringThresholdDays,
    availableStatuses,
    isLoading,
    isError,
    error,
    refetch,
  } = useAdminUsersData();

  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<MembershipStatus | "all">("all");
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserAccount | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const DEFAULT_STATUSES: MembershipStatus[] = useMemo(
    () => ["trial", "premium", "expired", "suspended", "complimentary"],
    []
  );

  const statusOptions = useMemo<Array<MembershipStatus | "all">>(() => {
    const source = availableStatuses.length ? availableStatuses : DEFAULT_STATUSES;
    return ["all", ...source];
  }, [availableStatuses, DEFAULT_STATUSES]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = normalizedSearch
        ? [user.name, user.email, user.company]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(normalizedSearch))
        : true;

      const matchesStatus = statusFilter === "all" ? true : user.status === statusFilter;
      const matchesExpiring = !expiringOnly
        ? true
        : user.status === "trial" && (user.trialDaysRemaining ?? Infinity) <= expiringThresholdDays;

      return matchesSearch && matchesStatus && matchesExpiring;
    });
  }, [users, searchValue, statusFilter, expiringOnly, expiringThresholdDays]);

  const columns = useMemo<Column<AdminUserAccount>[]>(() => {
    return [
      {
        key: "name",
        header: t("admin.users.table.columns.user"),
        sortable: true,
        render: (user) => (
          <div>
            <p className="font-semibold">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {user.company ? <span>{user.company}</span> : null}
              <UserStatusBadge status={user.status} />
            </div>
          </div>
        ),
      },
      {
        key: "planName",
        header: t("admin.users.table.columns.plan"),
        sortable: true,
        render: (user) => (
          <div className="space-y-1">
            <p className="font-medium">{user.planName}</p>
            {user.accountOwner ? (
              <p className="text-xs text-muted-foreground">
                {t("admin.users.table.accountOwner", { owner: user.accountOwner })}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        key: "business",
        header: t("admin.users.table.columns.business"),
        render: (user) => (
          <div className="space-y-1">
            <p className="font-medium">{user.business.businessName ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {user.business.businessEmail ?? "—"}
            </p>
            {user.business.phone ? (
              <p className="text-xs text-muted-foreground">{user.business.phone}</p>
            ) : null}
          </div>
        ),
      },
      {
        key: "trialDaysRemaining",
        header: t("admin.users.table.columns.trial"),
        sortable: true,
        render: (user) => {
          if (user.status === "trial") {
            return (
              <div className="space-y-1">
                <p className="font-medium">
                  {t("admin.users.table.trialDays", { days: user.trialDaysRemaining ?? 0 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("admin.users.table.trialEnds", {
                    date: formatLocalizedDate(user.trialEndsAt),
                  })}
                </p>
              </div>
            );
          }
          if (user.status === "expired") {
            return <p className="text-sm text-muted-foreground">{t("admin.users.table.trialExpired")}</p>;
          }
          return <p className="text-sm text-muted-foreground">{t("admin.users.table.notApplicable")}</p>;
        },
      },
      {
        key: "stats.projects",
        header: t("admin.users.table.columns.metrics"),
        render: (user) => (
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>{t("admin.users.table.metrics.projects", { count: user.stats.projects })}</span>
            <span>{t("admin.users.table.metrics.leads", { count: user.stats.leads })}</span>
            <span>{t("admin.users.table.metrics.sessions", { count: user.stats.sessions })}</span>
          </div>
        ),
      },
      {
        key: "lastActiveAt",
        header: t("admin.users.table.columns.lastActive"),
        sortable: true,
        accessor: (user) => new Date(user.lastActiveAt).getTime(),
        render: (user) => (
          <div className="space-y-1">
            <p className="font-medium">{formatRelativeTime(user.lastActiveAt)}</p>
            <p className="text-xs text-muted-foreground">{user.timezone ?? "—"}</p>
          </div>
        ),
      },
      {
        key: "actions",
        header: t("admin.users.table.columns.actions"),
        render: () => (
          <button
            type="button"
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            {t("admin.users.table.actions.manage")}
          </button>
        ),
      },
    ];
  }, [t]);

  const handleRowClick = (user: AdminUserAccount) => {
    setSelectedUser(user);
    setDetailOpen(true);
  };

  const handleExport = useCallback(
    (rows: AdminUserAccount[]) => {
      if (!rows.length || typeof window === "undefined") return;

      const wrap = (value: string | number | null | undefined) => {
        if (value == null) return "\"\"";
        const text = typeof value === "number" ? String(value) : String(value);
        return `"${text.replace(/"/g, '""')}"`;
      };

      const header = [
        "Organization",
        "Owner",
        "Email",
        "Status",
        "Plan",
        "Business Name",
        "Business Email",
        "Business Phone",
        "Kişi",
        "Projects",
        "Sessions",
        "Payments",
        "Trial Ends",
        "Trial Days",
      ];

      const body = rows.map((user) =>
        [
          wrap(user.name),
          wrap(user.accountOwner ?? ""),
          wrap(user.email),
          wrap(user.status),
          wrap(user.planName),
          wrap(user.business.businessName ?? ""),
          wrap(user.business.businessEmail ?? ""),
          wrap(user.business.phone ?? ""),
          wrap(user.stats.leads),
          wrap(user.stats.projects),
          wrap(user.stats.sessions),
          wrap(user.stats.payments),
          wrap(formatLocalizedDate(user.trialEndsAt)),
          wrap(user.trialDaysRemaining ?? ""),
        ].join(",")
      );

      const csv = [header.join(","), ...body].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `admin-users-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    []
  );

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("admin.users.title")}</h1>
        <p className="text-muted-foreground">{t("admin.users.subtitle")}</p>
      </div>

      {isError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {t("admin.users.errors.failedToLoad")}{" "}
          {error instanceof Error ? error.message : null}
        </div>
      ) : null}

      <UsersSummaryCards metrics={metrics} isLoading={isLoading} />

      <Card className="space-y-4 p-6">
        <UsersToolbar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          expiringOnly={expiringOnly}
          onExpiringOnlyChange={setExpiringOnly}
          onRefresh={() => refetch()}
          onExport={() => handleExport(filteredUsers)}
          statusOptions={statusOptions}
        />

        {isLoading ? (
          <TableLoadingSkeleton />
        ) : (
          <DataTable
            data={filteredUsers}
            columns={columns}
            onRowClick={handleRowClick}
            emptyState={
              <div className="py-10 text-center text-sm text-muted-foreground">
                {t("admin.users.table.empty")}
              </div>
            }
          />
        )}
      </Card>

      <AdminUserDetailSheet
        user={selectedUser}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedUser(null);
          }
        }}
      />
    </div>
  );
}
