import { useCallback, useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { enUS, tr as trLocale } from "date-fns/locale";
import {
  AdvancedDataTable,
  type AdvancedDataTableSortState,
  type AdvancedTableColumn,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { TableLoadingSkeleton } from "@/components/ui/loading-presets";
import { useAdminUsersData } from "@/features/admin-users/hooks/useAdminUsersData";
import type {
  AdminUserAccount,
  AdminUsersSummaryMetrics,
  MembershipStatus,
} from "@/features/admin-users/types";
import { UsersSummaryCards } from "@/features/admin-users/components/UsersSummaryCards";
import { UserStatusBadge } from "@/features/admin-users/components/UserStatusBadge";
import { AdminUserDetailSheet } from "@/features/admin-users/components/AdminUserDetailSheet";

export default function AdminUsers() {
  const { t, i18n } = useTranslation("pages");
  const {
    users,
    isLoading,
    isError,
    error,
    refetch,
  } = useAdminUsersData();

  const [searchValue, setSearchValue] = useState("");
  const [sortState, setSortState] = useState<AdvancedDataTableSortState>({
    columnId: "name",
    direction: "asc",
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserSnapshot, setSelectedUserSnapshot] = useState<AdminUserAccount | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const locale = useMemo(() => {
    if (i18n.language?.toLowerCase().startsWith("tr")) {
      return trLocale;
    }
    return enUS;
  }, [i18n.language]);

  const formatRelativeTime = useCallback(
    (value?: string) => {
      if (!value) return "—";
      try {
        return formatDistanceToNow(new Date(value), {
          addSuffix: true,
          locale,
        });
      } catch {
        return value;
      }
    },
    [locale]
  );

  const formatLocalizedDate = useCallback(
    (value?: string | null) => {
      if (!value) return "—";
      try {
        return new Intl.DateTimeFormat(i18n.language ?? undefined, {
          dateStyle: "medium",
        }).format(new Date(value));
      } catch {
        return "—";
      }
    },
    [i18n.language]
  );

  const metrics = useMemo<AdminUsersSummaryMetrics>(() => {
    const EXPIRING_THRESHOLD_DAYS = 3;
    return users.reduce<AdminUsersSummaryMetrics>(
      (acc, user) => {
        acc.totalUsers += 1;
        if (user.status === "premium") acc.premiumUsers += 1;
        if (user.status === "trial") {
          acc.activeTrials += 1;
          if ((user.trialDaysRemaining ?? Infinity) <= EXPIRING_THRESHOLD_DAYS) {
            acc.expiringTrials += 1;
          }
        }
        if (user.status === "complimentary") acc.complimentaryUsers += 1;
        if (user.status === "suspended") acc.suspendedUsers += 1;
        return acc;
      },
      {
        totalUsers: 0,
        premiumUsers: 0,
        activeTrials: 0,
        expiringTrials: 0,
        complimentaryUsers: 0,
        suspendedUsers: 0,
      }
    );
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    const numericQuery = searchValue.replace(/\D/g, "");
    if (!query && !numericQuery) {
      return users;
    }
    return users.filter((user) => {
      const haystacks = [
        user.name,
        user.email,
        user.company,
        user.accountOwner,
        user.business.businessName,
        user.business.businessEmail,
      ];
      if (query && haystacks.some((value) => value?.toLowerCase().includes(query))) {
        return true;
      }
      const phoneRaw = user.business.businessPhone ?? "";
      if (query && phoneRaw.toLowerCase().includes(query)) {
        return true;
      }
      if (numericQuery) {
        const phoneDigits = phoneRaw.replace(/\D/g, "");
        if (phoneDigits.includes(numericQuery)) {
          return true;
        }
      }
      return false;
    });
  }, [users, searchValue]);

  const sortedUsers = useMemo(() => {
    const data = [...filteredUsers];
    if (!sortState.columnId) return data;

    const compareValues = (a?: string | number | null, b?: string | number | null) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      if (typeof a === "number" && typeof b === "number") {
        return a - b;
      }
      return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
    };

    const getValue = (user: AdminUserAccount) => {
      switch (sortState.columnId) {
        case "name":
          return user.name;
        case "status":
          return user.status;
        case "trial":
          return user.trialEndsAt ? new Date(user.trialEndsAt).getTime() : null;
        case "lastActive":
          return user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : null;
        case "leads":
          return user.stats.leads;
        default:
          return user.name;
      }
    };

    data.sort((a, b) => {
      const result = compareValues(getValue(a), getValue(b));
      return sortState.direction === "asc" ? result : -result;
    });

    return data;
  }, [filteredUsers, sortState]);

  const handleManage = useCallback((user: AdminUserAccount) => {
    setSelectedUserId(user.id);
    setSelectedUserSnapshot(user);
    setDetailOpen(true);
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    const updated = users.find((candidate) => candidate.id === selectedUserId);
    if (updated) {
      setSelectedUserSnapshot(updated);
    }
  }, [users, selectedUserId]);

  const columns = useMemo<AdvancedTableColumn<AdminUserAccount>[]>(() => {
    return [
      {
        id: "user",
        label: t("admin.users.table.columns.user"),
        sortable: true,
        sortId: "name",
        render: (user) => (
          <div>
            <p className="font-semibold">
              {user.accountOwner ?? user.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {user.business.businessName ?? user.company ?? "—"}
            </p>
          </div>
        ),
      },
      {
        id: "contact",
        label: t("admin.users.table.columns.business"),
        render: (user) => (
          <div className="space-y-1">
            <p className="text-sm font-medium">{user.business.businessEmail ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {user.business.businessPhone ?? "—"}
            </p>
          </div>
        ),
      },
      {
        id: "status",
        label: t("admin.users.table.columns.status"),
        sortable: true,
        render: (user) => <UserStatusBadge status={user.status} />,
      },
      {
        id: "trial",
        label: t("admin.users.table.columns.planTimeline"),
        sortable: true,
        render: (user) => {
          if (user.status === "suspended") {
            return (
              <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-sm font-semibold text-destructive">
                  {t("admin.users.table.suspendedTitle")}
                </p>
                <p className="text-xs text-destructive">
                  {user.manualFlagReason
                    ? t("admin.users.table.suspendedReason", {
                        reason: user.manualFlagReason,
                      })
                    : t("admin.users.table.suspendedNoReason")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("admin.users.table.suspendedInstruction")}
                </p>
              </div>
            );
          }
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
          if (user.status === "premium" || user.status === "complimentary") {
            const premiumActivationReference = user.premiumActivatedAt ?? user.membershipStartedAt;
            return (
              <div className="space-y-1">
                <p className="font-medium">
                  {user.premiumExpiresAt
                    ? t("admin.users.table.premiumEnds", {
                        date: formatLocalizedDate(user.premiumExpiresAt),
                      })
                    : t("admin.users.table.premiumNoExpiration")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {premiumActivationReference
                    ? t("admin.users.table.premiumActivated", {
                        date: formatLocalizedDate(premiumActivationReference),
                      })
                    : t("admin.users.table.planActive")}
                </p>
              </div>
            );
          }
          if (user.status === "expired") {
            return <p className="text-sm text-muted-foreground">{t("admin.users.table.trialExpired")}</p>;
          }
          if (user.status === "locked") {
            return <p className="text-sm text-destructive">{t("admin.users.table.locked")}</p>;
          }
          return <p className="text-sm text-muted-foreground">{t("admin.users.table.notApplicable")}</p>;
        },
      },
      {
        id: "leads",
        label: t("admin.users.table.columns.metrics"),
        render: (user) => (
          <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
            <div>
              <p className="text-base font-semibold text-foreground">{user.stats.leads}</p>
              <p>{t("admin.users.table.metrics.leadsLabel")}</p>
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{user.stats.projects}</p>
              <p>{t("admin.users.table.metrics.projectsLabel")}</p>
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{user.stats.sessions}</p>
              <p>{t("admin.users.table.metrics.sessionsLabel")}</p>
            </div>
          </div>
        ),
      },
      {
        id: "lastActive",
        label: t("admin.users.table.columns.lastActive"),
        sortable: true,
        render: (user) => (
          <div className="space-y-1">
            <p className="font-medium">{formatRelativeTime(user.lastActiveAt)}</p>
            <p className="text-xs text-muted-foreground">{user.timezone ?? "—"}</p>
          </div>
        ),
      },
    ];
  }, [t, formatLocalizedDate, formatRelativeTime]);

  const rowActions = useCallback(
    (user: AdminUserAccount) => (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={(event) => {
          event.stopPropagation();
          handleManage(user);
        }}
      >
        {t("admin.users.table.actions.manage")}
      </Button>
    ),
    [handleManage, t]
  );

  return (
    <div className="space-y-6 py-6">
      <div className="space-y-2">
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

      <AdvancedDataTable
        title={t("admin.users.tableTitle", { defaultValue: t("admin.users.title") })}
        description={t("admin.users.tableSubtitle", {
          defaultValue: t("admin.users.subtitle"),
        })}
        data={sortedUsers}
        columns={columns}
        rowKey={(user) => user.id}
        isLoading={isLoading}
        loadingState={<TableLoadingSkeleton />}
        searchPlaceholder={t("admin.users.filters.searchPlaceholder")}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        sortState={sortState}
        onSortChange={setSortState}
        onRowClick={handleManage}
        rowActions={rowActions}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t("admin.users.actions.refresh")}
          </Button>
        }
        emptyState={
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t("admin.users.table.empty")}
          </div>
        }
      />

      <AdminUserDetailSheet
        user={selectedUserSnapshot}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedUserId(null);
            setSelectedUserSnapshot(null);
          }
        }}
        onUserUpdated={() => {
          void refetch();
        }}
      />
    </div>
  );
}
