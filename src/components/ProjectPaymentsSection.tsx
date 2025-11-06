import { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { CreditCard, PiggyBank, Edit2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { AddPaymentDialog } from "./AddPaymentDialog";
import { EditPaymentDialog } from "./EditPaymentDialog";
import {
  ProjectDepositSetupDialog,
  ProjectDepositPaymentDialog
} from "./ProjectDepositDialogs";
import {
  ProjectServicesQuickEditDialog,
  type ProjectServiceQuickEditResult,
  type ProjectServiceQuickEditSelection,
  type QuickServiceRecord,
  type VatModeOption
} from "./ProjectServicesQuickEditDialog";
import { ProjectServicesCard, type ProjectServicesCardItem } from "./ProjectServicesCard";
import {
  computeDepositAmount,
  parseDepositConfig,
  DEFAULT_DEPOSIT_CONFIG,
  type ProjectDepositConfig
} from "@/lib/payments/depositUtils";
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

interface ServiceRecord {
  projectServiceId: string;
  billingType: "included" | "extra";
  service: {
    id: string;
    name: string;
    extra: boolean;
    selling_price?: number | null;
    price?: number | null;
    vat_rate?: number | null;
    price_includes_vat?: boolean | null;
    cost_price?: number | null;
    category?: string | null;
    service_type?: "coverage" | "deliverable" | null;
  };
}

type ServiceOverride = {
  unitCost?: number | null;
  unitPrice?: number | null;
  vatMode?: VatModeOption;
  vatRate?: number | null;
};

const buildOverrideKey = (billingType: "included" | "extra", serviceId: string) =>
  `${billingType}:${serviceId}`;

interface ProjectDetails {
  id: string;
  basePrice: number;
  depositConfig: ProjectDepositConfig;
}

interface VatTotals {
  net: number;
  vat: number;
  gross: number;
}

interface FinancialSummary {
  basePrice: number;
  includedServices: ServiceRecord[];
  extraServices: ServiceRecord[];
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

const DEFAULT_VAT_TOTALS: VatTotals = { net: 0, vat: 0, gross: 0 };
const CURRENCY = "TRY";

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

const computeServicePricing = (service: ServiceRecord["service"]): VatTotals => {
  const rawAmount = Number(service.selling_price ?? service.price ?? 0);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return DEFAULT_VAT_TOTALS;
  }

  const vatRate =
    typeof service.vat_rate === "number" && service.vat_rate > 0 ? service.vat_rate : 0;
  const mode = service.price_includes_vat === false ? "exclusive" : "inclusive";

  if (vatRate <= 0) {
    return {
      net: rawAmount,
      vat: 0,
      gross: rawAmount
    };
  }

  const fraction = vatRate / 100;
  if (mode === "inclusive") {
    const vatPortion = rawAmount - rawAmount / (1 + fraction);
    const net = rawAmount - vatPortion;
    return {
      net,
      vat: vatPortion,
      gross: rawAmount
    };
  }

  const vatPortion = rawAmount * fraction;
  return {
    net: rawAmount,
    vat: vatPortion,
    gross: rawAmount + vatPortion
  };
};

const aggregatePricing = (records: ServiceRecord[]): VatTotals =>
  records.reduce<VatTotals>(
    (totals, record) => {
      const pricing = computeServicePricing(record.service);
      return {
        net: totals.net + pricing.net,
        vat: totals.vat + pricing.vat,
        gross: totals.gross + pricing.gross
      };
    },
    { ...DEFAULT_VAT_TOTALS }
  );

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
  const [rawServiceRecords, setRawServiceRecords] = useState<ServiceRecord[]>([]);
  const [serviceOverrides, setServiceOverrides] = useState<Record<string, ServiceOverride>>({});
  const [availableServices, setAvailableServices] = useState<QuickServiceRecord[]>([]);
  const [availableServicesLoading, setAvailableServicesLoading] = useState(false);
  const [availableServicesError, setAvailableServicesError] = useState<string | null>(null);

  const applyOverrides = useCallback(
    (records: ServiceRecord[], overrides: Record<string, ServiceOverride>) => {
      if (records.length === 0 || Object.keys(overrides).length === 0) {
        return records;
      }

      return records.map((record) => {
        const override = overrides[buildOverrideKey(record.billingType, record.service.id)];
        if (!override || Object.keys(override).length === 0) {
          return record;
        }

        const updatedService = { ...record.service };

        if (override.unitCost !== undefined) {
          updatedService.cost_price = override.unitCost ?? null;
        }
        if (override.unitPrice !== undefined) {
          updatedService.selling_price = override.unitPrice ?? null;
          updatedService.price = override.unitPrice ?? null;
        }
        if (override.vatMode !== undefined) {
          updatedService.price_includes_vat = override.vatMode === "inclusive";
        }
        if (override.vatRate !== undefined) {
          updatedService.vat_rate = override.vatRate ?? null;
        }

        return {
          ...record,
          service: updatedService,
        };
      });
    },
    [],
  );

  const serviceRecords = useMemo(
    () => applyOverrides(rawServiceRecords, serviceOverrides),
    [applyOverrides, rawServiceRecords, serviceOverrides],
  );

  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [depositSetupOpen, setDepositSetupOpen] = useState(false);
  const [depositPaymentOpen, setDepositPaymentOpen] = useState(false);
  const [serviceDialogState, setServiceDialogState] = useState<{
    open: boolean;
    mode: "included" | "extra";
  }>({ open: false, mode: "included" });

  const [isLoading, setIsLoading] = useState(true);

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
    type ProjectServiceJoin = {
      id: string;
      billing_type: "included" | "extra";
      services: {
        id: string;
        name: string;
        extra: boolean | null;
        selling_price?: number | null;
        price?: number | null;
        vat_rate?: number | null;
        price_includes_vat?: boolean | null;
        cost_price?: number | null;
        category?: string | null;
      } | null;
    };

    try {
      const { data, error } = await supabase
        .from<ProjectServiceJoin>("project_services")
        .select(
          `
          id,
          billing_type,
          services (
            id,
            name,
            extra,
            selling_price,
            price,
            vat_rate,
            price_includes_vat,
            cost_price,
            category,
            service_type
          )
        `
        )
        .eq("project_id", projectId);
      if (error) throw error;
      const mapped =
        data?.map((entry) => {
          const service = entry.services;
          if (!service) return null;
          return {
            projectServiceId: entry.id,
            billingType: entry.billing_type,
            service: {
              id: service.id,
              name: service.name,
              extra: Boolean(service.extra),
              selling_price: service.selling_price,
              price: service.price,
              vat_rate: service.vat_rate ?? undefined,
              price_includes_vat: service.price_includes_vat ?? undefined,
              cost_price: service.cost_price ?? undefined,
              category: service.category ?? undefined,
              service_type: service.service_type ?? undefined
            }
          } satisfies ServiceRecord;
        }) ?? [];
      const filtered = mapped.filter((record): record is ServiceRecord => Boolean(record));
      setRawServiceRecords(filtered);
      setServiceOverrides((previous) => {
        if (!previous || Object.keys(previous).length === 0) {
          return previous;
        }
        const validKeys = new Set(
          filtered.map((record) => buildOverrideKey(record.billingType, record.service.id))
        );
        const next: Record<string, ServiceOverride> = {};
        Object.entries(previous).forEach(([key, override]) => {
          if (validKeys.has(key)) {
            next[key] = override;
          }
        });
        return Object.keys(next).length === Object.keys(previous).length ? previous : next;
      });
    } catch (error) {
      console.error("Error fetching project services:", error);
    }
  }, [projectId]);

  const fetchAvailableServices = useCallback(async () => {
    if (availableServices.length > 0 || availableServicesLoading) return;
    setAvailableServicesLoading(true);
    setAvailableServicesError(null);
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error(
          t("payments.organization_required", { defaultValue: "Organization required" })
        );
      }
      const { data, error } = await supabase
        .from<Database["public"]["Tables"]["services"]["Row"]>("services")
        .select(
          "id, name, category, extra, selling_price, price, cost_price, vat_rate, price_includes_vat, service_type"
        )
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      const records =
        data?.map(
          (service): QuickServiceRecord => ({
            id: service.id,
            name: service.name,
            category: service.category,
            extra: Boolean(service.extra),
            selling_price: service.selling_price,
            price: service.price,
            cost_price: service.cost_price,
            vat_rate: service.vat_rate,
            price_includes_vat: service.price_includes_vat,
            service_type: service.service_type
          })
        ) ?? [];
      setAvailableServices(records);
    } catch (error) {
      console.error("Error fetching available services:", error);
      setAvailableServicesError(
        error instanceof Error
          ? error.message
          : t("payments.services.load_error", { defaultValue: "Unable to load services." })
      );
    } finally {
      setAvailableServicesLoading(false);
    }
  }, [availableServices.length, availableServicesLoading, t]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    (async () => {
      await Promise.allSettled([fetchProject(), fetchPayments(), fetchProjectServices()]);
      if (active) {
        setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchPayments, fetchProject, fetchProjectServices, refreshToken]);

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

  const handleServiceDialogOpen = async (mode: "included" | "extra") => {
    setServiceDialogState({ open: true, mode });
    await fetchAvailableServices();
  };

  const handleServiceQuickEditSubmit = useCallback(
    async (mode: "included" | "extra", results: ProjectServiceQuickEditResult[]) => {
      try {
        const existingRecords = rawServiceRecords.filter((record) => record.billingType === mode);
        const existingByServiceId = new Map(
          existingRecords.map((record) => [record.service.id, record])
        );
        const selectedIds = new Set(results.map((result) => result.serviceId));

        const toDelete = existingRecords
          .filter((record) => !selectedIds.has(record.service.id))
          .map((record) => record.projectServiceId);

        if (toDelete.length > 0) {
          await supabase.from("project_services").delete().in("id", toDelete);
        }

        const toInsert = results.filter(
          (result) => !existingByServiceId.has(result.serviceId)
        );

        if (toInsert.length > 0) {
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
          const inserts = toInsert.map((result) => ({
            project_id: projectId,
            service_id: result.serviceId,
            user_id: user.id,
            billing_type: mode
          }));
          await supabase.from("project_services").insert(inserts);
        }

        setServiceOverrides((previous) => {
          const next: Record<string, ServiceOverride> = { ...previous };

          existingRecords.forEach((record) => {
            if (!selectedIds.has(record.service.id)) {
              delete next[buildOverrideKey(mode, record.service.id)];
            }
          });

          results.forEach((result) => {
            const overrideKeys = Object.keys(result.overrides ?? {});
            const key = buildOverrideKey(mode, result.serviceId);
            if (overrideKeys.length > 0) {
              next[key] = result.overrides;
            } else {
              delete next[key];
            }
          });

          return next;
        });

        await fetchProjectServices();
        onPaymentsUpdated?.();
      } catch (error) {
        console.error("Error updating services:", error);
        toast({
          title: t("payments.services.quick_edit_error", {
            defaultValue: "Unable to update services"
          }),
          description: error instanceof Error ? error.message : undefined,
          variant: "destructive"
        });
      }
    },
    [fetchProjectServices, onPaymentsUpdated, projectId, rawServiceRecords, t, toast]
  );

  const renderPaymentTypeLabel = useCallback(
    (payment: Payment) => {
      switch (payment.type) {
        case "deposit_due":
          return t("payments.types.deposit_due", { defaultValue: "Deposit (due)" });
        case "deposit_payment":
          return t("payments.types.deposit_payment", { defaultValue: "Deposit payment" });
        case "base_price":
          return t("payments.types.base_price", { defaultValue: "Base price" });
        default:
          return t("payments.types.manual", { defaultValue: "Manual" });
      }
    },
    [t]
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
    return format(parsed, "PPP");
  }, []);

  const includedSelections = useMemo<ProjectServiceQuickEditSelection[]>(
    () =>
      serviceRecords
        .filter((record) => record.billingType === "included")
        .map((record) => ({
          serviceId: record.service.id,
          projectServiceId: record.projectServiceId,
          unitCost: record.service.cost_price ?? null,
          unitPrice: record.service.selling_price ?? record.service.price ?? null,
          vatMode: record.service.price_includes_vat === false ? "exclusive" : "inclusive",
          vatRate: record.service.vat_rate ?? null,
        })),
    [serviceRecords]
  );

  const extraSelections = useMemo<ProjectServiceQuickEditSelection[]>(
    () =>
      serviceRecords
        .filter((record) => record.billingType === "extra")
        .map((record) => ({
          serviceId: record.service.id,
          projectServiceId: record.projectServiceId,
          unitCost: record.service.cost_price ?? null,
          unitPrice: record.service.selling_price ?? record.service.price ?? null,
          vatMode: record.service.price_includes_vat === false ? "exclusive" : "inclusive",
          vatRate: record.service.vat_rate ?? null,
        })),
    [serviceRecords]
  );

  const includedCardItems: ProjectServicesCardItem[] = financialSummary.includedServices.map(
    (record) => ({
      key: record.projectServiceId,
      left: <div className="font-medium">{record.service.name}</div>,
      right: (
        <div className="text-xs text-muted-foreground">
          {t("payments.services.included_badge", { defaultValue: "Included" })}
        </div>
      )
    })
  );

  const extraCardItems: ProjectServicesCardItem[] = financialSummary.extraServices.map(
    (record) => {
      const pricing = computeServicePricing(record.service);

      return {
        key: record.projectServiceId,
        left: (
          <div>
            <div className="font-medium">{record.service.name}</div>
            <div className="text-xs text-muted-foreground">
              {t("payments.services.vat_line", {
                rate: record.service.vat_rate ?? 0,
                amount: formatCurrency(pricing.vat),
                defaultValue: "VAT {{rate}}% • {{amount}}"
              })}
            </div>
          </div>
        ),
        right: (
          <div className="font-medium text-muted-foreground">
            {formatCurrency(pricing.gross)}
          </div>
        )
      };
    }
  );

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
          {isLoading ? (
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
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("payments.summary.vat", { defaultValue: "Estimated VAT" })}
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {formatCurrency(
                      financialSummary.includedTotals.vat + financialSummary.extraTotals.vat
                    )}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {t("payments.summary.vat_helper", {
                      defaultValue: "Based on service VAT settings"
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
                  <div className="rounded-md bg-amber-100 p-2 text-amber-700">
                    <PiggyBank className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">
                        {t("payments.deposit.title", { defaultValue: "Deposit overview" })}
                      </h3>
                      {financialSummary.depositStatus !== "none" && (
                        <Badge variant="outline">
                          {t("payments.types.deposit", { defaultValue: "Deposit" })}
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
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => setDepositSetupOpen(true)}
                      >
                        {t("payments.deposit.actions.configure", {
                          defaultValue: "Configure deposit"
                        })}
                      </Button>
                      {financialSummary.depositStatus !== "none" && financialSummary.depositRemaining > 0 && (
                        <Button size="sm" variant="outline" onClick={() => setDepositPaymentOpen(true)}>
                          {t("payments.deposit.actions.record_payment", {
                            defaultValue: "Record deposit payment"
                          })}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <TooltipProvider delayDuration={150}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ProjectServicesCard
                    items={includedCardItems}
                    emptyCtaLabel={t("payments.services.add_included_cta", {
                      defaultValue: "Pakete dahil hizmet ekle"
                    })}
                    onAdd={() => handleServiceDialogOpen("included")}
                    title={t("payments.services.included_title", {
                      defaultValue: "Included in package"
                    })}
                    helperText={t("payments.services.included_helper", {
                      total: formatCurrency(financialSummary.basePrice),
                      defaultValue: "Paket fiyatına dahil edilmiştir."
                    })}
                    tooltipAriaLabel={t("payments.services.included_info", {
                      defaultValue: "Included services info"
                    })}
                    tooltipContent={
                      <>
                        <p className="font-medium">
                          {t("payments.services.included_tooltip.title", {
                            defaultValue: "Pakete dahil hizmetler"
                          })}
                        </p>
                        <ul className="list-disc space-y-1 pl-4">
                          <li>
                            {t("payments.services.included_tooltip.point1", {
                              defaultValue: "Müşteriye ek fatura oluşturmaz; paket fiyatına dahildir."
                            })}
                          </li>
                          <li>
                            {t("payments.services.included_tooltip.point2", {
                              defaultValue: "KDV paket toplamında hesaplanır, satır bazında gösterilmez."
                            })}
                          </li>
                          <li>
                            {t("payments.services.included_tooltip.point3", {
                              defaultValue: "Bu liste paket kapsamını ve teslimatlarını netleştirir."
                            })}
                          </li>
                        </ul>
                      </>
                    }
                    addButtonLabel={
                      includedCardItems.length > 0
                        ? t("payments.services.manage_button", {
                            defaultValue: "Hizmetleri düzenle"
                          })
                        : t("payments.services.add_button", {
                            defaultValue: "Add service"
                          })
                    }
                  />
                  <ProjectServicesCard
                    items={extraCardItems}
                    emptyCtaLabel={t("payments.services.add_extra_cta", {
                      defaultValue: "Ücrete ek hizmet ekle"
                    })}
                    onAdd={() => handleServiceDialogOpen("extra")}
                    title={t("payments.services.addons_title", {
                      defaultValue: "Add-on services"
                    })}
                    helperText={t("payments.services.addons_helper", {
                      total: formatCurrency(financialSummary.extraTotals.gross),
                      defaultValue: "Billed on top of the base package."
                    })}
                    tooltipAriaLabel={t("payments.services.addons_info", {
                      defaultValue: "Add-on services info"
                    })}
                    tooltipContent={
                      <>
                        <p className="font-medium">
                          {t("payments.services.addons_tooltip.title", {
                            defaultValue: "Ek hizmetler"
                          })}
                        </p>
                        <ul className="list-disc space-y-1 pl-4">
                          <li>
                            {t("payments.services.addons_tooltip.point1", {
                              defaultValue: "Müşteriye paket fiyatına ek olarak faturalandırılır."
                            })}
                          </li>
                          <li>
                            {t("payments.services.addons_tooltip.point2", {
                              defaultValue: "KDV ve fiyatlandırma her hizmetin moduna göre hesaplanır."
                            })}
                          </li>
                          <li>
                            {t("payments.services.addons_tooltip.point3", {
                              defaultValue: "Sözleşme ve ödeme toplamına otomatik yansır."
                            })}
                          </li>
                        </ul>
                      </>
                    }
                    addButtonLabel={
                      extraCardItems.length > 0
                        ? t("payments.services.manage_button", {
                            defaultValue: "Hizmetleri düzenle"
                          })
                        : t("payments.services.add_button", {
                            defaultValue: "Add service"
                          })
                    }
                    itemAlign="start"
                  />
                </div>
              </TooltipProvider>

              {payments.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  {t("payments.no_records", { defaultValue: "No payment records yet." })}
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => {
                    const isPaid = payment.status === "paid";
                    const displayDate =
                      formatDateSafely(payment.date_paid) ??
                      formatDateSafely(payment.created_at) ??
                      "";
                    const description = getPaymentDescription(payment);
                    const canEdit = !["base_price", "deposit_due"].includes(payment.type);
                    const canDelete = ["manual", "deposit_payment"].includes(
                      payment.type
                    );
                    return (
                      <div
                        key={payment.id}
                        className={cn(
                          "rounded-lg border transition-colors",
                          payment.type === "deposit_due"
                            ? "border-amber-300/70 bg-amber-50/50"
                            : payment.type === "base_price"
                            ? "bg-muted/30 border-muted-foreground/20"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <div className="hidden items-center justify-between p-4 md:flex">
                          <div className="flex flex-1 items-center gap-4">
                            <div className="min-w-[130px]">
                              <div className="font-medium">{displayDate}</div>
                              <div className="text-xs text-muted-foreground">
                                {renderPaymentTypeLabel(payment)}
                              </div>
                            </div>
                            <div className="min-w-[120px]">
                              <div className="text-lg font-semibold">
                                {formatCurrency(payment.amount)}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-muted-foreground truncate">
                                {description}
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "px-2 py-0.5 text-xs font-semibold",
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
                          <div className="ml-4 flex items-center gap-1">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditPayment(payment)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPaymentToDelete(payment);
                                  setShowDeleteDialog(true);
                                }}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 p-3 md:hidden">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{displayDate}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "px-2 py-0.5 text-xs font-semibold",
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
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {renderPaymentTypeLabel(payment)}
                            </span>
                            <span className="font-semibold">
                              {formatCurrency(payment.amount)}
                            </span>
                          </div>
                          {description && (
                            <div className="text-sm text-muted-foreground">{description}</div>
                          )}
                          <div className="flex items-center gap-1">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditPayment(payment)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPaymentToDelete(payment);
                                  setShowDeleteDialog(true);
                                }}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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

      <ProjectServicesQuickEditDialog
        open={serviceDialogState.open}
        onOpenChange={(open) =>
          setServiceDialogState((previous) => ({
            ...previous,
            open,
          }))
        }
        mode={serviceDialogState.mode}
        services={availableServices}
        selections={serviceDialogState.mode === "included" ? includedSelections : extraSelections}
        isLoading={availableServicesLoading}
        error={availableServicesError}
        onRetry={fetchAvailableServices}
        onSubmit={async (result) => {
          await handleServiceQuickEditSubmit(serviceDialogState.mode, result);
          await fetchProject();
        }}
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
