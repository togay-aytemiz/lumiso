import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Clock, PackageCheck, Send } from "lucide-react";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import type { ProjectPackageSnapshot } from "@/lib/projects/projectPackageSnapshot";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchProjectServiceRecords,
  type ProjectServiceRecord,
} from "@/lib/services/projectServiceRecords";

interface ProjectPackageSummaryCardProps {
  projectId: string;
  packageId?: string | null;
  snapshot: ProjectPackageSnapshot | null;
  servicesVersion?: number;
  onEditDetails: () => void;
  onEditPackage: () => void;
}

const formatPhotoEstimate = (
  snapshot: ProjectPackageSnapshot | null,
  t: ReturnType<typeof useFormsTranslation>["t"]
) => {
  const delivery = snapshot?.delivery;
  if (!delivery || delivery.photosEnabled === false) {
    return t("project_package_card.none", { defaultValue: "Not specified" });
  }

  if (delivery.photoCountMin && delivery.photoCountMax && delivery.photoCountMin !== delivery.photoCountMax) {
    return t("project_package_card.photo_range", {
      min: delivery.photoCountMin,
      max: delivery.photoCountMax,
      defaultValue: "{{min}} – {{max}} photos",
    });
  }

  const value = delivery.photoCountMin ?? delivery.photoCountMax;
  if (!value) {
    return t("project_package_card.none", { defaultValue: "Not specified" });
  }
  return t("project_package_card.photo_single", {
    count: value,
    defaultValue: "{{count}} photos",
  });
};

const formatLeadTime = (
  snapshot: ProjectPackageSnapshot | null,
  t: ReturnType<typeof useFormsTranslation>["t"]
) => {
  const delivery = snapshot?.delivery;
  if (
    !delivery ||
    delivery.leadTimeEnabled === false ||
    !delivery.leadTimeValue ||
    !delivery.leadTimeUnit
  ) {
    return t("project_package_card.none", { defaultValue: "Not specified" });
  }
  const unit =
    delivery.leadTimeUnit === "days"
      ? t("project_package_card.days", { defaultValue: "days" })
      : t("project_package_card.weeks", { defaultValue: "weeks" });
  return t("project_package_card.lead_time", {
    value: delivery.leadTimeValue,
    unit,
    defaultValue: "{{value}} {{unit}}",
  });
};

const formatMethods = (
  snapshot: ProjectPackageSnapshot | null,
  t: ReturnType<typeof useFormsTranslation>["t"]
) => {
  const delivery = snapshot?.delivery;
  const methods = delivery?.methods;
  if (!delivery || delivery.methodsEnabled === false || !methods || methods.length === 0) {
    return t("project_package_card.none", { defaultValue: "Not specified" });
  }
  return methods.map((method) => method.name ?? method.methodId).join(", ");
};

const hasServiceDifferences = (
  records: ProjectServiceRecord[],
  snapshot: ProjectPackageSnapshot
): boolean => {
  const packageMap = new Map<string, number>();
  snapshot.lineItems
    .filter((item) => item.type === "existing" && item.serviceId)
    .forEach((item) => {
      if (!item.serviceId) return;
      const quantity = Math.max(1, Number(item.quantity ?? 1));
      packageMap.set(item.serviceId, (packageMap.get(item.serviceId) ?? 0) + quantity);
    });

  const includedRecords = records.filter((record) => record.billingType === "included");
  const actualMap = new Map<string, number>();
  includedRecords.forEach((record) => {
    actualMap.set(record.service.id, (actualMap.get(record.service.id) ?? 0) + record.quantity);
  });

  if (packageMap.size !== actualMap.size) {
    return true;
  }

  for (const [serviceId, quantity] of packageMap.entries()) {
    if (actualMap.get(serviceId) !== quantity) {
      return true;
    }
  }

  return false;
};

