import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useToast } from "@/hooks/use-toast";
import { ProjectServicesCard } from "./ProjectServicesCard";
import {
  ProjectServicesQuickEditDialog,
  type ProjectServiceQuickEditResult,
  type ProjectServiceQuickEditSelection,
  type QuickServiceRecord
} from "./ProjectServicesQuickEditDialog";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import {
  computeServiceTotals,
  DEFAULT_VAT_TOTALS,
  type VatTotals
} from "@/lib/payments/servicePricing";
import {
  fetchProjectServiceRecords,
  type ProjectServiceRecord
} from "@/lib/services/projectServiceRecords";
import { useOrganizationTaxProfile } from "@/hooks/useOrganizationData";
import { syncProjectOutstandingPayment } from "@/lib/payments/outstanding";

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

interface ProjectServicesSectionProps {
  projectId: string;
  onServicesUpdated?: () => void;
  refreshToken?: number;
}

export function ProjectServicesSection({ projectId, onServicesUpdated, refreshToken }: ProjectServicesSectionProps) {
  const { t } = useFormsTranslation();
  const { toast } = useToast();
  const taxProfileQuery = useOrganizationTaxProfile();
  const vatExempt = Boolean(taxProfileQuery.data?.vatExempt);
  const vatUiEnabled = !vatExempt;

  const [serviceRecords, setServiceRecords] = useState<ProjectServiceRecord[]>([]);
  const [basePrice, setBasePrice] = useState(0);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [isLoadingBasePrice, setIsLoadingBasePrice] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [availableServices, setAvailableServices] = useState<QuickServiceRecord[]>([]);
  const [availableServicesLoading, setAvailableServicesLoading] = useState(false);
  const [availableServicesError, setAvailableServicesError] = useState<string | null>(null);
  const [serviceDialogState, setServiceDialogState] = useState<{
    open: boolean;
    mode: "included" | "extra";
  }>({ open: false, mode: "included" });

  const handleLoadError = useCallback(
    (error: unknown) => {
      console.error("Error loading services:", error);
      const fallback = t("payments.services.load_error", {
        defaultValue: "Unable to load services."
      });
      const description = error instanceof Error ? error.message : fallback;
      setErrorMessage(description);
      toast({
        title: fallback,
        description,
        variant: "destructive"
      });
    },
    [t, toast]
  );

  const refreshServiceRecords = useCallback(async () => {
    const records = await fetchProjectServiceRecords(projectId);
    setServiceRecords(records);
    return records;
  }, [projectId]);

  useEffect(() => {
    let active = true;
    setIsLoadingServices(true);
    refreshServiceRecords()
      .then(() => {
        if (active) setErrorMessage(null);
      })
      .catch((error) => {
        if (active) handleLoadError(error);
      })
      .finally(() => {
        if (active) setIsLoadingServices(false);
      });
    return () => {
      active = false;
    };
  }, [refreshServiceRecords, handleLoadError]);

  useEffect(() => {
    let active = true;
    setIsLoadingBasePrice(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from<Database["public"]["Tables"]["projects"]["Row"]>("projects")
          .select("base_price")
          .eq("id", projectId)
          .single();
        if (error) throw error;
        if (active) {
          setBasePrice(data?.base_price ?? 0);
          setErrorMessage(null);
        }
      } catch (error) {
        if (active) handleLoadError(error);
      } finally {
        if (active) setIsLoadingBasePrice(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId, handleLoadError, refreshToken]);

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
      setAvailableServices(
        (data ?? []).map((service) => ({
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
        }))
      );
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

  const handleServiceDialogOpen = useCallback(
    async (mode: "included" | "extra") => {
      setServiceDialogState({ open: true, mode });
      await fetchAvailableServices();
    },
    [fetchAvailableServices]
  );

  const handleServiceQuickEditSubmit = useCallback(
    async (mode: "included" | "extra", results: ProjectServiceQuickEditResult[]) => {
      try {
        const effectiveResults = vatUiEnabled
          ? results
          : results.map((result) => ({
              ...result,
              overrides: {
                ...result.overrides,
                vatMode: undefined,
                vatRate: undefined
              }
            }));
        const existingRecordsSameMode = serviceRecords.filter(
          (record) => record.billingType === mode
        );
        const existingByServiceIdSameMode = new Map(
          existingRecordsSameMode.map((record) => [record.service.id, record])
        );
        const selectedIds = new Set(effectiveResults.map((result) => result.serviceId));

        const toDelete = existingRecordsSameMode
          .filter((record) => !selectedIds.has(record.service.id))
          .map((record) => record.projectServiceId);

        if (toDelete.length > 0) {
          const { error } = await supabase.from("project_services").delete().in("id", toDelete);
          if (error) throw error;
        }

        if (effectiveResults.length > 0) {
          const {
            data: { user }
          } = await supabase.auth.getUser();
          if (!user) {
            throw new Error(
              t("payments.user_not_authenticated", { defaultValue: "User not authenticated" })
            );
          }

          const inserts = effectiveResults
            .filter((result) => !existingByServiceIdSameMode.has(result.serviceId))
            .map((result) => {
              const quantity = Math.max(1, Number(result.quantity ?? 1));
              return {
                project_id: projectId,
                service_id: result.serviceId,
                user_id: user.id,
                billing_type: mode,
                quantity,
                unit_cost_override: result.overrides.unitCost ?? null,
                unit_price_override: result.overrides.unitPrice ?? null,
                vat_mode_override: result.overrides.vatMode ?? null,
                vat_rate_override: result.overrides.vatRate ?? null
              };
            });

          if (inserts.length > 0) {
            const organizationId = await getUserOrganizationId();
            if (!organizationId) {
              throw new Error(
                t("payments.organization_required", { defaultValue: "Organization required" })
              );
            }
            const { error } = await supabase.from("project_services").insert(inserts);
            if (error) throw error;
          }

          const toUpdate = effectiveResults.filter((result) =>
            existingByServiceIdSameMode.has(result.serviceId)
          );

          for (const result of toUpdate) {
            const existing = existingByServiceIdSameMode.get(result.serviceId);
            if (!existing) continue;
            const quantity = Math.max(1, Number(result.quantity ?? 1));
            const { error } = await supabase
              .from("project_services")
              .update({
                billing_type: mode,
                quantity,
                unit_cost_override: result.overrides.unitCost ?? null,
                unit_price_override: result.overrides.unitPrice ?? null,
                vat_mode_override: result.overrides.vatMode ?? null,
                vat_rate_override: result.overrides.vatRate ?? null
              })
              .eq("id", existing.projectServiceId);
            if (error) throw error;
          }
        }

        await refreshServiceRecords();
        onServicesUpdated?.();
        try {
          const total = includedTotals.gross + extraTotals.gross;
          await syncProjectOutstandingPayment({
            projectId,
            contractTotalOverride: total
          });
        } catch (error) {
          console.warn("Failed to resync outstanding after services update:", error);
        }
        toast({
          title: t("services.services_updated", { defaultValue: "Services updated" })
        });
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
    [onServicesUpdated, projectId, refreshServiceRecords, serviceRecords, t, toast, vatUiEnabled]
  );

  const includedServices = useMemo(
    () => serviceRecords.filter((record) => record.billingType === "included"),
    [serviceRecords]
  );
  const extraServices = useMemo(
    () => serviceRecords.filter((record) => record.billingType === "extra"),
    [serviceRecords]
  );

  const includedTotals = useMemo(
    () => aggregatePricing(includedServices, vatUiEnabled),
    [includedServices, vatUiEnabled]
  );
  const extraTotals = useMemo(
    () => aggregatePricing(extraServices, vatUiEnabled),
    [extraServices, vatUiEnabled]
  );

  const includedCardItems = useMemo(
    () =>
      includedServices.map((record) => ({
        key: record.projectServiceId,
        left: <div className="font-medium">{record.service.name}</div>,
        right: (
          <div className="font-medium text-muted-foreground">
            {t("payments.services.quantity_short", {
              count: record.quantity,
              defaultValue: "x {{count}}"
            })}
          </div>
        )
      })),
    [includedServices, t]
  );

  const extraCardItems = useMemo(
    () =>
      extraServices.map((record) => {
        const pricing = computeServiceTotals({
          unitPrice: record.service.selling_price ?? record.service.price ?? null,
          quantity: record.quantity,
          vatRate: vatUiEnabled ? record.service.vat_rate ?? null : null,
          vatMode: vatUiEnabled && record.service.price_includes_vat === false ? "exclusive" : "inclusive"
        });

        return {
          key: record.projectServiceId,
          left: <div className="font-medium">{record.service.name}</div>,
          right: (
            <div className="text-right">
              <div className="font-medium text-muted-foreground">
                {formatCurrency(pricing.gross)}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("payments.services.unit_price_line", {
                  quantity: record.quantity,
                  amount: formatCurrency(record.service.selling_price ?? record.service.price ?? 0),
                  defaultValue: "{{quantity}} × {{amount}}"
                })}
              </div>
            </div>
          )
        };
      }),
    [extraServices, t, vatUiEnabled]
  );

  const includedSelections = useMemo<ProjectServiceQuickEditSelection[]>(
    () =>
      includedServices.map((record) => ({
        serviceId: record.service.id,
        projectServiceId: record.projectServiceId,
        quantity: record.quantity,
        unitCost: record.overrides.unitCost ?? record.service.cost_price ?? null,
        unitPrice: record.overrides.unitPrice ?? record.service.selling_price ?? record.service.price ?? null,
        vatMode: vatUiEnabled
          ? record.overrides.vatMode ??
            (record.service.price_includes_vat === false ? "exclusive" : "inclusive")
          : "exclusive",
        vatRate: vatUiEnabled
          ? record.overrides.vatRate ?? record.service.vat_rate ?? null
          : null
      })),
    [includedServices, vatUiEnabled]
  );

  const extraSelections = useMemo<ProjectServiceQuickEditSelection[]>(
    () =>
      extraServices.map((record) => ({
        serviceId: record.service.id,
        projectServiceId: record.projectServiceId,
        quantity: record.quantity,
        unitCost: record.overrides.unitCost ?? record.service.cost_price ?? null,
        unitPrice: record.overrides.unitPrice ?? record.service.selling_price ?? record.service.price ?? null,
        vatMode: vatUiEnabled
          ? record.overrides.vatMode ??
            (record.service.price_includes_vat === false ? "exclusive" : "inclusive")
          : "exclusive",
        vatRate: vatUiEnabled
          ? record.overrides.vatRate ?? record.service.vat_rate ?? null
          : null
      })),
    [extraServices, vatUiEnabled]
  );

  const isLoading = isLoadingServices || isLoadingBasePrice;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            {t("services.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {[0, 1].map((item) => (
                <div
                  key={item}
                  className="h-32 rounded-xl border bg-muted/40 animate-pulse"
                />
              ))}
            </div>
          ) : errorMessage ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : (
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
                    total: formatCurrency(basePrice),
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
                    total: formatCurrency(extraTotals.gross),
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
          )}
        </CardContent>
      </Card>

      <ProjectServicesQuickEditDialog
        open={serviceDialogState.open}
        onOpenChange={(open) =>
          setServiceDialogState((previous) => ({
            ...previous,
            open
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
        }}
      />
    </>
  );
}
