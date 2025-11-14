import { useMemo, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableLoadingSkeleton } from "@/components/ui/loading-presets";
import { formatDistanceToNow } from "date-fns";
import type { Locale } from "date-fns";
import { enUS, tr as trLocale } from "date-fns/locale";
import { AlarmClockCheck, Mail, Clock, Crown, Gift, ArrowUpRight, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { UserStatusBadge } from "./UserStatusBadge";
import type {
  AdminUserAccount,
  AdminUserLeadSummary,
  AdminUserProjectSummary,
  AdminUserSessionSummary,
  AdminUserPaymentSummary,
  AdminUserServiceSummary,
  AdminUserPackageSummary,
  AdminUserSessionTypeSummary,
  AdminUserMembershipEvent,
  MembershipStatus,
} from "../types";
import { MembershipActions } from "./MembershipActions";
import { AdvancedDataTable, type AdvancedTableColumn } from "@/components/data-table";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { supabase } from "@/integrations/supabase/client";
import { settingsClasses, settingsTokens } from "@/theme/settingsTokens";

interface AdminUserDetailSheetProps {
  user: AdminUserAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated?: () => void;
}

const formatDateTime = (value?: string | null, locale?: string) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(locale ?? undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value ?? "—";
  }
};

const formatDateOnly = (value?: string | null, locale?: string) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(locale ?? undefined, {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value ?? "—";
  }
};

const formatRelativeTime = (value?: string, locale?: Locale) => {
  if (!value) return "—";
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true, locale });
  } catch {
    return value;
  }
};

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});
const countFormatter = new Intl.NumberFormat();
const decimalFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

type PackageLineItemRecord = {
  name?: string;
  quantity: number;
};

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
};

const parsePackageLineItems = (value: unknown): PackageLineItemRecord[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const name =
        typeof record.name === "string"
          ? record.name
          : typeof record.service === "string"
          ? record.service
          : undefined;
      const quantity = coerceNumber(record.quantity) ?? 0;
      return {
        name,
        quantity: quantity > 0 ? quantity : 0,
      };
    })
    .filter(Boolean) as PackageLineItemRecord[];
};

const summarizePackageServices = (pkg: AdminUserPackageSummary) => {
  const items = parsePackageLineItems(pkg.line_items);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    itemCount: items.length,
    totalQuantity,
  };
};

const buildLineItemPreview = (pkg: AdminUserPackageSummary, limit = 3) => {
  const items = parsePackageLineItems(pkg.line_items);
  const names = items
    .map((item) => item.name?.trim())
    .filter((name): name is string => Boolean(name));
  const preview = names.slice(0, limit);
  return {
    preview,
    total: names.length,
    remaining: Math.max(names.length - preview.length, 0),
  };
};

type PackagePricingMetadata = {
  enableDeposit?: boolean;
  depositMode?: "fixed" | "percent_base" | "percent_subtotal";
  depositValue?: number | null;
  depositAmount?: number | null;
  depositTarget?: "base" | "subtotal" | null;
};

const parsePackagePricingMetadata = (
  value: unknown
): PackagePricingMetadata | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const depositMode =
    record.depositMode === "fixed" ||
    record.depositMode === "percent_base" ||
    record.depositMode === "percent_subtotal"
      ? record.depositMode
      : undefined;
  const depositTarget =
    record.depositTarget === "base" || record.depositTarget === "subtotal"
      ? record.depositTarget
      : depositMode === "percent_base"
      ? "base"
      : depositMode
      ? "subtotal"
      : null;
  return {
    enableDeposit: Boolean(record.enableDeposit),
    depositMode,
    depositValue: coerceNumber(record.depositValue),
    depositAmount: coerceNumber(record.depositAmount),
    depositTarget,
  };
};

type CollectionType = "packages" | "services" | "sessionTypes";

type AdminUserDetailSheetContentProps = Omit<AdminUserDetailSheetProps, "user"> & {
  user: AdminUserAccount;
};

type MembershipDetailCell = {
  value: ReactNode;
  context?: ReactNode;
};

type MembershipDetailRow = {
  id: string;
  trialEnds: MembershipDetailCell;
  lastActive: MembershipDetailCell;
  startedAt: MembershipDetailCell;
  premiumActivatedAt: MembershipDetailCell;
};

export function AdminUserDetailSheet({
  user,
  ...rest
}: AdminUserDetailSheetProps) {
  if (!user) {
    return null;
  }

  return <AdminUserDetailSheetContent {...rest} user={user} />;
}