export function ProjectPackageSummaryCard({
  projectId,
  packageId,
  snapshot,
  servicesVersion,
  onEditDetails,
  onEditPackage,
}: ProjectPackageSummaryCardProps) {
  const { t } = useFormsTranslation();
  const [customized, setCustomized] = useState(false);
  const [serviceRecords, setServiceRecords] = useState<ProjectServiceRecord[] | null>(null);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [resolvedPackageName, setResolvedPackageName] = useState<string | null>(snapshot?.name ?? null);

  useEffect(() => {
    if (snapshot?.name) {
      setResolvedPackageName(snapshot.name);
      return;
    }
    setResolvedPackageName(null);
  }, [packageId, snapshot?.name]);

  useEffect(() => {
    if (snapshot?.name || !packageId || resolvedPackageName) {
      return;
    }
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("packages")
          .select("name")
          .eq("id", packageId)
          .single();
        if (!active) return;
        if (error) {
          console.error("Failed to resolve package name:", error);
          return;
        }
        setResolvedPackageName(data?.name ?? null);
      } catch (error) {
        if (!active) return;
        console.error("Failed to resolve package name:", error);
      }
    })();
    return () => {
      active = false;
    };
  }, [packageId, resolvedPackageName, snapshot?.name]);

  const packageLabel =
    resolvedPackageName ??
    t("project_package_card.custom_label", { defaultValue: "Custom plan" });

  const lineItemsSignature = useMemo(() => {
    if (!snapshot) return "";
    return snapshot.lineItems
      .map((item) => `${item.serviceId ?? item.name}:${item.quantity}`)
      .join("|");
  }, [snapshot]);

  useEffect(() => {
    let active = true;
    setServicesLoading(true);
    fetchProjectServiceRecords(projectId)
      .then((records) => {
        if (!active) return;
        setServiceRecords(records);
        if (snapshot) {
          setCustomized(hasServiceDifferences(records, snapshot));
        } else {
          setCustomized(false);
        }
      })
      .catch((error) => {
        console.error("Failed to load project services:", error);
        if (active) {
          setServiceRecords(null);
          setCustomized(false);
        }
      })
      .finally(() => {
        if (active) {
          setServicesLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [projectId, snapshot, lineItemsSignature, servicesVersion]);

  const photoLabel = useMemo(() => formatPhotoEstimate(snapshot, t), [snapshot, t]);
  const leadTimeLabel = useMemo(() => formatLeadTime(snapshot, t), [snapshot, t]);
  const methodsLabel = useMemo(() => formatMethods(snapshot, t), [snapshot, t]);
  const deliveryItems = useMemo(
    () => [
      {
        key: "photos",
        icon: <Camera className="h-3.5 w-3.5" />, 
        label: photoLabel,
      },
      {
        key: "lead",
        icon: <Clock className="h-3.5 w-3.5" />, 
        label: leadTimeLabel,
      },
      {
        key: "methods",
        icon: <Send className="h-3.5 w-3.5" />, 
        label: methodsLabel,
      },
    ],
    [leadTimeLabel, methodsLabel, photoLabel]
  );
  const servicesSummary = useMemo(() => {
    if (!serviceRecords || serviceRecords.length === 0) {
      return null;
    }
    const included = serviceRecords.filter((record) => record.billingType === "included");
    const extras = serviceRecords.filter((record) => record.billingType === "extra");
    return {
      includedCount: included.length,
      extraCount: extras.length,
      total: serviceRecords.length,
    };
  }, [serviceRecords]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <PackageCheck className="h-4 w-4" />
            {t("project_package_card.header_title", { defaultValue: "Project summary" })}
          </CardTitle>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="pill"
              onClick={onEditPackage}
              className="min-w-[110px]"
            >
              {snapshot
                ? t("project_package_card.change_package", { defaultValue: "Paketi değiştir" })
                : t("project_package_card.select_package", { defaultValue: "Paket seç" })}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEditDetails}
              className="h-9 rounded-lg bg-accent/10 px-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/20"
            >
            {t("project_package_card.edit_project", { defaultValue: "Düzenle" })}
          </Button>
          </div>
        </div>
        {snapshot && customized ? (
          <p className="text-xs text-muted-foreground">
            {t("project_package_card.customized_hint", {
              defaultValue: "Services were adjusted after applying this package.",
            })}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-3">
          <InfoRow
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
            label={t("project_package_card.package_label", { defaultValue: "Package" })}
            value={packageLabel}
          />
          <InfoRow
            icon={<Send className="h-4 w-4 text-primary" />}
            label={t("project_package_card.delivery_summary", { defaultValue: "Delivery" })}
            value={
              <div className="flex flex-wrap gap-2">
                {deliveryItems.map((item) => (
                  <span
                    key={item.key}
                    className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                  >
                    <span className="text-primary">{item.icon}</span>
                    <span className="text-foreground">{item.label}</span>
                  </span>
                ))}
              </div>
            }
          />
          {servicesSummary ? (
            <InfoRow
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              }
              label={t("project_package_card.custom_plan_title", {
                defaultValue: "Hizmetler",
              })}
              value={t("project_package_card.custom_plan_overview", {
                included: servicesSummary.includedCount,
                extras: servicesSummary.extraCount,
                total: servicesSummary.total,
                defaultValue: "{{included}} included • {{extras}} extras",
              })}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

interface InfoRowProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}

const InfoRow = ({ icon, label, value }: InfoRowProps) => (
  <div className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2">
    <div className="rounded-md bg-primary/10 p-2 text-primary">{icon ?? <PackageCheck className="h-4 w-4" />}</div>
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {typeof value === "string" ? (
        <p className="text-sm font-medium text-foreground line-clamp-2">{value}</p>
      ) : (
        <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
      )}
    </div>
  </div>
);
