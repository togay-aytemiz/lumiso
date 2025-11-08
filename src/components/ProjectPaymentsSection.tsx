import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { CreditCard, Coins, Edit2, Trash2, HelpCircle, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { IconActionButtonGroup } from "@/components/ui/icon-action-button-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { PAYMENT_COLORS } from "@/lib/paymentColors";
import { cn, formatLongDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { AddPaymentDialog } from "./AddPaymentDialog";
import { EditPaymentDialog } from "./EditPaymentDialog";
import {
  ProjectDepositSetupDialog,
  ProjectDepositPaymentDialog
} from "./ProjectDepositDialogs";
import {
  computeDepositAmount,
  parseDepositConfig,
  DEFAULT_DEPOSIT_CONFIG,
  type ProjectDepositConfig
} from "@/lib/payments/depositUtils";
import {
  computeServiceTotals,
  DEFAULT_VAT_TOTALS,
  type VatTotals
} from "@/lib/payments/servicePricing";
import { fetchProjectServiceRecords, type ProjectServiceRecord } from "@/lib/services/projectServiceRecords";
import type { Database } from "@/integrations/supabase/types";

type PaymentStatus = "paid" | "due";
type PaymentType = "manual" | "base_price" | "deposit_due" | "deposit_payment";

interface Payment {
  id: string;
  project_id: string;
  amount: number;
  description: string | null;
  status: PaymentStatus;
  date_paid: string | null;
  created_at: string;
  updated_at: string;
  type: PaymentType;
}


interface ProjectDetails {
  id: string;
  basePrice: number;
  depositConfig: ProjectDepositConfig;
}

interface FinancialSummary {
  basePrice: number;
  includedServices: ProjectServiceRecord[];
  extraServices: ProjectServiceRecord[];
  includedTotals: VatTotals;
  extraTotals: VatTotals;
  contractTotal: number;
  depositAmount: number;
  depositPaid: number;
  depositRemaining: number;
  depositStatus: "none" | "due" | "partial" | "paid";
  depositLastPaymentDate: string | null;
  totalPaid: number;
  remaining: number;
}

const CURRENCY = "TRY";
const PAYMENT_PREVIEW_COUNT = 3;

const formatCurrency = (amount: number) => {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: CURRENCY,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${Math.round(amount)} ${CURRENCY}`;
  }
};

const aggregatePricing = (records: ProjectServiceRecord[]): VatTotals =>
  records.reduce<VatTotals>(
    (totals, record) => {
      const pricing = computeServiceTotals({
        unitPrice: record.service.selling_price ?? record.service.price ?? null,
        quantity: record.quantity,
        vatRate: record.service.vat_rate ?? null,
        vatMode: record.service.price_includes_vat === false ? "exclusive" : "inclusive"
      });
      return {
        net: totals.net + pricing.net,
        vat: totals.vat + pricing.vat,
        gross: totals.gross + pricing.gross
      };
    },
    { ...DEFAULT_VAT_TOTALS }
  );

const iconButtonClass =
  "inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/70 focus:outline-none focus:ring-1 focus:ring-muted-foreground/40";

const findLatestDate = (payments: Payment[]): string | null => {
  if (!payments.length) return null;
  const sorted = [...payments].sort((a, b) => {
    const dateA = new Date(a.date_paid ?? a.created_at).getTime();
    const dateB = new Date(b.date_paid ?? b.created_at).getTime();
    return dateB - dateA;
  });
  const latest = sorted[0];
  return latest.date_paid ?? latest.created_at ?? null;
};

interface ProjectPaymentsSectionProps {
  projectId: string;
  onPaymentsUpdated?: () => void;
  refreshToken?: number;
}

export function ProjectPaymentsSection({
  projectId,
  onPaymentsUpdated,
  refreshToken
}: ProjectPaymentsSectionProps) {
  const { toast } = useToast();
  const { t } = useFormsTranslation();

  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ProjectServiceRecord[]>([]);

  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [depositSetupOpen, setDepositSetupOpen] = useState(false);
  const [depositPaymentOpen, setDepositPaymentOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedInitially = useRef(false);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [isAnimatingExpansion, setIsAnimatingExpansion] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from<Database["public"]["Tables"]["projects"]["Row"]>("projects")
        .select("id, base_price, deposit_config")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      if (!data) return;
      const parsed = parseDepositConfig(data.deposit_config ?? null);
      setProject({
        id: data.id,
        basePrice: Number(data.base_price ?? 0),
        depositConfig: parsed
      });
    } catch (error) {
      console.error("Error fetching project:", error);
    }
  }, [projectId]);

  const fetchPayments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from<Payment>("payments")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPayments(data ?? []);
    } catch (error) {
      console.error("Error fetching payments:", error);
      toast({
        title: t("payments.error_loading", { defaultValue: "Error loading payments" }),
        description:
          error instanceof Error ? error.message : t("payments.error_loading", { defaultValue: "Unable to load payments." }),
        variant: "destructive"
      });
    }
  }, [projectId, t, toast]);

  const fetchProjectServices = useCallback(async () => {
    try {
      const records = await fetchProjectServiceRecords(projectId);
      setServiceRecords(records);
    } catch (error) {
      console.error("Error fetching project services:", error);
    }
  }, [projectId]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    (async () => {
      await Promise.allSettled([fetchProject(), fetchPayments(), fetchProjectServices()]);
      if (active) {
        setIsLoading(false);
        hasLoadedInitially.current = true;
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchPayments, fetchProject, fetchProjectServices, refreshToken]);

  useEffect(() => {
    if (payments.length <= PAYMENT_PREVIEW_COUNT) {
      setShowAllPayments(false);
    }
  }, [payments.length]);

  useEffect(() => {
    setShowAllPayments(false);
  }, [projectId]);

  useEffect(() => {
    if (!isAnimatingExpansion) return;
    const timer = setTimeout(() => setIsAnimatingExpansion(false), 400);
    return () => clearTimeout(timer);
  }, [isAnimatingExpansion]);

  useEffect(() => {
    if (!showAllPayments) {
      setIsAnimatingExpansion(false);
    }
  }, [showAllPayments]);

  const handlePaymentsRefresh = useCallback(async () => {
    await fetchPayments();
    onPaymentsUpdated?.();
  }, [fetchPayments, onPaymentsUpdated]);

  const handleEditPayment = (payment: Payment) => {
    if (payment.type === "base_price" || payment.type === "deposit_due") {
      toast({
        title: t("payments.edit_disabled_title", { defaultValue: "Editing disabled" }),
        description: t("payments.edit_disabled_description", {
          defaultValue: "Adjust base price or deposit settings from the payment summary."
        }),
        variant: "destructive"
      });
      return;
    }
    setEditingPayment(payment);
    setShowEditDialog(true);
  };

  const handleDeletePayment = async () => {
    if (!paymentToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("id", paymentToDelete.id);
      if (error) throw error;
      toast({
        title: t("messages.success.deleted", { defaultValue: "Deleted" }),
        description: t("payments.payment_deleted", {
          defaultValue: "Payment deleted successfully"
        })
      });
      await handlePaymentsRefresh();
    } catch (error) {
      toast({
        title: t("payments.error_deleting", { defaultValue: "Error deleting payment" }),
        description:
          error instanceof Error ? error.message : t("payments.error_deleting", { defaultValue: "Unable to delete payment." }),
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setPaymentToDelete(null);
    }
  };

  const depositPayments = useMemo(
    () => payments.filter((payment) => payment.type === "deposit_payment"),
    [payments]
  );
  const depositDueRecord = useMemo(
    () => payments.find((payment) => payment.type === "deposit_due") ?? null,
    [payments]
  );
  const financialSummary = useMemo<FinancialSummary>(() => {
    if (!project) {
      return {
        basePrice: 0,
        includedServices: [],
        extraServices: [],
        includedTotals: DEFAULT_VAT_TOTALS,
        extraTotals: DEFAULT_VAT_TOTALS,
        contractTotal: 0,
        depositAmount: 0,
        depositPaid: 0,
        depositRemaining: 0,
        depositStatus: "none",
        depositLastPaymentDate: null,
        totalPaid: 0,
        remaining: 0
      };
    }

    const includedServices = serviceRecords.filter(
      (record) => record.billingType === "included"
    );
    const extraServices = serviceRecords.filter((record) => record.billingType === "extra");

    const includedTotals = aggregatePricing(includedServices);
    const extraTotals = aggregatePricing(extraServices);

    const contractTotal = project.basePrice + extraTotals.gross;

    const depositAmount = computeDepositAmount(project.depositConfig ?? DEFAULT_DEPOSIT_CONFIG, {
      basePrice: project.basePrice,
      extrasTotal: extraTotals.gross,
      contractTotal
    });

    const depositPaid = depositPayments
      .filter((payment) => payment.status === "paid")
      .reduce((sum, payment) => sum + payment.amount, 0);

    const depositRemaining = Math.max(depositAmount - depositPaid, 0);
    let depositStatus: FinancialSummary["depositStatus"] = "none";
    if (depositAmount > 0) {
      if (depositRemaining <= 0) {
        depositStatus = "paid";
      } else if (depositPaid > 0) {
        depositStatus = "partial";
      } else {
        depositStatus = "due";
      }
    }

    const totalPaid = payments
      .filter((payment) => payment.status === "paid")
      .reduce((sum, payment) => sum + payment.amount, 0);

    const remaining = Math.max(contractTotal - totalPaid, 0);

    return {
      basePrice: project.basePrice,
      includedServices,
      extraServices,
      includedTotals,
      extraTotals,
      contractTotal,
      depositAmount,
      depositPaid,
      depositRemaining,
      depositStatus,
      depositLastPaymentDate: findLatestDate(depositPayments),
      totalPaid,
      remaining
    };
  }, [project, serviceRecords, depositPayments, payments]);

  const handleDepositConfigSaved = useCallback(
    async (config: ProjectDepositConfig) => {
      if (!project) return;
      setProject({ ...project, depositConfig: config });

      const amount = computeDepositAmount(config, {
        basePrice: financialSummary.basePrice,
        extrasTotal: financialSummary.extraTotals.gross,
        contractTotal: financialSummary.contractTotal
      });

      const depositPaid = depositPayments
        .filter((payment) => payment.status === "paid")
        .reduce((sum, payment) => sum + payment.amount, 0);

      const label = config.due_label ?? t("payments.types.deposit_due", { defaultValue: "Deposit" });
      const newStatus = depositPaid >= amount && amount > 0 ? "paid" : "due";
      const latestPaymentDate = findLatestDate(depositPayments);

      try {
        if (amount <= 0 && depositDueRecord) {
          await supabase.from("payments").delete().eq("id", depositDueRecord.id);
        } else if (amount > 0 && depositDueRecord) {
          await supabase
            .from("payments")
            .update({
              amount,
              description: config.description ?? label,
              status: newStatus,
              date_paid: newStatus === "paid" ? latestPaymentDate : null,
              type: "deposit_due"
            })
            .eq("id", depositDueRecord.id);
        } else if (amount > 0 && !depositDueRecord) {
          const {
            data: { user }
          } = await supabase.auth.getUser();
          if (!user) {
            throw new Error(
              t("payments.user_not_authenticated", { defaultValue: "User not authenticated" })
            );
          }
          const organizationId = await getUserOrganizationId();
          if (!organizationId) {
            throw new Error(
              t("payments.organization_required", { defaultValue: "Organization required" })
            );
          }
          await supabase.from("payments").insert({
            project_id: projectId,
            user_id: user.id,
            organization_id: organizationId,
            amount,
            description: config.description ?? label,
            status: newStatus,
            date_paid: newStatus === "paid" ? latestPaymentDate : null,
            type: "deposit_due"
          });
        }
      } catch (error) {
        console.error("Error syncing deposit schedule:", error);
        toast({
          title: t("payments.deposit.sync_error", {
            defaultValue: "Unable to sync deposit schedule"
          }),
          description: error instanceof Error ? error.message : undefined,
          variant: "destructive"
        });
      } finally {
        await fetchPayments();
        onPaymentsUpdated?.();
      }
    },
    [
      depositDueRecord,
      depositPayments,
      fetchPayments,
      financialSummary.basePrice,
      financialSummary.contractTotal,
      financialSummary.extraTotals.gross,
      onPaymentsUpdated,
      project,
      projectId,
      t,
      toast
    ]
  );

  const getPaymentDescription = useCallback(
    (payment: Payment) => {
      switch (payment.type) {
        case "deposit_due":
          return (
            payment.description ??
            t("payments.descriptions.deposit_due", { defaultValue: "Scheduled deposit" })
          );
        case "deposit_payment":
          return (
            payment.description ??
            t("payments.descriptions.deposit_payment", { defaultValue: "Deposit payment" })
          );
        case "base_price":
          return t("payments.base_price_label", { defaultValue: "Base Price" });
        default:
          return payment.description?.trim() || t("payments.no_description", { defaultValue: "No description provided" });
      }
    },
    [t]
  );

  const formatDateSafely = useCallback((value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return formatLongDate(parsed);
  }, []);

  const vatBreakdown = useMemo(
    () =>
      serviceRecords
        .map((record) => {
          const totals = computeServiceTotals({
            unitPrice: record.service.selling_price ?? record.service.price ?? null,
            quantity: record.quantity,
            vatRate: record.service.vat_rate ?? null,
            vatMode: record.service.price_includes_vat === false ? "exclusive" : "inclusive"
          });
          return {
            key: record.projectServiceId,
            name: record.service.name,
            vat: totals.vat,
            billingType: record.billingType
          };
        })
        .filter((entry) => entry.vat > 0)
        .sort((a, b) => b.vat - a.vat),
    [serviceRecords]
  );

  const depositConfigured = financialSummary.depositStatus !== "none";
  const depositEditLabel = t("payments.deposit.actions.edit_short", { defaultValue: "Edit" });
  const depositRecordLabel = t("payments.deposit.actions.record_short", { defaultValue: "Record payment" });
  const shouldRenderSkeleton = isLoading && !hasLoadedInitially.current;
  const isRefreshing = isLoading && hasLoadedInitially.current;
  const visiblePayments = showAllPayments
    ? payments
    : payments.slice(0, PAYMENT_PREVIEW_COUNT);
  const canShowMorePayments =
    !showAllPayments && payments.length > PAYMENT_PREVIEW_COUNT;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <CreditCard className="h-4 w-4" />
              {t("payments.title", { defaultValue: "Payments" })}
            </CardTitle>
            <AddPaymentDialog projectId={projectId} onPaymentAdded={handlePaymentsRefresh} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {shouldRenderSkeleton ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-24 rounded-xl border bg-muted animate-pulse" />
                ))}
              </div>
              <div className="h-32 rounded-xl border bg-muted animate-pulse" />
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-14 rounded-lg border bg-muted animate-pulse" />
                ))}
              </div>
            </div>
          ) : (
            <>
              {isRefreshing ? (
                <div className="flex items-center justify-end text-xs text-muted-foreground">
                  <span className="animate-pulse">
                    {t("common:status.updating", { defaultValue: "Güncelleniyor..." })}
                  </span>
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("payments.summary.contract_total", { defaultValue: "Project total" })}
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {formatCurrency(financialSummary.contractTotal)}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {t("payments.summary.contract_helper", {
                      base: formatCurrency(financialSummary.basePrice),
                      extras: formatCurrency(financialSummary.extraTotals.gross),
                      defaultValue: "Base {{base}} + extras {{extras}}"
                    })}
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("payments.summary.collected", { defaultValue: "Collected" })}
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {formatCurrency(financialSummary.totalPaid)}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {t("payments.summary.collected_helper", {
                      defaultValue: "All recorded payments"
                    })}
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("payments.summary.remaining", { defaultValue: "Outstanding" })}
                  </div>
                  <div
                    className={cn(
                      "mt-2 text-2xl font-semibold",
                      financialSummary.remaining > 0 ? "text-orange-600" : "text-emerald-600"
                    )}
                  >
                    {formatCurrency(financialSummary.remaining)}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {t("payments.summary.remaining_helper", {
                      defaultValue: "Contract total minus collected"
                    })}
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t("payments.summary.vat", { defaultValue: "Estimated VAT" })}
                      </div>
                      <div className="mt-2 text-2xl font-semibold">
                        {formatCurrency(
                          financialSummary.includedTotals.vat + financialSummary.extraTotals.vat
                        )}
                      </div>
                    </div>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className={iconButtonClass}
                            aria-label={t("payments.summary.vat_breakdown_aria", {
                              defaultValue: "Show VAT breakdown"
                            })}
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs space-y-2 text-sm leading-relaxed">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t("payments.summary.vat_breakdown_title", {
                              defaultValue: "VAT breakdown"
                            })}
                          </p>
                          {vatBreakdown.length > 0 ? (
                            <ul className="space-y-1">
                              {vatBreakdown.map((entry) => (
                                <li
                                  key={entry.key}
                                  className="flex items-start justify-between gap-3 text-xs"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate font-medium">{entry.name}</div>
                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                      {entry.billingType === "included"
                                        ? t("payments.services.included_badge", {
                                            defaultValue: "Included"
                                          })
                                        : t("payments.services.addons_badge", {
                                            defaultValue: "Add-on"
                                          })}
                                    </div>
                                  </div>
                                  <div className="shrink-0 font-semibold">
                                    {formatCurrency(entry.vat)}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {t("payments.summary.vat_breakdown_empty", {
                                defaultValue: "No VAT calculated yet."
                              })}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {t("payments.summary.vat_helper", {
                      defaultValue: "Based on service VAT settings"
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-amber-100 p-2 text-amber-700">
                      <Coins className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold">
                        {t("payments.deposit.title", { defaultValue: "Deposit details" })}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {financialSummary.depositStatus === "none" &&
                          t("payments.deposit.not_configured", {
                            defaultValue: "No deposit configured for this project."
                          })}
                        {financialSummary.depositStatus === "due" &&
                          t("payments.deposit.due", {
                            amount: formatCurrency(financialSummary.depositAmount),
                            defaultValue: "{{amount}} deposit outstanding."
                          })}
                        {financialSummary.depositStatus === "partial" &&
                          t("payments.deposit.partial", {
                            paid: formatCurrency(financialSummary.depositPaid),
                            required: formatCurrency(financialSummary.depositAmount),
                            remaining: formatCurrency(financialSummary.depositRemaining),
                            defaultValue: "{{paid}} of {{required}} collected ({{remaining}} remaining)."
                          })}
                        {financialSummary.depositStatus === "paid" &&
                          t("payments.deposit.paid", {
                            amount: formatCurrency(financialSummary.depositAmount),
                            defaultValue: "Deposit collected ({{amount}})."
                          })}
                      </p>
                      {financialSummary.depositLastPaymentDate && (
                        <p className="text-xs text-muted-foreground">
                          {t("payments.deposit.last_payment", {
                            date:
                              formatDateSafely(financialSummary.depositLastPaymentDate) ??
                              financialSummary.depositLastPaymentDate,
                            defaultValue: "Last deposit payment on {{date}}."
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDepositSetupOpen(true)}
                    >
                      {depositEditLabel}
                    </Button>
                    {depositConfigured && financialSummary.depositRemaining > 0 && (
                      <Button size="sm" onClick={() => setDepositPaymentOpen(true)}>
                        {depositRecordLabel}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {payments.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  {t("payments.no_records", { defaultValue: "No payment records yet." })}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="overflow-hidden rounded-lg border">
                    <ul className="divide-y">
                      {visiblePayments.map((payment, index) => {
                        const isPaid = payment.status === "paid";
                        const displayDate =
                          formatDateSafely(payment.date_paid) ??
                          formatDateSafely(payment.created_at) ??
                          "";
                        const description = getPaymentDescription(payment);
                        const canEdit = !["base_price", "deposit_due"].includes(payment.type);
                        const canDelete = ["manual", "deposit_payment"].includes(payment.type);
                        const shouldAnimateExpansion =
                          isAnimatingExpansion && index >= PAYMENT_PREVIEW_COUNT;
                        return (
                          <li
                            key={payment.id}
                            className={cn(
                              "flex flex-col gap-2 px-3 py-2 text-sm transition-colors sm:grid sm:grid-cols-[minmax(140px,auto)_minmax(110px,auto)_1fr_auto] sm:items-center",
                              payment.type === "deposit_due"
                                ? "bg-amber-50/70"
                                : payment.type === "base_price"
                                ? "bg-muted/40"
                                : "hover:bg-muted/40",
                              shouldAnimateExpansion && "animate-slide-up"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2 sm:justify-start">
                              <div>
                                <div className="font-medium tabular-nums">{displayDate}</div>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "px-2 py-0.5 text-[10px] font-semibold sm:hidden",
                                  isPaid
                                    ? PAYMENT_COLORS.paid.badgeClass
                                    : PAYMENT_COLORS.due.badgeClass
                                )}
                              >
                                {isPaid
                                  ? t("payments.paid", { defaultValue: "Paid" })
                                  : t("payments.due", { defaultValue: "Due" })}
                              </Badge>
                            </div>
                            <div className="font-semibold tabular-nums sm:justify-self-end">
                              {formatCurrency(payment.amount)}
                            </div>
                            <div className="text-xs text-muted-foreground sm:text-sm">
                              {description}
                            </div>
                            <div className="flex items-center justify-start gap-1 sm:justify-end">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "hidden px-2 py-0.5 text-[10px] font-semibold sm:inline-flex",
                                  isPaid
                                    ? PAYMENT_COLORS.paid.badgeClass
                                    : PAYMENT_COLORS.due.badgeClass
                                )}
                              >
                                {isPaid
                                  ? t("payments.paid", { defaultValue: "Paid" })
                                  : t("payments.due", { defaultValue: "Due" })}
                              </Badge>
                              {(canEdit || canDelete) && (
                                <IconActionButtonGroup className="ml-1">
                                  {canEdit && (
                                    <IconActionButton onClick={() => handleEditPayment(payment)}>
                                      <Edit2 className="h-4 w-4" />
                                      <span className="sr-only">
                                        {t("payments.actions.edit", { defaultValue: "Edit payment" })}
                                      </span>
                                    </IconActionButton>
                                  )}
                                  {canDelete && (
                                    <IconActionButton
                                      variant="danger"
                                      onClick={() => {
                                        setPaymentToDelete(payment);
                                        setShowDeleteDialog(true);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">
                                        {t("payments.actions.delete", {
                                          defaultValue: "Delete payment"
                                        })}
                                      </span>
                                    </IconActionButton>
                                  )}
                                </IconActionButtonGroup>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  {canShowMorePayments ? (
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        variant="textGhost"
                        size="sm"
                        className="group h-auto gap-1 px-0 py-0 text-sm font-medium"
                        onClick={() => {
                          setShowAllPayments(true);
                          setIsAnimatingExpansion(true);
                        }}
                      >
                        {t("payments.show_more", { defaultValue: "Show more payments" })}
                        <ChevronDown
                          className="h-3.5 w-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <EditPaymentDialog
        payment={editingPayment}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onPaymentUpdated={handlePaymentsRefresh}
      />

      <ProjectDepositSetupDialog
        projectId={projectId}
        open={depositSetupOpen}
        onOpenChange={setDepositSetupOpen}
        config={project?.depositConfig ?? DEFAULT_DEPOSIT_CONFIG}
        basePrice={financialSummary.basePrice}
        extrasTotal={financialSummary.extraTotals.gross}
        contractTotal={financialSummary.contractTotal}
        onConfigSaved={handleDepositConfigSaved}
      />

      <ProjectDepositPaymentDialog
        projectId={projectId}
        open={depositPaymentOpen}
        onOpenChange={setDepositPaymentOpen}
        depositDue={
          depositDueRecord
            ? {
                id: depositDueRecord.id,
                amount: depositDueRecord.amount,
                status: depositDueRecord.status,
                date_paid: depositDueRecord.date_paid,
                description: depositDueRecord.description
              }
            : null
        }
        depositAmount={financialSummary.depositAmount}
        depositPaid={financialSummary.depositPaid}
        onCompleted={handlePaymentsRefresh}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("payments.delete_payment", { defaultValue: "Delete Payment" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("payments.delete_payment_confirm", {
                defaultValue: "Are you sure you want to delete this payment?"
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("buttons.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePayment}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting
                ? t("payments.deleting", { defaultValue: "Deleting..." })
                : t("payments.delete_payment", { defaultValue: "Delete Payment" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