function AdminUserDetailSheetContent({
  user,
  open,
  onOpenChange,
  onUserUpdated,
}: AdminUserDetailSheetContentProps) {
  const { t, i18n } = useTranslation("pages");
  const { t: tCommon } = useTranslation("common");
  const [activeTab, setActiveTab] = useState("overview");
  const [collectionViewer, setCollectionViewer] = useState<null | {
    type: "packages" | "services" | "sessionTypes";
  }>(null);
  const [collectionData, setCollectionData] = useState<any[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const locale = i18n.language || undefined;
  const dateFnsLocale = useMemo<Locale | undefined>(() => {
    if (!i18n.language) return undefined;
    const lang = i18n.language.toLowerCase();
    if (lang.startsWith("tr")) return trLocale;
    return enUS;
  }, [i18n.language]);
  const formatDateTimeLocalized = useCallback(
    (value?: string | null) => formatDateTime(value, locale),
    [locale]
  );
  const formatDateOnlyLocalized = useCallback(
    (value?: string | null) => formatDateOnly(value, locale),
    [locale]
  );
  const formatRelativeTimeLocalized = useCallback(
    (value?: string) => formatRelativeTime(value, dateFnsLocale),
    [dateFnsLocale]
  );
  const formatCurrency = useCallback(
    (value?: number | null, options?: { withSymbol?: boolean }) => {
      if (typeof value !== "number") return "—";
      const withSymbol = options?.withSymbol ?? true;
      return withSymbol ? currencyFormatter.format(value) : numberFormatter.format(value);
    },
    []
  );

  const renderActivationBadge = useCallback(
    (isActive?: boolean | null) => (
      <Badge
        variant={isActive ? "default" : "outline"}
        className={cn(
          "h-5 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide",
          isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
        )}
      >
        {isActive ? tCommon("status.active") : tCommon("status.inactive")}
      </Badge>
    ),
    [tCommon]
  );

  const kisiColumns = useMemo<Column<AdminUserLeadSummary>[]>(
    () => [
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
        render: (lead) => formatDateOnlyLocalized(lead.due_date),
      },
      {
        key: "updated_at",
        header: t("admin.users.detail.tables.kisiler.columns.updated"),
        render: (lead) => formatDateTimeLocalized(lead.updated_at),
      },
    ],
    [formatDateOnlyLocalized, formatDateTimeLocalized, t]
  );

  const projectColumns = useMemo<Column<AdminUserProjectSummary>[]>(
    () => [
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
        render: (project) =>
          project.base_price
            ? formatCurrency(project.base_price)
            : "—",
      },
      {
        key: "updated_at",
        header: t("admin.users.detail.tables.projects.columns.updated"),
        render: (project) => formatDateTimeLocalized(project.updated_at),
      },
    ],
    [formatDateTimeLocalized, t]
  );

  const sessionColumns = useMemo<Column<AdminUserSessionSummary>[]>(
    () => [
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
            ? `${formatDateOnlyLocalized(session.session_date)} ${
                session.session_time ?? ""
              }`.trim()
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
        render: (session) => formatDateTimeLocalized(session.updated_at),
      },
    ],
    [formatDateOnlyLocalized, formatDateTimeLocalized, t]
  );

  const paymentColumns = useMemo<Column<AdminUserPaymentSummary>[]>(
    () => [
      {
        key: "amount",
        header: t("admin.users.detail.tables.payments.columns.amount"),
        render: (payment) => formatCurrency(payment.amount ?? 0),
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
        render: (payment) =>
          formatDateOnlyLocalized(payment.date_paid ?? payment.created_at),
      },
      {
        key: "project_id",
        header: t("admin.users.detail.tables.payments.columns.project"),
        render: (payment) => payment.project_id || "—",
      },
    ],
    [formatDateOnlyLocalized, t]
  );

  const servicesColumns = useMemo<AdvancedTableColumn<AdminUserServiceSummary>[]>(
    () => [
      {
        id: "name",
        label: t("admin.users.detail.tables.services.columns.name"),
        sortable: true,
        accessor: (service) => service.name,
        minWidth: "200px",
      },
      {
        id: "category",
        label: t("admin.users.detail.tables.services.columns.category"),
        accessor: (service) => service.category,
      },
      {
        id: "service_type",
        label: t("admin.users.detail.tables.services.columns.type"),
        accessor: (service) => service.service_type,
      },
      {
        id: "selling_price",
        label: t("admin.users.detail.tables.services.columns.sellingPrice"),
        render: (service) => formatCurrency(service.selling_price ?? service.price),
        align: "right",
        minWidth: "140px",
      },
      {
        id: "cost_price",
        label: t("admin.users.detail.tables.services.columns.costPrice"),
        render: (service) => formatCurrency(service.cost_price),
        align: "right",
        minWidth: "140px",
      },
      {
        id: "is_active",
        label: t("admin.users.detail.tables.services.columns.status"),
        render: (service) => renderActivationBadge(service.is_active),
        minWidth: "130px",
      },
      {
        id: "updated_at",
        label: t("admin.users.detail.tables.services.columns.updated"),
        render: (service) => formatDateTimeLocalized(service.updated_at),
        minWidth: "160px",
      },
      {
        id: "created_at",
        label: t("admin.users.detail.tables.services.columns.created"),
        render: (service) => formatDateTimeLocalized(service.created_at),
        minWidth: "160px",
      },
    ],
    [formatDateTimeLocalized, renderActivationBadge, t]
  );

  const packagesColumns = useMemo<AdvancedTableColumn<AdminUserPackageSummary>[]>(
    () => [
      {
        id: "name",
        label: t("admin.users.detail.tables.packages.columns.name"),
        sortable: true,
        accessor: (pkg) => pkg.name,
        minWidth: "220px",
      },
      {
        id: "description",
        label: t("admin.users.detail.tables.packages.columns.description"),
        render: (pkg) =>
          pkg.description ? (
            <p className="text-sm text-muted-foreground line-clamp-3 max-w-xs">
              {pkg.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          ),
        minWidth: "240px",
      },
      {
        id: "price",
        label: t("admin.users.detail.tables.packages.columns.price"),
        render: (pkg) => formatCurrency(pkg.price ?? pkg.client_total ?? 0),
        align: "right",
        minWidth: "140px",
      },
      {
        id: "client_total",
        label: t("admin.users.detail.tables.packages.columns.clientTotal"),
        render: (pkg) => formatCurrency(pkg.client_total),
        align: "right",
        minWidth: "140px",
      },
      {
        id: "include_addons_in_price",
        label: t("admin.users.detail.tables.packages.columns.includeAddOns"),
        render: (pkg) => (
          <Badge
            variant={pkg.include_addons_in_price ? "default" : "outline"}
            className="h-5 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide"
          >
            {pkg.include_addons_in_price
              ? t("admin.users.detail.tables.packages.includeAddOns.included")
              : t("admin.users.detail.tables.packages.includeAddOns.excluded")}
          </Badge>
        ),
        minWidth: "150px",
      },
      {
        id: "applicable_types",
        label: t("admin.users.detail.tables.packages.columns.applicableTypes"),
        render: (pkg) => {
          const count = Array.isArray(pkg.applicable_types)
            ? pkg.applicable_types.length
            : 0;
          return (
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {count
                  ? t("admin.users.detail.tables.packages.applicableTypesRestricted", {
                      count,
                    })
                  : t("admin.users.detail.tables.packages.applicableTypesAny")}
              </p>
              {count ? (
                <p className="text-xs text-muted-foreground">
                  {t("admin.users.detail.tables.packages.applicableTypesHint")}
                </p>
              ) : null}
            </div>
          );
        },
        minWidth: "190px",
      },
      {
        id: "default_add_ons",
        label: t("admin.users.detail.tables.packages.columns.defaultAddOns"),
        render: (pkg) => {
          const count = Array.isArray(pkg.default_add_ons)
            ? pkg.default_add_ons.length
            : 0;
          return (
            <p className="text-sm font-medium">
              {count
                ? t("admin.users.detail.tables.packages.defaultAddOnsCount", {
                    count,
                  })
                : t("admin.users.detail.tables.packages.defaultAddOnsEmpty")}
            </p>
          );
        },
        minWidth: "170px",
      },
      {
        id: "services_summary",
        label: t("admin.users.detail.tables.packages.columns.services"),
        render: (pkg) => {
          const stats = summarizePackageServices(pkg);
          if (!stats.itemCount) {
            return (
              <p className="text-sm text-muted-foreground">
                {t("admin.users.detail.tables.packages.servicesEmpty")}
              </p>
            );
          }
          return (
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {t("admin.users.detail.tables.packages.servicesCount", {
                  count: stats.itemCount,
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("admin.users.detail.tables.packages.servicesQuantity", {
                  quantity: stats.totalQuantity,
                })}
              </p>
            </div>
          );
        },
        minWidth: "180px",
      },
      {
        id: "line_items_preview",
        label: t("admin.users.detail.tables.packages.columns.lineItems"),
        render: (pkg) => {
          const preview = buildLineItemPreview(pkg);
          if (!preview.total) {
            return (
              <p className="text-sm text-muted-foreground">
                {t("admin.users.detail.tables.packages.lineItemsEmpty")}
              </p>
            );
          }
          return (
            <div className="space-y-1">
              <p className="text-sm font-medium line-clamp-2">
                {preview.preview.join(", ")}
              </p>
              {preview.remaining ? (
                <p className="text-xs text-muted-foreground">
                  {t("admin.users.detail.tables.packages.lineItemsMore", {
                    count: preview.remaining,
                  })}
                </p>
              ) : null}
            </div>
          );
        },
        minWidth: "220px",
      },
      {
        id: "delivery_summary",
        label: t("admin.users.detail.tables.packages.columns.delivery"),
        render: (pkg) => {
          const lines: string[] = [
            pkg.delivery_estimate_type === "range"
              ? t("admin.users.detail.tables.packages.delivery.range")
              : t("admin.users.detail.tables.packages.delivery.single"),
          ];
          const minPhotos = coerceNumber(pkg.delivery_photo_count_min);
          const maxPhotos = coerceNumber(pkg.delivery_photo_count_max);
          if (minPhotos || maxPhotos) {
            if (
              pkg.delivery_estimate_type === "range" &&
              minPhotos != null &&
              maxPhotos != null
            ) {
              lines.push(
                t("admin.users.detail.tables.packages.delivery.photosRange", {
                  min: minPhotos,
                  max: maxPhotos,
                })
              );
            } else {
              const value = minPhotos ?? maxPhotos;
              if (value != null) {
                lines.push(
                  t("admin.users.detail.tables.packages.delivery.photosSingle", {
                    value,
                  })
                );
              }
            }
          }
          const leadValue = coerceNumber(pkg.delivery_lead_time_value);
          if (leadValue) {
            const unitLabel =
              pkg.delivery_lead_time_unit === "weeks"
                ? t("admin.users.detail.tables.packages.delivery.unit.weeks")
                : t("admin.users.detail.tables.packages.delivery.unit.days");
            lines.push(
              t("admin.users.detail.tables.packages.delivery.leadTime", {
                value: leadValue,
                unit: unitLabel,
              })
            );
          }
          const deliveryMethods = Array.isArray(pkg.delivery_methods)
            ? pkg.delivery_methods
            : [];
          if (deliveryMethods.length) {
            lines.push(
              t("admin.users.detail.tables.packages.delivery.methods", {
                count: deliveryMethods.length,
              })
            );
          }
          if (!lines.length) {
            lines.push(t("admin.users.detail.tables.packages.delivery.empty"));
          }
          return (
            <div className="space-y-1">
              {lines.map((line, index) => (
                <p
                  key={`${pkg.id}-delivery-${index}`}
                  className={
                    index === 0 ? "text-sm font-medium" : "text-xs text-muted-foreground"
                  }
                >
                  {line}
                </p>
              ))}
            </div>
          );
        },
        minWidth: "210px",
      },
      {
        id: "deposit_summary",
        label: t("admin.users.detail.tables.packages.columns.deposit"),
        render: (pkg) => {
          const meta = parsePackagePricingMetadata(pkg.pricing_metadata);
          if (!meta?.enableDeposit) {
            return (
              <p className="text-sm text-muted-foreground">
                {t("admin.users.detail.tables.packages.deposit.disabled")}
              </p>
            );
          }
          const targetLabel =
            meta.depositTarget === "base"
              ? t("admin.users.detail.tables.packages.deposit.target.base")
              : t("admin.users.detail.tables.packages.deposit.target.subtotal");
          const primaryLabel =
            meta.depositMode === "fixed"
              ? t("admin.users.detail.tables.packages.deposit.fixed", {
                  value: formatCurrency(meta.depositAmount ?? 0),
                  target: targetLabel,
                })
              : t("admin.users.detail.tables.packages.deposit.percent", {
                  value: decimalFormatter.format(meta.depositValue ?? 0),
                  target: targetLabel,
                });
          const amountLabel =
            meta.depositAmount != null
              ? t("admin.users.detail.tables.packages.deposit.amount", {
                  amount: formatCurrency(meta.depositAmount, { withSymbol: false }),
                })
              : null;
          return (
            <div className="space-y-1">
              <p className="text-sm font-medium">{primaryLabel}</p>
              {amountLabel ? (
                <p className="text-xs text-muted-foreground">{amountLabel}</p>
              ) : null}
            </div>
          );
        },
        minWidth: "200px",
      },
      {
        id: "is_active",
        label: t("admin.users.detail.tables.packages.columns.status"),
        render: (pkg) => renderActivationBadge(pkg.is_active),
        minWidth: "130px",
      },
      {
        id: "updated_at",
        label: t("admin.users.detail.tables.packages.columns.updated"),
        render: (pkg) => formatDateTimeLocalized(pkg.updated_at),
        minWidth: "160px",
      },
      {
        id: "created_at",
        label: t("admin.users.detail.tables.packages.columns.created"),
        render: (pkg) => formatDateTimeLocalized(pkg.created_at),
        minWidth: "160px",
      },
    ],
    [formatCurrency, formatDateTimeLocalized, renderActivationBadge, t]
  );

  const sessionTypeColumns = useMemo<AdvancedTableColumn<AdminUserSessionTypeSummary>[]>(
    () => [
      {
        id: "name",
        label: t("admin.users.detail.tables.sessionTypes.columns.name"),
        sortable: true,
        accessor: (sessionType) => sessionType.name,
        minWidth: "220px",
      },
      {
        id: "duration_minutes",
        label: t("admin.users.detail.tables.sessionTypes.columns.duration"),
        render: (sessionType) => `${sessionType.duration_minutes} min`,
        minWidth: "120px",
      },
      {
        id: "is_active",
        label: t("admin.users.detail.tables.sessionTypes.columns.status"),
        render: (sessionType) => renderActivationBadge(sessionType.is_active),
        minWidth: "130px",
      },
      {
        id: "updated_at",
        label: t("admin.users.detail.tables.sessionTypes.columns.updated"),
        render: (sessionType) => formatDateTimeLocalized(sessionType.updated_at),
        minWidth: "160px",
      },
      {
        id: "created_at",
        label: t("admin.users.detail.tables.sessionTypes.columns.created"),
        render: (sessionType) => formatDateTimeLocalized(sessionType.created_at),
        minWidth: "160px",
      },
    ],
    [formatDateTimeLocalized, renderActivationBadge, t]
  );

  type CollectionConfig = {
    title: string;
    table: string;
    query: string;
    columns: AdvancedTableColumn<any>[];
    rowKey: (row: any) => string;
  };

  const collectionConfigs = useMemo<Record<CollectionType, CollectionConfig>>(
    () => ({
      packages: {
        title: t("admin.users.detail.collections.packages.title"),
        table: "packages",
        query:
          [
            "id",
            "name",
            "description",
            "price",
            "client_total",
            "is_active",
            "include_addons_in_price",
            "line_items",
            "delivery_estimate_type",
            "delivery_photo_count_min",
            "delivery_photo_count_max",
            "delivery_lead_time_value",
            "delivery_lead_time_unit",
            "delivery_methods",
            "pricing_metadata",
            "default_add_ons",
            "applicable_types",
            "organization_id",
            "created_at",
            "updated_at",
          ].join(", "),
        columns: packagesColumns,
        rowKey: (row: AdminUserPackageSummary) => row.id,
      },
      services: {
        title: t("admin.users.detail.collections.services.title"),
        table: "services",
        query:
          "id, name, category, service_type, price, selling_price, cost_price, created_at, updated_at, organization_id, is_active",
        columns: servicesColumns,
        rowKey: (row: AdminUserServiceSummary) => row.id,
      },
      sessionTypes: {
        title: t("admin.users.detail.collections.sessionTypes.title"),
        table: "session_types",
        query:
          "id, name, duration_minutes, created_at, updated_at, organization_id, is_active",
        columns: sessionTypeColumns,
        rowKey: (row: AdminUserSessionTypeSummary) => row.id,
      },
    }),
    [packagesColumns, servicesColumns, sessionTypeColumns, t]
  );

  const segmentedOptions = useMemo(
    () => [
      { value: "overview", label: t("admin.users.detail.tabs.overview") },
      { value: "kisiler", label: t("admin.users.detail.tabs.kisiler") },
      { value: "projects", label: t("admin.users.detail.tabs.projects") },
      { value: "sessions", label: t("admin.users.detail.tabs.sessions") },
      { value: "payments", label: t("admin.users.detail.tabs.payments") },
    ],
    [t]
  );

  const overviewAnchors = useMemo(
    () => [
      { id: "membership", label: t("admin.users.detail.membership.title") },
      { id: "membership-history", label: t("admin.users.detail.membershipEvents.title") },
      { id: "usage", label: t("admin.users.detail.usage.title") },
      { id: "account", label: t("admin.users.detail.account.title") },
      { id: "financials", label: t("admin.users.detail.financials.title") },
    ],
    [t]
  );

  const [activeOverviewAnchor, setActiveOverviewAnchor] = useState<string | null>(
    () => overviewAnchors[0]?.id ?? null
  );

  useEffect(() => {
    setActiveOverviewAnchor((prev) => prev ?? overviewAnchors[0]?.id ?? null);
  }, [overviewAnchors]);

  const handleAnchorNav = useCallback((sectionId: string) => {
    setActiveOverviewAnchor(sectionId);
    if (typeof document === "undefined") return;
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const organizationId = user?.id ?? null;

  const membershipEventLabels = useMemo(
    () => ({
      extend_trial: t("admin.users.detail.membershipEvents.actions.extend_trial"),
      grant_premium: t("admin.users.detail.membershipEvents.actions.grant_premium"),
      grant_complimentary: t("admin.users.detail.membershipEvents.actions.grant_complimentary"),
      suspend_account: t("admin.users.detail.membershipEvents.actions.suspend_account"),
    }),
    [t]
  );

  const getMembershipEventLabel = useCallback(
    (action: string) =>
      membershipEventLabels[action as keyof typeof membershipEventLabels] ??
      t("admin.users.detail.membershipEvents.actions.default"),
    [membershipEventLabels, t]
  );

  const formatStatusLabel = useCallback(
    (status?: MembershipStatus) => {
      if (!status) {
        return t("admin.users.detail.membershipEvents.unknownStatus");
      }
      return t(`admin.users.status.${status}` as const);
    },
    [t]
  );

  const renderEventMetadata = useCallback(
    (event: AdminUserMembershipEvent) => {
      const meta = event.metadata;
      if (!meta || typeof meta !== "object") return null;
      const metaRecord = meta as Record<string, unknown>;
      const rows: string[] = [];
      if (typeof metaRecord.daysAdded === "number") {
        rows.push(
          t("admin.users.detail.membershipEvents.meta.daysAdded", {
            days: metaRecord.daysAdded,
          })
        );
      }
      if (typeof metaRecord.newTrialEndsAt === "string") {
        rows.push(
          t("admin.users.detail.membershipEvents.meta.newTrialEnd", {
            date: formatDateOnlyLocalized(metaRecord.newTrialEndsAt),
          })
        );
      }
      if (typeof metaRecord.plan === "string") {
        rows.push(
          t("admin.users.detail.membershipEvents.meta.plan", {
            plan: metaRecord.plan,
          })
        );
      }
      if (typeof metaRecord.expiresAt === "string") {
        rows.push(
          t("admin.users.detail.membershipEvents.meta.expires", {
            date: formatDateOnlyLocalized(metaRecord.expiresAt),
          })
        );
      }
      const noteValue =
        typeof metaRecord.note === "string"
          ? metaRecord.note
          : typeof metaRecord.reason === "string"
          ? metaRecord.reason
          : null;
      if (noteValue) {
        rows.push(
          t("admin.users.detail.membershipEvents.meta.note", {
            note: noteValue,
          })
        );
      }
      if (!rows.length) return null;
      return (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {rows.map((row, index) => (
            <li key={`${event.id}-meta-${index}`}>{row}</li>
          ))}
        </ul>
      );
    },
    [formatDateOnlyLocalized, t]
  );

  useEffect(() => {
    if (open) {
      setActiveTab("overview");
    } else {
      setCollectionViewer(null);
      setCollectionData([]);
      setCollectionError(null);
    }
  }, [open]);

  useEffect(() => {
    const fetchCollectionData = async () => {
      if (!collectionViewer || !organizationId) return;
      const config = collectionConfigs[collectionViewer.type];
      if (!config) return;
      setCollectionLoading(true);
      setCollectionError(null);
      const { data, error } = await supabase
        .from(config.table)
        .select(config.query)
        .eq("organization_id", organizationId)
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) {
        setCollectionError(error.message);
        setCollectionData([]);
      } else {
        setCollectionData(data ?? []);
      }
      setCollectionLoading(false);
    };
    fetchCollectionData();
  }, [collectionViewer, collectionConfigs, organizationId]);

  const socialEntries = user.business.socialChannels ?? [];
  const formatCount = (value: number) => countFormatter.format(value);
  const handleOpenCollection = (type: CollectionType) => {
    setCollectionViewer({ type });
  };
  const pendingPayments = Math.max(user.financials.overdueBalance ?? 0, 0);
  const membershipEvents = user.detail.membershipEvents ?? [];

  const getMetricLabelLines = (label: string): [string, string] => {
    const words = label.split(/\s+/).filter(Boolean);
    if (words.length === 0) return ["", ""];
    if (words.length === 1) return [words[0], ""];
    if (words.length === 2) return [words[0], words[1]];
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
  };

  const renderMetricLabel = (label: string) => {
    const [line1, line2] = getMetricLabelLines(label);
    return (
      <div className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight min-h-[36px]">
        <span className="block">{line1}</span>
        <span className="block">{line2 || "\u00A0"}</span>
      </div>
    );
  };

  type UsageMetric = {
    label: string;
    value: string;
    action?: () => void;
  };

  type UsageCardDefinition = {
    key: string;
    title: string;
    metrics: UsageMetric[];
    metricVariant?: "boxed";
  };

  const usageCards: UsageCardDefinition[] = [
    {
      key: "leads",
      title: t("admin.users.detail.usage.cards.leads.title"),
      metrics: [
        {
          label: t("admin.users.detail.usage.cards.leads.total"),
          value: formatCount(user.stats.leads),
        },
        {
          label: t("admin.users.detail.usage.cards.leads.active"),
          value: formatCount(user.stats.activeLeads),
        },
        {
          label: t("admin.users.detail.usage.cards.leads.completed"),
          value: formatCount(user.stats.completedLeads),
        },
        {
          label: t("admin.users.detail.usage.cards.leads.cancelled"),
          value: formatCount(user.stats.cancelledLeads),
        },
      ],
    },
    {
      key: "projects",
      title: t("admin.users.detail.usage.cards.projects.title"),
      metrics: [
        {
          label: t("admin.users.detail.usage.cards.projects.total"),
          value: formatCount(user.stats.projects),
        },
        {
          label: t("admin.users.detail.usage.cards.projects.active"),
          value: formatCount(user.stats.activeProjects),
        },
        {
          label: t("admin.users.detail.usage.cards.projects.completed"),
          value: formatCount(user.stats.completedProjects),
        },
        {
          label: t("admin.users.detail.usage.cards.projects.cancelled"),
          value: formatCount(user.stats.cancelledProjects),
        },
      ],
    },
    {
      key: "sessions",
      title: t("admin.users.detail.usage.cards.sessions.title"),
      metrics: [
        {
          label: t("admin.users.detail.usage.cards.sessions.total"),
          value: formatCount(user.stats.sessions),
        },
        {
          label: t("admin.users.detail.usage.cards.sessions.active"),
          value: formatCount(user.stats.activeSessions),
        },
        {
          label: t("admin.users.detail.usage.cards.sessions.completed"),
          value: formatCount(user.stats.completedSessions),
        },
        {
          label: t("admin.users.detail.usage.cards.sessions.cancelled"),
          value: formatCount(user.stats.cancelledSessions),
        },
      ],
    },
    {
      key: "payments",
      title: `${t("admin.users.detail.usage.cards.payments.title")} (TRY)`,
      metrics: [
        {
          label: t("admin.users.detail.usage.cards.payments.billed"),
          value: formatCurrency(user.financials.totalBilled, { withSymbol: false }),
        },
        {
          label: t("admin.users.detail.usage.cards.payments.collected"),
          value: formatCurrency(user.financials.totalCollected, { withSymbol: false }),
        },
        {
          label: t("admin.users.detail.usage.cards.payments.pending"),
          value: formatCurrency(pendingPayments, { withSymbol: false }),
        },
        {
          label: t("admin.users.detail.usage.cards.payments.refunded"),
          value: formatCurrency(user.financials.refundedTotal, { withSymbol: false }),
        },
      ],
    },
    {
      key: "automations",
      title: t("admin.users.detail.usage.cards.automations.title"),
      metrics: [
        {
          label: t("admin.users.detail.usage.cards.automations.templates"),
          value: formatCount(user.stats.templates),
        },
        {
          label: t("admin.users.detail.usage.cards.automations.workflows"),
          value: formatCount(user.stats.workflows),
        },
      ],
    },
    {
      key: "catalog",
      title: t("admin.users.detail.usage.cards.catalog.title"),
      metrics: [
        {
          label: t("admin.users.detail.usage.cards.catalog.packages"),
          value: formatCount(user.stats.packages),
          action: () => handleOpenCollection("packages"),
        },
        {
          label: t("admin.users.detail.usage.cards.catalog.services"),
          value: formatCount(user.stats.services),
          action: () => handleOpenCollection("services"),
        },
        {
          label: t("admin.users.detail.usage.cards.catalog.sessionTypes"),
          value: formatCount(user.stats.sessionTypes),
          action: () => handleOpenCollection("sessionTypes"),
        },
      ],
    },
  ];

  const membershipDetailRows = useMemo<MembershipDetailRow[]>(
    () => [
      {
        id: "timeline",
        trialEnds: {
          value: formatDateTimeLocalized(user.trialEndsAt),
          context:
            user.trialDaysRemaining != null
              ? t("admin.users.detail.membership.daysRemaining", {
                  days: user.trialDaysRemaining,
                })
              : undefined,
        },
        lastActive: {
          value: formatRelativeTimeLocalized(user.lastActiveAt),
        },
        startedAt: {
          value: formatDateTimeLocalized(user.membershipStartedAt),
        },
        premiumActivatedAt: {
          value: formatDateTimeLocalized(user.premiumActivatedAt),
        },
      },
    ],
    [formatDateTimeLocalized, formatRelativeTimeLocalized, t, user]
  );

  const membershipDetailColumns = useMemo<AdvancedTableColumn<MembershipDetailRow>[]>(
    () => [
      {
        id: "startedAt",
        label: t("admin.users.detail.membership.startedAt"),
        render: (row) => (
          <div className="space-y-1">
            <p className="text-sm text-foreground">{row.startedAt.value ?? "—"}</p>
            {row.startedAt.context ? (
              <p className="text-xs font-semibold text-amber-700">{row.startedAt.context}</p>
            ) : null}
          </div>
        ),
        sortable: false,
      },
      {
        id: "trialEnds",
        label: t("admin.users.detail.membership.trialEnds"),
        render: (row) => (
          <div className="space-y-1">
            <p className="text-sm text-foreground">{row.trialEnds.value ?? "—"}</p>
            {row.trialEnds.context ? (
              <p className="text-xs font-semibold text-amber-700">{row.trialEnds.context}</p>
            ) : null}
          </div>
        ),
        sortable: false,
      },
      {
        id: "premiumActivatedAt",
        label: t("admin.users.detail.membership.premiumActivatedAt"),
        render: (row) => (
          <div className="space-y-1">
            <p className="text-sm text-foreground">{row.premiumActivatedAt.value ?? "—"}</p>
            {row.premiumActivatedAt.context ? (
              <p className="text-xs font-semibold text-amber-700">{row.premiumActivatedAt.context}</p>
            ) : null}
          </div>
        ),
        sortable: false,
      },
      {
        id: "lastActive",
        label: t("admin.users.detail.membership.lastActive"),
        render: (row) => (
          <div className="space-y-1">
            <p className="text-sm text-foreground">{row.lastActive.value ?? "—"}</p>
            {row.lastActive.context ? (
              <p className="text-xs font-semibold text-amber-700">{row.lastActive.context}</p>
            ) : null}
          </div>
        ),
        sortable: false,
      },
    ],
    [t]
  );

  const membershipEventsColumns = useMemo<AdvancedTableColumn<AdminUserMembershipEvent>[]>(
    () => [
      {
        id: "action",
        label: t("admin.users.detail.membershipEvents.table.action"),
        render: (event) => (
          <p className="text-sm font-semibold text-foreground">
            {getMembershipEventLabel(event.action)}
          </p>
        ),
        minWidth: "160px",
      },
      {
        id: "actor",
        label: t("admin.users.detail.membershipEvents.table.actor"),
        render: (event) => (
          <p className="text-sm text-foreground">
            {event.adminName ?? t("admin.users.detail.membershipEvents.systemActor")}
          </p>
        ),
        minWidth: "140px",
      },
      {
        id: "previous",
        label: t("admin.users.detail.membershipEvents.table.previous"),
        render: (event) => (
          <p className="text-sm text-muted-foreground">
            {formatStatusLabel(event.previousStatus)}
          </p>
        ),
        minWidth: "140px",
      },
      {
        id: "next",
        label: t("admin.users.detail.membershipEvents.table.next"),
        render: (event) => (
          <p className="text-sm text-foreground">
            {formatStatusLabel(event.newStatus)}
          </p>
        ),
        minWidth: "140px",
      },
      {
        id: "timestamp",
        label: t("admin.users.detail.membershipEvents.table.timestamp"),
        render: (event) => (
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              {formatRelativeTimeLocalized(event.createdAt)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateTimeLocalized(event.createdAt)}
            </p>
          </div>
        ),
        minWidth: "160px",
      },
      {
        id: "details",
        label: t("admin.users.detail.membershipEvents.table.details"),
        render: (event) => renderEventMetadata(event) ?? (
          <span className="text-sm text-muted-foreground">—</span>
        ),
        minWidth: "200px",
      },
    ],
    [formatDateTimeLocalized, formatRelativeTimeLocalized, formatStatusLabel, getMembershipEventLabel, renderEventMetadata, t]
  );

  const closeCollectionViewer = (open: boolean) => {
    if (!open) {
      setCollectionViewer(null);
      setCollectionData([]);
      setCollectionError(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[95vw] sm:w-full sm:max-w-[85vw] md:max-w-[80vw] lg:max-w-[78vw] xl:max-w-[75vw] 2xl:max-w-[70vw] overflow-y-auto p-0">
        <div className="sticky top-0 z-40 border-b border-border/60 bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <SheetHeader className="settings-header-motion space-y-3 text-left">
            <SheetTitle
              className={cn(
                settingsClasses.headerTitle,
                "flex flex-wrap items-center gap-3 text-left"
              )}
            >
              {user.accountOwner ?? user.name}
              <UserStatusBadge status={user.status} />
            </SheetTitle>
            <SheetDescription className={cn(settingsClasses.headerDescription, "text-left")}>
              {user.business.businessName ?? user.company ?? user.name}
            </SheetDescription>
          </SheetHeader>
          {activeTab === "overview" && (
            <div className="mt-3">
              <nav className="flex flex-wrap gap-2">
                {overviewAnchors.map((anchor) => (
                  <button
                    key={anchor.id}
                    type="button"
                    onClick={() => handleAnchorNav(anchor.id)}
                    className={cn(
                      settingsClasses.anchorPill,
                      "text-xs font-semibold tracking-wide text-muted-foreground transition-colors",
                      activeOverviewAnchor === anchor.id && settingsClasses.anchorPillActive
                    )}
                  >
                    {anchor.label}
                  </button>
                ))}
              </nav>
            </div>
          )}
        </div>

        <div className="mt-4 px-6">
          <SegmentedControl
            value={activeTab}
            onValueChange={setActiveTab}
            options={segmentedOptions}
            className="w-full"
          />
        </div>

        <div className="px-6 pt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
            <TabsContent value="overview" className="space-y-6 pb-6">
              <OverviewSection
                id="membership"
                icon={Crown}
                title={t("admin.users.detail.membership.title")}
                description={t("admin.users.detail.membership.subtitle")}
                actions={
                  <MembershipActions
                    user={user}
                    onUserUpdated={onUserUpdated}
                    buttonRowClassName="justify-end"
                  />
                }
              >
                <AdvancedDataTable
                  data={membershipDetailRows}
                  columns={membershipDetailColumns}
                  rowKey={(row) => row.id}
                  zebra={false}
                  variant="plain"
                />
              </OverviewSection>

              <OverviewSection
                id="membership-history"
                icon={AlarmClockCheck}
                title={t("admin.users.detail.membershipEvents.title")}
                description={t("admin.users.detail.membershipEvents.description")}
              >
                <AdvancedDataTable
                  data={membershipEvents}
                  columns={membershipEventsColumns}
                  rowKey={(event) => event.id}
                  zebra={false}
                  variant="plain"
                  emptyState={
                    <p className="text-sm text-muted-foreground">
                      {t("admin.users.detail.membershipEvents.empty")}
                    </p>
                  }
                />
              </OverviewSection>

              <OverviewSection
                id="usage"
                icon={Clock}
                title={t("admin.users.detail.usage.title")}
                description={t("admin.users.detail.usage.subtitle")}
              >
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {usageCards.map((card) => (
                    <div
                      key={card.key}
                      className="space-y-3 rounded-2xl border border-border/40 bg-background/95 p-4 shadow-sm"
                    >
                      <p className="text-sm font-semibold text-foreground">
                        {card.title}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {card.metrics.map((metric) => (
                          <div
                            key={`${card.key}-${metric.label}`}
                            className={cn(
                              "rounded-xl border border-border/60 bg-card p-4 shadow-sm",
                              card.metricVariant === "boxed" && "border-primary/30"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              {renderMetricLabel(metric.label)}
                              {metric.action ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-full"
                                  onClick={metric.action}
                                >
                                  <ArrowUpRight className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                            <p className="mt-2 whitespace-nowrap text-2xl font-semibold text-foreground">
                              {metric.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </OverviewSection>

              <OverviewSection
                id="account"
                icon={Mail}
                title={t("admin.users.detail.account.title")}
                description={t("admin.users.detail.account.subtitle")}
              >
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <InfoLine
                      label={t("admin.users.detail.account.owner")}
                      value={user.accountOwner ?? "—"}
                    />
                    <InfoLine
                      label={t("admin.users.detail.account.email")}
                      value={user.email}
                    />
                    <InfoLine
                      label={t("admin.users.detail.account.timezone")}
                      value={user.timezone ?? "—"}
                    />
                    <InfoLine
                      label={t("admin.users.detail.account.businessName")}
                      value={user.business.businessName ?? "—"}
                    />
                    <InfoLine
                      label={t("admin.users.detail.account.businessEmail")}
                      value={user.business.businessEmail ?? "—"}
                    />
                    <InfoLine
                      label={t("admin.users.detail.account.businessPhone")}
                      value={user.business.businessPhone ?? "—"}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {t("admin.users.detail.account.social")}
                    </p>
                    {socialEntries.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {socialEntries.map((channel) => (
                          <a
                            key={channel.key}
                            href={ensureUrl(channel.url)}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                          >
                            {channel.label}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("admin.users.detail.account.emptySocial")}
                      </p>
                    )}
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium">
                      {t("admin.users.detail.account.notes")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {user.notes ?? t("admin.users.detail.account.emptyNotes")}
                    </p>
                  </div>
                  {user.tags?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {user.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-muted px-3 py-1 text-xs font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </OverviewSection>

              <OverviewSection
                id="financials"
                icon={Gift}
                title={t("admin.users.detail.financials.title")}
                description={t("admin.users.detail.financials.subtitle")}
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    {
                      key: "monthlyRecurringRevenue",
                      value: user.financials.monthlyRecurringRevenue,
                    },
                    {
                      key: "lifetimeValue",
                      value: user.financials.lifetimeValue,
                    },
                    {
                      key: "averageDealSize",
                      value: user.financials.averageDealSize,
                    },
                    {
                      key: "overdueBalance",
                      value: pendingPayments,
                    },
                  ].map((financial) => (
                    <div
                      key={financial.key}
                      className="rounded-2xl border border-border/40 bg-card/90 p-4 shadow-sm"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t(`admin.users.detail.financials.${financial.key}`)}
                      </p>
                      <p className="text-2xl font-semibold">
                        {formatCurrency(financial.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </OverviewSection>
            </TabsContent>

            <DetailTab
              value="kisiler"
              title={t("admin.users.detail.collections.kisiler.title")}
              description={t(
                "admin.users.detail.collections.kisiler.description"
              )}
              emptyLabel={t("admin.users.detail.collections.kisiler.empty")}
              data={user.detail.leads}
              columns={kisiColumns}
            />

            <DetailTab
              value="projects"
              title={t("admin.users.detail.collections.projects.title")}
              description={t(
                "admin.users.detail.collections.projects.description"
              )}
              emptyLabel={t("admin.users.detail.collections.projects.empty")}
              data={user.detail.projects}
              columns={projectColumns}
            />

            <DetailTab
              value="sessions"
              title={t("admin.users.detail.collections.sessions.title")}
              description={t(
                "admin.users.detail.collections.sessions.description"
              )}
              emptyLabel={t("admin.users.detail.collections.sessions.empty")}
              data={user.detail.sessions}
              columns={sessionColumns}
            />

            <DetailTab
              value="payments"
              title={t("admin.users.detail.collections.payments.title")}
              description={t(
                "admin.users.detail.collections.payments.description"
              )}
              emptyLabel={t("admin.users.detail.collections.payments.empty")}
              data={user.detail.payments}
              columns={paymentColumns}
            />
          </Tabs>
        </div>

        <AppSheetModal
          title={
            collectionViewer
            ? collectionConfigs[collectionViewer.type].title
            : ""
          }
          isOpen={Boolean(collectionViewer)}
          onOpenChange={closeCollectionViewer}
          size="wide"
        >
          {collectionLoading ? (
            <TableLoadingSkeleton />
          ) : collectionError ? (
            <p className="text-sm text-destructive">{collectionError}</p>
          ) : collectionViewer ? (
            <AdvancedDataTable
              data={collectionData as any[]}
              columns={collectionConfigs[collectionViewer.type].columns}
              rowKey={collectionConfigs[collectionViewer.type].rowKey}
              variant="plain"
              className="max-h-[70vh] overflow-y-auto"
              emptyState={
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {tCommon("messages.info.no_data")}
                </div>
              }
            />
          ) : null}
        </AppSheetModal>
      </SheetContent>
    </Sheet>
  );
}

interface OverviewSectionProps {
  id: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

function OverviewSection({ id, icon: Icon, title, description, actions, children }: OverviewSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "settings-section-surface scroll-mt-32",
        settingsTokens.section.padding
      )}
    >
      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <div className="space-y-1">
                <p className={cn(settingsClasses.sectionTitle, "m-0")}>{title}</p>
                {description ? (
                  <p className={cn(settingsClasses.sectionDescription, "m-0")}>
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
            {actions ? (
              <div className="flex w-full flex-wrap justify-start gap-2 lg:w-auto lg:justify-end">
                {actions}
              </div>
            ) : null}
          </div>
        </div>
        <div className={cn(settingsTokens.section.contentGap, "w-full")}>{children}</div>
      </div>
    </section>
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
              emptyState={
                <span className="text-sm text-muted-foreground">
                  {emptyLabel}
                </span>
              }
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
