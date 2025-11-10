import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  CreditCard,
  Coins,
  Edit2,
  Trash2,
  HelpCircle,
  ChevronDown,
  CalendarIcon,
  CheckCircle2
} from "lucide-react";
import { format } from "date-fns";
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
import { cn, formatLongDate, getUserLocale, getDateFnsLocale } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { EditPaymentDialog } from "./EditPaymentDialog";
import {
  ProjectDepositSetupDialog,
  ProjectDepositPaymentDialog
} from "./ProjectDepositDialogs";
import { NavigationGuardDialog } from "./settings/NavigationGuardDialog";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ReactCalendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "@/components/react-calendar.css";
import { Switch } from "@/components/ui/switch";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { useI18nToast } from "@/lib/toastHelpers";
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
import { recalculateProjectOutstanding, syncProjectOutstandingPayment } from "@/lib/payments/outstanding";
import { useOrganizationTaxProfile } from "@/hooks/useOrganizationData";

type PaymentStatus = "paid" | "due";
type PaymentType = "manual" | "deposit_payment" | "balance_due";

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
  deposit_allocation: number;
  entry_kind?: "recorded" | "scheduled";
  scheduled_initial_amount?: number | null;
  scheduled_remaining_amount?: number | null;
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
  depositSuggestedAmount: number;
  depositSnapshotTotal: number | null;
  depositSnapshotLockedAt: string | null;
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

const toDateInputValue = (date?: Date) => (date ? date.toISOString().split("T")[0] : null);

