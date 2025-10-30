import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePackages, useProjectTypes, useServices } from "@/hooks/useOrganizationData";
import { useProjectCreationContext } from "../hooks/useProjectCreationContext";
import { useProjectCreationActions } from "../hooks/useProjectCreationActions";
import { ServicePicker, PickerService } from "@/components/ServicePicker";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles } from "lucide-react";
import type { ProjectCreationDetails, ProjectCreationServices } from "../types";

interface PackageRecord {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  applicable_types: string[];
  default_add_ons: string[];
  is_active?: boolean;
}

interface ServiceRecord extends PickerService {
  category?: string | null;
  cost_price?: number | null;
  selling_price?: number | null;
  price?: number | null;
}

export const PackagesStep = () => {
  const { t } = useTranslation("projectCreation");
  const { state } = useProjectCreationContext();
  const { updateServices, updateDetails } = useProjectCreationActions();

  const packagesQuery = usePackages();
  const servicesQuery = useServices();
  const projectTypesQuery = useProjectTypes();

  const packages = (packagesQuery.data as PackageRecord[]) ?? [];
  const services = (servicesQuery.data as ServiceRecord[]) ?? [];
  const projectTypes = projectTypesQuery.data ?? [];
  const actionsRef = useRef<HTMLDivElement | null>(null);

  const selectedProjectType = useMemo(
    () => projectTypes.find((type: any) => type.id === state.details.projectTypeId),
    [projectTypes, state.details.projectTypeId]
  );

  const filteredPackages = useMemo(() => {
    if (!selectedProjectType) {
      return packages.filter((pkg) => pkg.is_active !== false);
    }
    return packages.filter((pkg) => {
      if (pkg.is_active === false) return false;
      if (!pkg.applicable_types || pkg.applicable_types.length === 0) return true;
      return pkg.applicable_types.includes(selectedProjectType.name);
    });
  }, [packages, selectedProjectType]);

  const servicePickerServices = useMemo<PickerService[]>(
    () =>
      services
        .filter((service) => service.isActive !== false)
        .map((service) => ({
          id: service.id,
          name: service.name,
          category: service.category,
          cost_price: service.cost_price ?? undefined,
          selling_price: service.selling_price ?? service.price ?? undefined,
        })),
    [services]
  );

  const selectedPackage = state.services.packageId
    ? filteredPackages.find((pkg) => pkg.id === state.services.packageId) ??
      packages.find((pkg) => pkg.id === state.services.packageId)
    : undefined;

  const showCustomSetup =
    Boolean(state.services.packageId) ||
    state.services.showCustomSetup ||
    state.services.selectedServiceIds.length > 0;

  useEffect(() => {
    if (!actionsRef.current) return;
    if (!state.services.packageId && !showCustomSetup) return;
    actionsRef.current.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  }, [state.services.packageId, showCustomSetup]);

  const renderServicePreview = (pkg: PackageRecord) => {
    const defaultServiceIds = pkg.default_add_ons ?? [];
    const defaultServices = services.filter((service) =>
      defaultServiceIds.includes(service.id)
    );
    if (!defaultServices.length) {
      return null;
    }

    const maxToShow = 5;
    const list = defaultServices.slice(0, maxToShow);
    const remaining = defaultServices.length - list.length;
    const tooltipContent = defaultServices.map((service) => service.name).join(", ");

    return (
      <div className="mt-3 text-xs text-muted-foreground">
        <span className="font-medium text-slate-900">
          {t("steps.packages.defaultServices", { count: defaultServices.length })}
        </span>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-slate-600" title={tooltipContent}>
          {list.map((service) => (
            <Badge key={service.id} variant="outline" className="text-[10px] font-medium">
              {service.name}
            </Badge>
          ))}
          {remaining > 0 ? <span className="text-xs text-slate-500">+{remaining}</span> : null}
        </div>
      </div>
    );
  };

  const handleSelectPackage = (pkg: PackageRecord) => {
    const defaultServiceIds = pkg.default_add_ons ?? [];
    const defaultServices = services.filter((service) => defaultServiceIds.includes(service.id));

    updateServices({
      packageId: pkg.id,
      packageLabel: pkg.name,
      selectedServiceIds: defaultServiceIds,
      selectedServices: defaultServices,
      showCustomSetup: true,
    });

    const updates: Partial<ProjectCreationDetails> = {};
    if (pkg.price != null) {
      updates.basePrice = pkg.price.toString();
    }
    if (Object.keys(updates).length > 0) {
      updateDetails(updates);
    }
  };

  const handleClearPackage = () => {
    updateServices({
      packageId: undefined,
      packageLabel:
        state.services.selectedServiceIds.length > 0
          ? t("summary.values.customServices")
          : undefined,
      showCustomSetup: state.services.selectedServiceIds.length > 0,
    });
  };

  const handleEnableCustom = () => {
    updateServices({
      showCustomSetup: true,
    });
  };

  const handleResetCustom = () => {
    updateServices({
      showCustomSetup: false,
      packageId: undefined,
      packageLabel: undefined,
      selectedServiceIds: [],
      selectedServices: [],
    });
    updateDetails({
      basePrice: "",
    });
  };

  const handleServicesChange = (serviceIds: string[]) => {
    const selected = services.filter((service) => serviceIds.includes(service.id));
    const payload: Partial<ProjectCreationServices> = {
      selectedServiceIds: serviceIds,
      selectedServices: selected,
      showCustomSetup: true,
    };
    if (!state.services.packageId) {
      payload.packageLabel = serviceIds.length > 0 ? t("summary.values.customServices") : undefined;
    }
    updateServices(payload);
  };

  const packagesLoading = packagesQuery.isLoading;
  const servicesLoading = servicesQuery.isLoading;
  const packagesError = packagesQuery.error as Error | null;
  const servicesError = servicesQuery.error as Error | null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {t("steps.packages.heading")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("steps.packages.description")}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{t("steps.packages.packageLabel")}</Label>
        </div>

        {packagesLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("steps.packages.loadingPackages")}
          </div>
        ) : packagesError ? (
          <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <p>{t("steps.packages.packagesError")}</p>
            <Button variant="outline" size="sm" onClick={() => packagesQuery.refetch()}>
              {t("steps.packages.retry")}
            </Button>
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            {t("steps.packages.noPackages")}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredPackages.map((pkg) => {
              const isSelected = state.services.packageId === pkg.id;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => handleSelectPackage(pkg)}
                  className={cn(
                    "flex h-full flex-col rounded-xl border px-4 py-3 text-left transition-all duration-300 ease-out hover:border-emerald-400/60 hover:shadow-md",
                    isSelected
                      ? "border-emerald-500 bg-emerald-50/60 shadow-sm shadow-emerald-200"
                      : "border-border bg-white"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{pkg.name}</p>
                        {pkg.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pkg.price != null && (
                        <span className="text-sm font-medium text-emerald-600">
                          ₺{Math.round(pkg.price).toLocaleString()}
                        </span>
                      )}
                      {isSelected ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                          {t("steps.packages.selectedIndicator")}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  {renderServicePreview(pkg)}
                </button>
              );
            })}
          </div>
        )}

        {!state.services.packageId && !showCustomSetup && filteredPackages.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <span>{t("steps.packages.customSetupPrompt")}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleEnableCustom}>
              {t("steps.packages.enableCustom")}
            </Button>
          </div>
        )}

        {(state.services.packageId || showCustomSetup) && (
          <div
            ref={actionsRef}
            className="flex items-center justify-end gap-2 rounded-full bg-slate-100/80 px-3 py-1.5 transition-opacity duration-200"
          >
            {state.services.packageLabel ? (
              <Badge
                variant="secondary"
                className="mr-auto h-7 rounded-full bg-emerald-100 px-3 text-xs font-medium text-emerald-700"
              >
                {t("steps.packages.selectedSummary", { name: state.services.packageLabel })}
              </Badge>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearPackage}
              disabled={!state.services.packageId}
              className="h-8 rounded-full px-3 text-xs text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            >
              {t("steps.packages.clearPackage")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetCustom}
              disabled={!showCustomSetup}
              className="h-8 rounded-full px-3 text-xs text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            >
              {t("steps.packages.resetCustom")}
            </Button>
          </div>
        )}
      </div>

      {showCustomSetup && (
        <div
          key={`custom-${state.services.packageId}-${state.services.selectedServiceIds.join(",")}`}
          className="animate-in fade-in slide-in-from-top-2 space-y-6 rounded-2xl border border-border/80 bg-white/80 p-6 shadow-sm transition-all duration-300 ease-out"
        >
          <div className="space-y-2">
            <Label htmlFor="project-base-price">{t("steps.packages.basePriceLabel")}</Label>
            <Input
              id="project-base-price"
              type="number"
              min="0"
              step="1"
              value={state.details.basePrice ?? ""}
              onChange={(event) => updateDetails({ basePrice: event.target.value })}
              placeholder={t("steps.packages.basePricePlaceholder")}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("steps.packages.servicesLabel")}</Label>
              {state.services.selectedServiceIds.length > 0 && (
                <Badge variant="secondary">
                  {t("steps.packages.servicesBadge", {
                    count: state.services.selectedServiceIds.length,
                  })}
                </Badge>
              )}
            </div>
            <ServicePicker
              services={servicePickerServices}
              value={state.services.selectedServiceIds}
              onChange={handleServicesChange}
              disabled={servicesLoading || servicesError != null}
              isLoading={servicesLoading}
              error={servicesError ? t("steps.packages.servicesError") : null}
              onRetry={servicesError ? () => servicesQuery.refetch() : undefined}
            />
            {state.services.selectedServiceIds.length > 0 && (
              <div className="flex flex-wrap gap-2 rounded-lg border border-border/60 bg-muted/40 p-3">
                {state.services.selectedServices.map((service) => (
                  <Badge key={service.id} variant="outline" className="text-xs">
                    {service.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
