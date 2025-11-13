import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useAdminUsersData } from "@/features/admin-users/hooks/useAdminUsersData";
import type { AdminUserAccount } from "@/features/admin-users/types";
import { UserStatusBadge } from "@/features/admin-users/components/UserStatusBadge";
import { TableLoadingSkeleton } from "@/components/ui/loading-presets";

export default function AdminUsers() {
  const { t } = useTranslation("pages");
  const {
    users,
    isLoading,
    isError,
    error,
  } = useAdminUsersData();

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
        key: "businessEmail",
        header: t("admin.users.table.columns.businessEmail"),
        sortable: true,
        render: (user) => (
          <div className="space-y-1">
            <p className="text-sm font-medium">{user.business.businessEmail ?? "—"}</p>
            {user.business.businessName ? (
              <p className="text-xs text-muted-foreground">{user.business.businessName}</p>
            ) : null}
          </div>
        ),
      },
      {
        key: "businessPhone",
        header: t("admin.users.table.columns.businessPhone"),
        render: (user) => (
          <p className="text-sm text-muted-foreground">{user.business.businessPhone ?? "—"}</p>
        ),
      },
      {
        key: "status",
        header: t("admin.users.table.columns.trialStatus"),
        sortable: true,
        accessor: (user) => user.status,
        render: (user) => (
          <div className="flex items-center gap-2">
            <UserStatusBadge status={user.status} />
            <span className="text-sm font-medium">
              {t(`admin.users.status.${user.status}`)}
            </span>
          </div>
        ),
      },
      {
        key: "stats.projects",
        header: t("admin.users.table.columns.metrics"),
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
    ];
  }, [t]);

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

      <Card className="p-6">
        {isLoading ? (
          <TableLoadingSkeleton />
        ) : (
          <DataTable
            data={users}
            columns={columns}
            emptyState={
              <div className="py-10 text-center text-sm text-muted-foreground">
                {t("admin.users.table.empty")}
              </div>
            }
          />
        )}
      </Card>
    </div>
  );
}