const aggregatePricing = (records: ProjectServiceRecord[], vatEnabled: boolean): VatTotals =>
  records.reduce<VatTotals>(
    (totals, record) => {
      const pricing = computeServiceTotals({
        unitPrice: record.service.selling_price ?? record.service.price ?? null,
        quantity: record.quantity,
        vatRate: vatEnabled ? record.service.vat_rate ?? null : null,
        vatMode:
          vatEnabled && record.service.price_includes_vat === false ? "exclusive" : "inclusive"
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
  onBasePriceUpdated?: () => void;
  refreshToken?: number;
}

export function ProjectPaymentsSection({
  projectId,
  onPaymentsUpdated,
  onBasePriceUpdated,
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
  const [isBasePriceDialogOpen, setIsBasePriceDialogOpen] = useState(false);
  const [basePriceInput, setBasePriceInput] = useState("");
  const [isSavingBasePrice, setIsSavingBasePrice] = useState(false);

  const [depositSetupOpen, setDepositSetupOpen] = useState(false);
  const [depositPaymentOpen, setDepositPaymentOpen] = useState(false);
  const [generalPaymentOpen, setGeneralPaymentOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [isSnapshotUpdating, setIsSnapshotUpdating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedInitially = useRef(false);
  const lastOutstandingSyncRef = useRef<{ projectId: string; total: number } | null>(null);
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [isAnimatingExpansion, setIsAnimatingExpansion] = useState(false);
  const taxProfileQuery = useOrganizationTaxProfile();
  const vatExempt = Boolean(taxProfileQuery.data?.vatExempt);
  const vatUiEnabled = !vatExempt;
  const summaryGridDesktopClass = vatUiEnabled ? "xl:grid-cols-4" : "xl:grid-cols-3";

  useEffect(() => {
    toastRef.current = toast;
    tRef.current = t;
  }, [toast, t]);

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
        .eq("entry_kind", "recorded")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPayments(data ?? []);
    } catch (error) {
      console.error("Error fetching payments:", error);
      const translate = tRef.current;
      const notify = toastRef.current;
      notify({
        title: translate("payments.error_loading", { defaultValue: "Error loading payments" }),
        description:
          error instanceof Error
            ? error.message
            : translate("payments.error_loading", { defaultValue: "Unable to load payments." }),
        variant: "destructive"
      });
    }
  }, [projectId]);

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

  const handleBasePriceSave = useCallback(async () => {
    const normalizedValue = basePriceInput.replace(",", ".").trim();
    const parsed = Number.parseFloat(normalizedValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast({
        title: t("payments.base_price_invalid", {
          defaultValue: "Enter a valid package price."
        }),
        variant: "destructive"
      });
      return;
    }

    setIsSavingBasePrice(true);
    try {
      const { error } = await supabase
        .from<Database["public"]["Tables"]["projects"]["Row"]>("projects")
        .update({ base_price: parsed })
        .eq("id", projectId);
      if (error) throw error;

      await recalculateProjectOutstanding(projectId);
      await fetchProject();
      onPaymentsUpdated?.();
      onBasePriceUpdated?.();
      toast({
        title: t("payments.base_price_update_success", {
          defaultValue: "Package price updated."
        })
      });
      setIsBasePriceDialogOpen(false);
    } catch (error) {
      console.error("Error updating base price:", error);
      toast({
        title: t("payments.error_loading", {
          defaultValue: "Unable to complete this action."
        }),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive"
      });
    } finally {
      setIsSavingBasePrice(false);
    }
  }, [basePriceInput, fetchProject, onBasePriceUpdated, onPaymentsUpdated, projectId, t, toast]);

  const handleEditPayment = (payment: Payment) => {
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
      await recalculateProjectOutstanding(projectId);
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

  const depositContributionPayments = useMemo(
    () => payments.filter((payment) => payment.deposit_allocation > 0 && payment.status === "paid"),
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

    const includedTotals = aggregatePricing(includedServices, vatUiEnabled);
    const extraTotals = aggregatePricing(extraServices, vatUiEnabled);

    const contractTotal = project.basePrice + extraTotals.gross;

    const depositSuggestedAmount = computeDepositAmount(project.depositConfig ?? DEFAULT_DEPOSIT_CONFIG, {
      basePrice: project.basePrice,
      extrasTotal: extraTotals.gross,
      contractTotal
    });
    const snapshotAmount =
      project.depositConfig?.snapshot_amount != null
        ? Number(project.depositConfig.snapshot_amount)
        : null;
    const targetDepositAmount = snapshotAmount ?? depositSuggestedAmount;
    const snapshotLockedAt = project.depositConfig?.snapshot_locked_at ?? null;
    const snapshotTotal =
      project.depositConfig?.snapshot_total != null
        ? Number(project.depositConfig.snapshot_total)
        : null;

    const depositPaid = payments
      .filter((payment) => payment.status === "paid")
      .reduce((sum, payment) => sum + (payment.deposit_allocation ?? 0), 0);

    const depositRemaining = Math.max(targetDepositAmount - depositPaid, 0);
    let depositStatus: FinancialSummary["depositStatus"] = "none";
    if (targetDepositAmount > 0) {
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
      depositAmount: targetDepositAmount,
      depositSuggestedAmount,
      depositSnapshotTotal: snapshotTotal,
      depositSnapshotLockedAt: snapshotLockedAt,
      depositPaid,
      depositRemaining,
      depositStatus,
      depositLastPaymentDate: findLatestDate(depositContributionPayments),
      totalPaid,
      remaining
    };
  }, [depositContributionPayments, payments, project, serviceRecords, vatUiEnabled]);

  useEffect(() => {
    if (isBasePriceDialogOpen) {
      setBasePriceInput(
        Number.isFinite(financialSummary.basePrice)
          ? String(financialSummary.basePrice)
          : ""
      );
    }
  }, [financialSummary.basePrice, isBasePriceDialogOpen]);

  useEffect(() => {
    if (!project || isLoading) return;
    const total = Number(financialSummary.contractTotal ?? 0);
    if (!Number.isFinite(total)) {
      return;
    }
    const previous = lastOutstandingSyncRef.current;
    if (previous && previous.projectId === projectId && previous.total === total) {
      return;
    }
    lastOutstandingSyncRef.current = { projectId, total };
    void (async () => {
      try {
        await syncProjectOutstandingPayment({
          projectId,
          contractTotalOverride: total,
          description: project.name ? `Outstanding balance — ${project.name}` : undefined,
        });
      } catch (error) {
        console.warn("Unable to sync outstanding payments", error);
      }
    })();
  }, [financialSummary.contractTotal, isLoading, project, projectId]);

  const handleDepositConfigSaved = useCallback(
    async (config: ProjectDepositConfig) => {
      if (!project) return;
      setProject({ ...project, depositConfig: config });
      onPaymentsUpdated?.();
    },
    [onPaymentsUpdated, project]
  );

  const handleSnapshotAction = useCallback(
    async (mode: "refresh" | "acknowledge") => {
      if (!project) return;
      setIsSnapshotUpdating(true);
      const nextConfig: ProjectDepositConfig = {
        ...project.depositConfig,
        snapshot_amount:
          mode === "refresh"
            ? financialSummary.depositSuggestedAmount
            : project.depositConfig.snapshot_amount ?? financialSummary.depositSuggestedAmount,
        snapshot_total: financialSummary.contractTotal,
        snapshot_locked_at: new Date().toISOString()
      };
      try {
        const { error } = await supabase
          .from("projects")
          .update({ deposit_config: nextConfig })
          .eq("id", projectId);
        if (error) throw error;
        setProject((prev) => (prev ? { ...prev, depositConfig: nextConfig } : prev));
        toast({
          title:
            mode === "refresh"
              ? t("payments.deposit.snapshot_refresh_success", {
                  defaultValue: "Deposit amount updated"
                })
              : t("payments.deposit.snapshot_keep_success", {
                  defaultValue: "Deposit will remain locked"
                })
        });
      } catch (error) {
        console.error("Error updating deposit snapshot:", error);
        toast({
          title: t("payments.deposit.snapshot_error", {
            defaultValue: "Unable to update deposit lock"
          }),
          description: error instanceof Error ? error.message : undefined,
          variant: "destructive"
        });
      } finally {
        setIsSnapshotUpdating(false);
      }
    },
    [
      financialSummary.contractTotal,
      financialSummary.depositSuggestedAmount,
      project,
      projectId,
      t,
      toast
    ]
  );

  const getPaymentDescription = useCallback(
    (payment: Payment) => {
      switch (payment.type) {
        case "deposit_payment":
          return (
            payment.description ??
            t("payments.descriptions.deposit_payment", { defaultValue: "Deposit payment" })
          );
        case "balance_due":
          return (
            payment.description ??
            t("payments.descriptions.balance_due", { defaultValue: "Balance payment" })
          );
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

  const vatBreakdown = useMemo(() => {
    if (!vatUiEnabled) {
      return [];
    }
    return serviceRecords
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
      .sort((a, b) => b.vat - a.vat);
  }, [serviceRecords, vatUiEnabled]);

  const depositConfigured = financialSummary.depositStatus !== "none";
  const isDepositPaid = financialSummary.depositStatus === "paid";
  const depositEditLabel = t("payments.deposit.actions.edit_short", {
    defaultValue: "Kapora tutarını düzenle"
  });
  const lockedDepositAmount = project?.depositConfig?.snapshot_amount ?? null;
  const lockedDepositDate = financialSummary.depositSnapshotLockedAt;
  const snapshotLabel = lockedDepositAmount
    ? t(
        lockedDepositDate
          ? "payments.deposit.snapshot_locked_dated"
          : "payments.deposit.snapshot_locked",
        {
          amount: formatCurrency(lockedDepositAmount),
          date:
            lockedDepositDate != null
              ? formatDateSafely(lockedDepositDate) ?? lockedDepositDate
              : undefined,
          defaultValue:
            lockedDepositDate != null
              ? "Deposit locked at {{amount}} on {{date}}"
              : "Deposit locked at {{amount}}"
        }
      )
    : t("payments.deposit.snapshot_unlocked", {
        amount: formatCurrency(financialSummary.depositSuggestedAmount),
        defaultValue: "Deposit follows package totals (currently {{amount}})"
      });
  const snapshotTotalDiff =
    financialSummary.depositSnapshotTotal != null &&
    Math.abs(financialSummary.depositSnapshotTotal - financialSummary.contractTotal) >= 1;
  const snapshotAmountDiff =
    lockedDepositAmount != null &&
    Math.abs(financialSummary.depositSuggestedAmount - lockedDepositAmount) >= 1;
  const shouldShowSnapshotBanner =
    depositConfigured && lockedDepositAmount != null && (snapshotTotalDiff || snapshotAmountDiff);
  const canLockDeposit =
    depositConfigured && !lockedDepositAmount && financialSummary.depositSuggestedAmount > 0;
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
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <CreditCard className="h-4 w-4" />
              {t("payments.title", { defaultValue: "Payments" })}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              {depositConfigured && (
                <Button
                  size="sm"
                  variant="pill"
                  onClick={() => setDepositPaymentOpen(true)}
                  disabled={financialSummary.depositRemaining <= 0}
                >
                  {t("payments.actions.deposit_quick", { defaultValue: "Deposit payment" })}
                </Button>
              )}
              <Button
                size="sm"
                variant="pill"
                onClick={() => setGeneralPaymentOpen(true)}
              >
                {t("payments.add_payment")}
              </Button>
              <Button
                size="sm"
                variant="pillDanger"
                onClick={() => setRefundDialogOpen(true)}
                disabled={financialSummary.totalPaid <= 0}
              >
                {t("payments.actions.refund_payment", { defaultValue: "Issue refund" })}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4">
          {shouldRenderSkeleton ? (
            <div className="space-y-3 md:space-y-4">
              <div
                className={cn("grid gap-2.5 md:gap-3 md:grid-cols-2 lg:grid-cols-3", summaryGridDesktopClass)}
              >
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
              <div
                className={cn("grid gap-2.5 md:gap-3 md:grid-cols-2 lg:grid-cols-3", summaryGridDesktopClass)}
              >
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
                  <Button
                    type="button"
                    variant="textGhost"
                    size="sm"
                    className="mt-2 h-auto px-0 text-xs font-semibold text-primary"
                    onClick={() => setIsBasePriceDialogOpen(true)}
                  >
                    {t("payments.base_price_edit", { defaultValue: "Edit package price" })}
                  </Button>
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

                {vatUiEnabled && (
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
                )}
              </div>

              <div className="rounded-xl border p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "rounded-md p-2",
                        isDepositPaid
                          ? "rounded-full bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {isDepositPaid ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Coins className="h-5 w-5" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold">
                          {t("payments.deposit.title", { defaultValue: "Deposit details" })}
                        </h3>
                        {isDepositPaid && (
                          <Badge variant="success">
                            {t("payments.deposit.paid_chip", { defaultValue: "Deposit paid" })}
                          </Badge>
                        )}
                      </div>
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
                      {!isDepositPaid && (
                        <>
                          <p className="text-xs text-muted-foreground">{snapshotLabel}</p>
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
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="pill"
                      onClick={() => setDepositSetupOpen(true)}
                    >
                      {depositEditLabel}
                    </Button>
                    {canLockDeposit && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSnapshotAction("refresh")}
                        disabled={isSnapshotUpdating}
                      >
                        {t("payments.deposit.actions.lock_now", { defaultValue: "Lock amount" })}
                      </Button>
                    )}
                  </div>
                </div>

                {shouldShowSnapshotBanner && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <p className="flex-1 font-medium">
                        {t("payments.deposit.snapshot_banner", {
                          locked: formatCurrency(lockedDepositAmount ?? 0),
                          suggested: formatCurrency(financialSummary.depositSuggestedAmount),
                          defaultValue:
                            "Locked deposit {{locked}} differs from the current calculation {{suggested}}."
                        })}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <Button
                          size="sm"
                          variant="pill"
                          className={cn(
                            "!bg-amber-500 !text-white hover:!bg-amber-600 focus-visible:!ring-amber-300 shadow-sm",
                            isSnapshotUpdating && "opacity-70"
                          )}
                          onClick={() => handleSnapshotAction("refresh")}
                          disabled={isSnapshotUpdating}
                        >
                          {t("payments.deposit.actions.refresh_snapshot", {
                            defaultValue: "Update deposit amount"
                          })}
                        </Button>
                        <Button
                          size="sm"
                          variant="pill"
                          className={cn(
                            "!bg-amber-100 !text-amber-900 hover:!bg-amber-200 border border-amber-200 shadow-sm",
                            isSnapshotUpdating && "opacity-70"
                          )}
                          onClick={() => handleSnapshotAction("acknowledge")}
                          disabled={isSnapshotUpdating}
                        >
                          {t("payments.deposit.actions.keep_locked", {
                            defaultValue: "Keep current amount"
                          })}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {payments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-muted-foreground/20 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground/80" />
                    <span>
                      {t("payments.no_records", { defaultValue: "No payment records yet." })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="overflow-hidden rounded-lg border">
                    <ul className="divide-y">
                      {visiblePayments.map((payment, index) => {
                        const isPaid = payment.status === "paid";
                        const isRefund = payment.amount < 0;
                        const depositAllocation = payment.deposit_allocation ?? 0;
                        const showDepositAllocation = depositAllocation !== 0;
                        const depositAllocationLabel =
                          depositAllocation > 0
                            ? t("payments.deposit.allocation_badge", {
                                amount: formatCurrency(depositAllocation),
                                defaultValue: "Deposit share: {{amount}}",
                              })
                            : t("payments.deposit.refund_badge", {
                                amount: formatCurrency(depositAllocation),
                                defaultValue: "Kapora iadesi: {{amount}}",
                              });
                        const statusLabel = isRefund
                          ? t("payments.refund.badge", { defaultValue: "İade" })
                          : isPaid
                            ? t("payments.paid", { defaultValue: "Paid" })
                            : t("payments.due", { defaultValue: "Due" });
                        const statusBadgeClass = isRefund
                          ? "border-destructive/40 text-destructive"
                          : isPaid
                            ? PAYMENT_COLORS.paid.badgeClass
                            : PAYMENT_COLORS.due.badgeClass;
                        const displayDate =
                          formatDateSafely(payment.date_paid) ??
                          formatDateSafely(payment.created_at) ??
                          "";
                        const description = getPaymentDescription(payment);
                        const canEdit = true;
                        const canDelete = ["manual", "deposit_payment", "balance_due"].includes(payment.type);
                        const shouldAnimateExpansion =
                          isAnimatingExpansion && index >= PAYMENT_PREVIEW_COUNT;
                        return (
                          <li
                            key={payment.id}
                            className={cn(
                              "flex flex-col gap-1 px-3 py-1.5 text-sm transition-colors sm:grid sm:grid-cols-[minmax(140px,auto)_minmax(120px,auto)_1fr_auto] sm:items-center sm:gap-3 hover:bg-muted/40",
                              shouldAnimateExpansion && "animate-slide-up"
                            )}
                          >
                            <div className="text-xs font-medium text-muted-foreground sm:text-sm">
                              {displayDate}
                            </div>
                            <div
                              className={cn(
                                "font-semibold tabular-nums tracking-tight sm:justify-self-end",
                                isRefund && "text-destructive"
                              )}
                            >
                              {formatCurrency(payment.amount)}
                            </div>
                            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground sm:text-sm">
                              <span>{description}</span>
                              {showDepositAllocation && (
                                <span
                                  className={cn(
                                    "font-medium",
                                    depositAllocation > 0 ? "text-amber-700" : "text-destructive"
                                  )}
                                >
                                  {depositAllocationLabel}
                                </span>
                              )}
                              <Badge
                                variant="outline"
                                className={cn(
                                  "mt-1 w-fit px-2 py-0.5 text-[10px] font-semibold sm:hidden",
                                  statusBadgeClass,
                                  isRefund && "bg-destructive/5"
                                )}
                              >
                                {statusLabel}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-start gap-1 sm:justify-end">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "hidden px-2 py-0.5 text-[10px] font-semibold sm:inline-flex",
                                  statusBadgeClass,
                                  isRefund && "bg-destructive/5"
                                )}
                              >
                                {statusLabel}
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
        depositAmount={financialSummary.depositAmount}
        depositPaid={financialSummary.depositPaid}
        onCompleted={handlePaymentsRefresh}
      />

      <AppSheetModal
        title={t("payments.base_price_edit", { defaultValue: "Edit package price" })}
        isOpen={isBasePriceDialogOpen}
        onOpenChange={setIsBasePriceDialogOpen}
        size="content"
        footerActions={[
          {
            label: t("buttons.cancel", { defaultValue: "Cancel" }),
            variant: "outline" as const,
            onClick: () => setIsBasePriceDialogOpen(false),
            disabled: isSavingBasePrice
          },
          {
            label: isSavingBasePrice
              ? t("payments.updating", { defaultValue: "Updating..." })
              : t("payments.base_price_save", { defaultValue: "Save package price" }),
            onClick: () => void handleBasePriceSave(),
            loading: isSavingBasePrice,
            disabled: !basePriceInput.trim()
          }
        ]}
      >
        <div className="space-y-2">
          <Label htmlFor="project-base-price-input">
            {t("payments.base_price_label", { defaultValue: "Base price" })}
          </Label>
          <Input
            id="project-base-price-input"
            type="number"
            min="0"
            step="0.01"
            value={basePriceInput}
            onChange={(event) => setBasePriceInput(event.target.value)}
            placeholder="0.00"
          />
          <p className="text-xs text-muted-foreground">
            {t("payments.base_price_helper", {
              defaultValue: "Impacts deposit, outstanding, and contract totals."
            })}
          </p>
        </div>
      </AppSheetModal>

      <GeneralPaymentDialog
        projectId={projectId}
        open={generalPaymentOpen}
        onOpenChange={setGeneralPaymentOpen}
        onCompleted={handlePaymentsRefresh}
        depositRemaining={financialSummary.depositRemaining}
        outstanding={financialSummary.remaining}
      />

      <RefundPaymentDialog
        projectId={projectId}
        open={refundDialogOpen}
        onOpenChange={setRefundDialogOpen}
        onCompleted={handlePaymentsRefresh}
        depositPaid={financialSummary.depositPaid}
        totalPaid={financialSummary.totalPaid}
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

interface GeneralPaymentDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
  depositRemaining: number;
  outstanding: number;
}

interface GeneralPaymentInitialState {
  amountValue: number | null;
  amountInput: string;
  description: string;
  status: PaymentStatus;
  datePaid: string | null;
}

function GeneralPaymentDialog({
  projectId,
  open,
  onOpenChange,
  onCompleted,
  depositRemaining,
  outstanding
}: GeneralPaymentDialogProps) {
  const { t } = useFormsTranslation();
  const toast = useI18nToast();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"paid" | "due">("paid");
  const [datePaid, setDatePaid] = useState<Date | undefined>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const browserLocale = getUserLocale();

  const initialStateRef = useRef<GeneralPaymentInitialState>({
    amountValue: null,
    amountInput: "",
    description: "",
    status: "paid",
    datePaid: null
  });
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const initialDate = new Date();

      setAmount("");
      setDescription("");
      setStatus("paid");
      setDatePaid(initialDate);

      initialStateRef.current = {
        amountValue: null,
        amountInput: "",
        description: "",
        status: "paid",
        datePaid: toDateInputValue(initialDate)
      };
    }

    wasOpenRef.current = open;
  }, [open]);

  const initialState = initialStateRef.current;
  const normalizedAmount = amount.trim();
  const normalizedDescription = description.trim();
  const parsedAmount = Number.parseFloat(amount);
  const hasAmountChange =
    initialState.amountValue !== null
      ? !Number.isFinite(parsedAmount) ||
        Math.abs(parsedAmount - initialState.amountValue) > 0.000001
      : normalizedAmount.length > 0;
  const hasDescriptionChange = normalizedDescription.length > 0;
  const hasStatusChange = status !== initialState.status;
  const currentDateValue = status === "paid" ? toDateInputValue(datePaid) : null;
  const shouldCompareDate = initialState.status === "paid" && status === "paid";
  const hasDateChange =
    shouldCompareDate && currentDateValue !== initialState.datePaid;

  const isDirty = hasAmountChange || hasDescriptionChange || hasStatusChange || hasDateChange;

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      const initial = initialStateRef.current;
      setAmount(initial.amountInput);
      setDescription(initial.description);
      setStatus(initial.status);
      setDatePaid(initial.datePaid ? new Date(initial.datePaid) : undefined);
      onOpenChange(false);
    }
  });

  const handleSubmit = async () => {
    if (!amount.trim()) {
      toast.error(t("payments.amount_required"));
      return;
    }
    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error(t("payments.amount_required"));
      return;
    }

    setIsLoading(true);
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error(t("payments.user_not_authenticated", { defaultValue: "User not authenticated" }));
      }
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error(t("payments.organization_required", { defaultValue: "Organization required" }));
      }

      const depositAllocation = Math.min(parsedAmount, depositRemaining);
      const paymentDate =
        status === "paid"
          ? datePaid?.toISOString().split("T")[0] ?? new Date().toISOString().split("T")[0]
          : null;

      const { error } = await supabase.from("payments").insert({
        project_id: projectId,
        user_id: user.id,
        organization_id: organizationId,
        amount: parsedAmount,
        description: description.trim() || null,
        status,
        date_paid: paymentDate,
        type: "balance_due",
        deposit_allocation: depositAllocation
      });

      if (error) throw error;

      await recalculateProjectOutstanding(projectId);
      toast.success(t("payments.quick.balance_success", { defaultValue: "Payment recorded." }));
      onCompleted();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("payments.error_loading", { defaultValue: "An unexpected error occurred." }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      onOpenChange(false);
    }
  };

  const helperCopy =
    depositRemaining > 0
      ? t("payments.quick.balance_helper_with_deposit", {
          defaultValue: "Deposit still has an outstanding amount. This payment will be tracked as remaining balance only."
        })
      : t("payments.quick.balance_helper", {
          defaultValue: "Use this option for payments that don't affect the deposit."
        });
  const remainingHint = t("payments.quick.remaining_hint", {
    amount: formatCurrency(outstanding),
    defaultValue: "Outstanding total: {{amount}}"
  });
  const fillLabel = t("payments.quick.fill_link", { defaultValue: "Fill remaining amount" });

  return (
    <>
      <AppSheetModal
        title={t("payments.add_payment")}
        isOpen={open}
        onOpenChange={onOpenChange}
        size="content"
        dirty={isDirty}
        onDirtyClose={handleDirtyClose}
        footerActions={[
          {
            label: t("buttons.cancel"),
            onClick: () => handleDirtyClose(),
            variant: "outline" as const,
            disabled: isLoading
          },
          {
            label: isLoading ? t("payments.adding") : t("payments.add_payment"),
            onClick: () => void handleSubmit(),
            disabled: isLoading || !amount.trim(),
            loading: isLoading
          }
        ]}
      >
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{helperCopy}</p>
          <p className="text-xs text-muted-foreground">{remainingHint}</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="general-amount">{t("payments.amount_try")} *</Label>
            <button
              type="button"
              className={cn(
                "text-xs font-semibold text-primary",
                outstanding <= 0 && "opacity-50"
              )}
              onClick={() => outstanding > 0 && setAmount(String(outstanding))}
              disabled={outstanding <= 0}
            >
              {fillLabel}
            </button>
          </div>
          <Input
            id="general-amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="general-status">{t("payments.payment_status")}</Label>
          <Select value={status} onValueChange={(value: "paid" | "due") => setStatus(value)}>
            <SelectTrigger id="general-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">{t("payments.paid")}</SelectItem>
              <SelectItem value="due">{t("payments.due")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {status === "paid" && (
          <div className="space-y-2">
            <Label>{t("payments.date_paid")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !datePaid && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {datePaid
                    ? format(datePaid, "PPP", { locale: getDateFnsLocale() })
                    : t("payments.pick_date")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto min-w-[18rem] p-0 rounded-xl border border-border shadow-md" align="start">
                <div className="p-2">
                  <ReactCalendar
                    className="react-calendar w-full p-2 pointer-events-auto"
                    locale={browserLocale}
                    view="month"
                    minDetail="month"
                    next2Label={null}
                    prev2Label={null}
                    onChange={(value) => {
                      const d = Array.isArray(value) ? value[0] : value;
                      const date = d instanceof Date ? d : undefined;
                      setDatePaid(date);
                    }}
                    value={datePaid ?? null}
                    formatShortWeekday={(_, date) =>
                      new Intl.DateTimeFormat(browserLocale, { weekday: "short" }).format(date)
                    }
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="general-description">{t("payments.description")}</Label>
          <Textarea
            id="general-description"
            placeholder={t("payments.description_placeholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
      </div>
      </AppSheetModal>

      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        message={navigation.message}
      />
    </>
  );
}

interface RefundPaymentDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
  depositPaid: number;
  totalPaid: number;
}

interface RefundPaymentInitialState {
  amountInput: string;
  reason: string;
  applyToDeposit: boolean;
  datePaid: string | null;
}

function RefundPaymentDialog({
  projectId,
  open,
  onOpenChange,
  onCompleted,
  depositPaid,
  totalPaid
}: RefundPaymentDialogProps) {
  const { t } = useFormsTranslation();
  const toast = useI18nToast();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [applyToDeposit, setApplyToDeposit] = useState(false);
  const [datePaid, setDatePaid] = useState<Date | undefined>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const browserLocale = getUserLocale();

  const initialStateRef = useRef<RefundPaymentInitialState>({
    amountInput: "",
    reason: "",
    applyToDeposit: false,
    datePaid: toDateInputValue(new Date())
  });
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const initialDate = new Date();

      setAmount("");
      setReason("");
      setApplyToDeposit(false);
      setDatePaid(initialDate);

      initialStateRef.current = {
        amountInput: "",
        reason: "",
        applyToDeposit: false,
        datePaid: toDateInputValue(initialDate)
      };
    }

    wasOpenRef.current = open;
  }, [open]);

  const initialState = initialStateRef.current;
  const normalizedAmount = amount.trim();
  const normalizedReason = reason.trim();
  const currentDateValue = toDateInputValue(datePaid);
  const hasAmountChange = normalizedAmount !== initialState.amountInput;
  const hasReasonChange = normalizedReason !== initialState.reason;
  const hasApplyChange = applyToDeposit !== initialState.applyToDeposit;
  const hasDateChange = currentDateValue !== initialState.datePaid;
  const isDirty = hasAmountChange || hasReasonChange || hasApplyChange || hasDateChange;

  const canRefundFullAmount = totalPaid > 0;
  const refundAllLabel = t("payments.refund.fill_full_amount", {
    defaultValue: "Ödenen tutarın tamamını iade et"
  });

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      const initial = initialStateRef.current;
      setAmount(initial.amountInput);
      setReason(initial.reason);
      setApplyToDeposit(initial.applyToDeposit);
      setDatePaid(initial.datePaid ? new Date(initial.datePaid) : undefined);
      onOpenChange(false);
    }
  });

  const handleSubmit = async () => {
    if (!amount.trim()) {
      toast.error(t("payments.amount_required"));
      return;
    }
    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error(t("payments.amount_required"));
      return;
    }

    setIsLoading(true);
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error(t("payments.user_not_authenticated", { defaultValue: "User not authenticated" }));
      }
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error(t("payments.organization_required", { defaultValue: "Organization required" }));
      }

      const depositAllocation =
        applyToDeposit && depositPaid > 0
          ? -Math.min(parsedAmount, depositPaid)
          : 0;

      const paymentDate = datePaid?.toISOString().split("T")[0] ?? new Date().toISOString().split("T")[0];

      const { error } = await supabase.from("payments").insert({
        project_id: projectId,
        user_id: user.id,
        organization_id: organizationId,
        amount: -parsedAmount,
        description: reason.trim() || null,
        status: "paid",
        date_paid: paymentDate,
        type: "manual",
        deposit_allocation: depositAllocation
      });

      if (error) throw error;

      await recalculateProjectOutstanding(projectId);
      toast.success(t("payments.refund.success", { defaultValue: "Refund recorded." }));
      onCompleted();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("payments.error_loading", { defaultValue: "An unexpected error occurred." }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      onOpenChange(false);
    }
  };

  return (
    <>
      <AppSheetModal
        title={t("payments.refund.title", { defaultValue: "Issue refund" })}
        isOpen={open}
        onOpenChange={onOpenChange}
        size="content"
        dirty={isDirty}
        onDirtyClose={handleDirtyClose}
        footerActions={[
          {
            label: t("buttons.cancel"),
            onClick: () => handleDirtyClose(),
            variant: "outline" as const,
            disabled: isLoading
          },
          {
            label: isLoading ? t("payments.adding") : t("payments.refund.submit", { defaultValue: "Record refund" }),
            onClick: () => void handleSubmit(),
            disabled: isLoading || !amount.trim(),
            loading: isLoading
          }
        ]}
      >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">
              {t("payments.refund.deposit_toggle", { defaultValue: "Apply refund to deposit" })}
            </p>
            <p className="text-xs text-muted-foreground">
              {depositPaid > 0
                ? t("payments.refund.deposit_toggle_helper", {
                    amount: formatCurrency(depositPaid),
                    defaultValue: "Reduces collected deposit by up to {{amount}}."
                  })
                : t("payments.refund.deposit_toggle_disabled", {
                    defaultValue: "No collected deposit to refund."
                  })}
            </p>
          </div>
          <Switch
            checked={applyToDeposit && depositPaid > 0}
            disabled={depositPaid <= 0}
            onCheckedChange={(checked) => setApplyToDeposit(checked)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="refund-amount">{t("payments.refund.amount_label", { defaultValue: "Refund amount (TRY)" })} *</Label>
            <button
              type="button"
              className={cn(
                "text-xs font-semibold text-primary",
                !canRefundFullAmount && "opacity-50"
              )}
              onClick={() => canRefundFullAmount && setAmount(String(totalPaid))}
              disabled={!canRefundFullAmount}
            >
              {refundAllLabel}
            </button>
          </div>
          <Input
            id="refund-amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="refund-reason">{t("payments.refund.reason_label", { defaultValue: "Reason (optional)" })}</Label>
          <Textarea
            id="refund-reason"
            placeholder={t("payments.refund.reason_placeholder", { defaultValue: "Add an optional note" })}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("payments.date_paid")}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !datePaid && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {datePaid
                  ? format(datePaid, "PPP", { locale: getDateFnsLocale() })
                  : t("payments.pick_date")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto min-w-[18rem] p-0 rounded-xl border border-border shadow-md" align="start">
              <div className="p-2">
                <ReactCalendar
                  className="react-calendar w-full p-2 pointer-events-auto"
                  locale={browserLocale}
                  view="month"
                  minDetail="month"
                  next2Label={null}
                  prev2Label={null}
                  onChange={(value) => {
                    const d = Array.isArray(value) ? value[0] : value;
                    const date = d instanceof Date ? d : undefined;
                    setDatePaid(date);
                  }}
                  value={datePaid ?? null}
                  formatShortWeekday={(_, date) =>
                    new Intl.DateTimeFormat(browserLocale, { weekday: "short" }).format(date)
                  }
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {totalPaid <= 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("payments.refund.no_payments_hint", {
            defaultValue: "There are no recorded payments, refunds will create negative entries."
          })}
        </p>
      )}
      </AppSheetModal>

      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        message={navigation.message}
      />
    </>
  );
}
