import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePackageCreationContext } from "../hooks/usePackageCreationContext";
import { usePackageCreationActions } from "../hooks/usePackageCreationActions";
import { useProjectTypes } from "@/hooks/useOrganizationData";
import { X } from "lucide-react";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { Link } from "react-router-dom";

interface ProjectTypeRecord {
  id: string;
  name: string;
}

export const BasicsStep = () => {
  const { t } = useTranslation("packageCreation");
  const { state } = usePackageCreationContext();
  const { updateBasics } = usePackageCreationActions();

  const { data: projectTypes = [], isLoading, error, refetch } = useProjectTypes();
  const { settings, loading: settingsLoading } = useOrganizationSettings();
  const taxProfile = settings?.taxProfile ?? null;

  const projectTypeMap = useMemo(
    () =>
      new Map(
        (projectTypes as ProjectTypeRecord[]).map((type) => [type.id, type.name ?? type.id])
      ),
    [projectTypes]
  );

  const handleBasicsChange = (field: "name" | "description") => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    updateBasics({ [field]: event.target.value });
  };

  const toggleType = (typeId: string) => {
    updateBasics({
      applicableTypeIds: state.basics.applicableTypeIds.includes(typeId)
        ? state.basics.applicableTypeIds.filter((id) => id !== typeId)
        : [...state.basics.applicableTypeIds, typeId],
    });
  };

  const handleVisibilityToggle = (checked: boolean) => {
    updateBasics({ isActive: checked });
  };

  const selectedTypeNames = useMemo(() => {
    if (state.basics.applicableTypeIds.length === 0) return [];
    return state.basics.applicableTypeIds
      .map((id) => projectTypeMap.get(id))
      .filter(Boolean) as string[];
  }, [projectTypeMap, state.basics.applicableTypeIds]);

  const billingBadges = useMemo(() => {
    const chips: Array<{ id: string; label: string; value: string }> = [];
    const companyName = taxProfile?.companyName ?? settings?.photography_business_name ?? "";
    if (companyName) {
      chips.push({
        id: "company",
        label: t("steps.basics.billing.companyLabel"),
        value: companyName,
      });
    }

    if (taxProfile?.taxOffice) {
      chips.push({
        id: "taxOffice",
        label: t("steps.basics.billing.taxOfficeLabel"),
        value: taxProfile.taxOffice,
      });
    }

    if (taxProfile?.taxNumber) {
      chips.push({
        id: "taxNumber",
        label: t("steps.basics.billing.taxNumberLabel"),
        value: taxProfile.taxNumber,
      });
    }

    if (typeof taxProfile?.defaultVatRate === "number") {
      const vatRate = new Intl.NumberFormat("tr-TR", {
        maximumFractionDigits: Number.isInteger(taxProfile.defaultVatRate) ? 0 : 2,
      }).format(taxProfile.defaultVatRate);
      const vatModeKey = taxProfile.defaultVatMode === "inclusive" ? "inclusive" : "exclusive";
      chips.push({
        id: "vat",
        label: t("steps.basics.billing.vatLabel"),
        value: t("steps.basics.billing.vatValue", {
          rate: vatRate,
          mode: t(`steps.basics.billing.vatMode.${vatModeKey}`),
        }),
      });
    }

    if (taxProfile?.pricesIncludeVat !== undefined) {
      chips.push({
        id: "pricing",
        label: t("steps.basics.billing.pricingLabel"),
        value: taxProfile.pricesIncludeVat
          ? t("steps.basics.billing.pricingIncluded")
          : t("steps.basics.billing.pricingExcluded"),
      });
    }

    return chips;
  }, [settings?.photography_business_name, t, taxProfile]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {t("steps.basics.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("steps.basics.description")}</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="package-name">{t("steps.basics.fields.name.label")}</Label>
          <Input
            id="package-name"
            value={state.basics.name}
            onChange={handleBasicsChange("name")}
            placeholder={t("steps.basics.fields.name.placeholder")}
            maxLength={120}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="package-description">
            {t("steps.basics.fields.description.label")}
            <span className="ml-1 text-xs text-muted-foreground">
              {t("common:labels.optional", { defaultValue: "Optional" })}
            </span>
          </Label>
          <Textarea
            id="package-description"
            value={state.basics.description}
            onChange={handleBasicsChange("description")}
            placeholder={t("steps.basics.fields.description.placeholder")}
            rows={4}
          />
        </div>

        <div className="space-y-3">
          <div>
            <Label>{t("steps.basics.fields.types.label")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("steps.basics.fields.types.helper")}
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-8 rounded-full" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <div className="flex items-center justify-between">
                <span>{t("steps.basics.fields.types.empty")}</span>
                <button
                  type="button"
                  className="text-xs font-medium underline hover:opacity-80"
                  onClick={() => refetch()}
                >
                  {t("common:actions.retry", { defaultValue: "Retry" })}
                </button>
              </div>
            </div>
          ) : (projectTypes as ProjectTypeRecord[]).length === 0 ? (
            <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
              {t("steps.basics.fields.types.empty")}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(projectTypes as ProjectTypeRecord[]).map((type) => {
                const isSelected = state.basics.applicableTypeIds.includes(type.id);
                return (
                  <Badge
                    key={type.id}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer rounded-full px-3 py-1 text-xs transition-colors"
                    onClick={() => toggleType(type.id)}
                  >
                    <span className="flex items-center gap-2">
                      <span>{type.name}</span>
                      {isSelected ? <X className="h-3 w-3 opacity-80" aria-hidden /> : null}
                    </span>
                  </Badge>
                );
              })}
            </div>
          )}

          {selectedTypeNames.length === 0 && (projectTypes as ProjectTypeRecord[]).length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("steps.basics.fields.types.all")}
            </p>
          ) : null}
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/10 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-900">
              {t("steps.basics.fields.visibility.label")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("steps.basics.fields.visibility.helper")}
            </p>
          </div>
          <Switch
            id="package-visibility"
            checked={state.basics.isActive}
            onCheckedChange={handleVisibilityToggle}
            aria-label={t("steps.basics.fields.visibility.label")}
          />
        </div>
      </div>
    </div>
  );
};
