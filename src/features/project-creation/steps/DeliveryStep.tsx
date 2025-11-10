import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ToggleSection } from "@/components/ui/toggle-section";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectablePill } from "@/components/ui/selectable-pill";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useProjectCreationContext } from "../hooks/useProjectCreationContext";
import { useProjectCreationActions } from "../hooks/useProjectCreationActions";
import { usePackageDeliveryMethods } from "@/hooks/useOrganizationData";
import { createDefaultProjectDeliveryState } from "../state/projectDeliveryState";
import { useToast } from "@/components/ui/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";

interface DeliveryMethodRecord {
  id: string;
  name: string;
  description?: string | null;
  is_active?: boolean | null;
}

const DEFAULT_METHOD_NAMES = ["Çevrim içi galeri", "USB Bellek", "Baskılı albüm"];

const parsePositiveInt = (value: string, options: { allowZero?: boolean } = {}) => {
  const numeric = value.replace(/[^0-9]/g, "");
  if (!numeric) return null;
  const parsed = Number.parseInt(numeric, 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed === 0 && !options.allowZero) return null;
  return parsed;
};

export const DeliveryStep = () => {
  const { t } = useTranslation("projectCreation");
  const { state } = useProjectCreationContext();
  const { updateDelivery } = useProjectCreationActions();
  const methodsQuery = usePackageDeliveryMethods();
  const { toast } = useToast();
  const { activeOrganizationId } = useOrganization();
  const [newMethodName, setNewMethodName] = useState("");
  const [methodError, setMethodError] = useState<string | null>(null);
  const [isSavingMethod, setIsSavingMethod] = useState(false);

  const catalogMethods = useMemo<DeliveryMethodRecord[]>(() => {
    const records = (methodsQuery.data as DeliveryMethodRecord[] | undefined) ?? [];
    return records.filter((method) => method.is_active !== false);
  }, [methodsQuery.data]);

  const deliveryState = state.delivery ?? createDefaultProjectDeliveryState();
  const deliveryEnabled = deliveryState.enabled !== false;
  const leadTimeUnit = deliveryState.leadTimeUnit === "weeks" ? "weeks" : "days";
  const estimateType = deliveryState.estimateType === "range" ? "range" : "single";
  const photoEnabled = deliveryEnabled && deliveryState.enablePhotoEstimate !== false;
  const leadTimeEnabled = deliveryEnabled && deliveryState.enableLeadTime !== false;
  const methodsEnabled = deliveryEnabled && deliveryState.enableMethods !== false;
  const selectedMethodIds = deliveryState.methods.map((method) => method.methodId);

  const handleToggleDelivery = (enabled: boolean) => {
    updateDelivery({ enabled });
  };

  const handleEstimateChange = (value: "single" | "range") => {
    updateDelivery({
      estimateType: value,
      countMax: value === "range" ? deliveryState.countMax ?? null : null,
    });
  };

  const updateSingleCount = (value: string) => {
    const parsed = parsePositiveInt(value);
    updateDelivery({ countMin: parsed, countMax: null });
  };

  const updateRangeCount = (key: "countMin" | "countMax", value: string) => {
    const parsed = parsePositiveInt(value);
    updateDelivery({ [key]: parsed });
  };

  const updateLeadTimeValue = (value: string) => {
    const parsed = parsePositiveInt(value, { allowZero: true });
    updateDelivery({ leadTimeValue: parsed });
  };

  const updateLeadTimeUnit = (value: "days" | "weeks") => {
    updateDelivery({ leadTimeUnit: value });
  };

  const toggleMethod = (method: DeliveryMethodRecord) => {
    if (!methodsEnabled) return;
    const exists = deliveryState.methods.some((entry) => entry.methodId === method.id);
    if (exists) {
      updateDelivery({
        methods: deliveryState.methods.filter((entry) => entry.methodId !== method.id),
      });
      return;
    }
    updateDelivery({
      methods: [
        ...deliveryState.methods,
        { methodId: method.id, name: method.name ?? method.id },
      ],
    });
  };

  const handlePhotoToggle = (enabled: boolean) => {
    updateDelivery({
      enablePhotoEstimate: enabled,
      countMin: enabled ? deliveryState.countMin ?? null : null,
      countMax: enabled ? deliveryState.countMax ?? null : null,
    });
  };

  const handleLeadTimeToggle = (enabled: boolean) => {
    updateDelivery({
      enableLeadTime: enabled,
      leadTimeValue: enabled ? deliveryState.leadTimeValue ?? null : null,
    });
  };

  const handleMethodsToggle = (enabled: boolean) => {
    updateDelivery({
      enableMethods: enabled,
      methods: enabled ? deliveryState.methods : [],
    });
  };

  const handleAddMethod = async () => {
    const trimmed = newMethodName.trim();
    setMethodError(null);

    if (!methodsEnabled) {
      return;
    }

    if (!trimmed) {
      setMethodError(t("steps.delivery.methods.errors.required"));
      return;
    }

    if (!activeOrganizationId) {
      setMethodError(t("steps.delivery.methods.errors.organization"));
      return;
    }

    const catalogRecords = (methodsQuery.data as DeliveryMethodRecord[] | undefined) ?? [];
    const normalizedInput = trimmed.toLocaleLowerCase("tr-TR");
    const existingRecord = catalogRecords.find(
      (record) => record.name?.trim().toLocaleLowerCase("tr-TR") === normalizedInput
    );

    if (existingRecord && existingRecord.is_active !== false) {
      setMethodError(t("steps.delivery.methods.errors.duplicate"));
      return;
    }

    setIsSavingMethod(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("Auth required");

      let methodId: string | null = null;
      let methodName = trimmed;
      let reactivated = false;

      if (existingRecord && existingRecord.is_active === false) {
        const { error } = await supabase
          .from("package_delivery_methods")
          .update({ is_active: true })
          .eq("id", existingRecord.id);
        if (error) throw error;
        methodId = existingRecord.id;
        methodName = existingRecord.name ?? trimmed;
        reactivated = true;
      } else {
        const { data, error } = await supabase
          .from("package_delivery_methods")
          .insert([
            {
              organization_id: activeOrganizationId,
              user_id: user.id,
              name: trimmed,
              sort_order: DEFAULT_METHOD_NAMES.includes(trimmed) ? 0 : 100,
            },
          ])
          .select()
          .single();
        if (error) throw error;
        methodId = data?.id ?? null;
        methodName = data?.name ?? trimmed;
      }

      await methodsQuery.refetch();
      if (methodId) {
        const alreadySelected = deliveryState.methods.some(
          (entry) => entry.methodId === methodId
        );
        const nextMethods = alreadySelected
          ? deliveryState.methods
          : [...deliveryState.methods, { methodId, name: methodName }];
        updateDelivery({ methods: nextMethods });
      }
      setNewMethodName("");
      toast({
        title: reactivated
          ? t("steps.delivery.methods.reactivateSuccess")
          : t("steps.delivery.methods.success"),
      });
    } catch (error) {
      console.error("Failed to add delivery method", error);
      setMethodError(t("steps.delivery.methods.errors.generic"));
    } finally {
      setIsSavingMethod(false);
    }
  };

  const photoSummary = photoEnabled
    ? (() => {
        if (estimateType === "range") {
          if (deliveryState.countMin && deliveryState.countMax) {
            return t("steps.delivery.sections.photo.range", {
              min: deliveryState.countMin,
              max: deliveryState.countMax,
            });
          }
          return t("steps.delivery.sections.photo.notSet");
        }
        return deliveryState.countMin
          ? t("steps.delivery.sections.photo.single", {
              count: deliveryState.countMin,
            })
          : t("steps.delivery.sections.photo.notSet");
      })()
    : t("steps.delivery.sections.disabled");

  const leadTimeSummary = leadTimeEnabled
    ? deliveryState.leadTimeValue
      ? t("steps.delivery.sections.leadTime.value", {
          value: deliveryState.leadTimeValue,
          unit: t(`steps.delivery.leadTime.${leadTimeUnit}`),
        })
      : t("steps.delivery.sections.leadTime.notSet")
    : t("steps.delivery.sections.disabled");

  const methodsSummary = methodsEnabled
    ? selectedMethodIds.length
      ? t("steps.delivery.sections.methods.count", { count: selectedMethodIds.length })
      : t("steps.delivery.sections.methods.notSet")
    : t("steps.delivery.sections.disabled");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            {t("steps.delivery.heading")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("steps.delivery.description")}</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 px-4 py-2 text-sm shadow-sm">
          <span className="text-muted-foreground">{t("steps.delivery.masterToggleLabel")}</span>
          <Switch checked={deliveryEnabled} onCheckedChange={handleToggleDelivery} />
        </div>
      </div>

      {!deliveryEnabled ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          {t("steps.delivery.disabledHelper")}
        </div>
      ) : (
        <div className="space-y-4">
          <ToggleSection
            title={t("steps.delivery.sections.photo.title")}
            description={t("steps.delivery.sections.photo.description")}
            enabled={photoEnabled}
            onToggle={handlePhotoToggle}
            summary={<span>{photoSummary}</span>}
          >
            <div className="space-y-3">
              <SegmentedControl
                value={estimateType}
                onValueChange={handleEstimateChange}
                options={[
                  { label: t("steps.delivery.photoCount.single.label"), value: "single" },
                  { label: t("steps.delivery.photoCount.range.label"), value: "range" },
                ]}
              />

              {estimateType === "single" ? (
                <div className="space-y-2">
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={deliveryState.countMin ? String(deliveryState.countMin) : ""}
                    onChange={(event) => updateSingleCount(event.target.value)}
                    placeholder={t("steps.delivery.photoCount.single.placeholder")}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("steps.delivery.photoCount.single.helper")}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={deliveryState.countMin ? String(deliveryState.countMin) : ""}
                      onChange={(event) => updateRangeCount("countMin", event.target.value)}
                      placeholder={t("steps.delivery.photoCount.range.minPlaceholder")}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("steps.delivery.photoCount.range.minHelper")}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={deliveryState.countMax ? String(deliveryState.countMax) : ""}
                      onChange={(event) => updateRangeCount("countMax", event.target.value)}
                      placeholder={t("steps.delivery.photoCount.range.maxPlaceholder")}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("steps.delivery.photoCount.range.maxHelper")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ToggleSection>

          <ToggleSection
            title={t("steps.delivery.sections.leadTime.title")}
            description={t("steps.delivery.sections.leadTime.description")}
            enabled={leadTimeEnabled}
            onToggle={handleLeadTimeToggle}
            summary={<span>{leadTimeSummary}</span>}
          >
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Input
                  className="sm:w-32"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={deliveryState.leadTimeValue ? String(deliveryState.leadTimeValue) : ""}
                  onChange={(event) => updateLeadTimeValue(event.target.value)}
                  placeholder={t("steps.delivery.leadTime.placeholder")}
                />
                <Select value={leadTimeUnit} onValueChange={updateLeadTimeUnit}>
                  <SelectTrigger className="sm:w-40">
                    <SelectValue placeholder={t("steps.delivery.leadTime.unitPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">{t("steps.delivery.leadTime.days")}</SelectItem>
                    <SelectItem value="weeks">{t("steps.delivery.leadTime.weeks")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("steps.delivery.leadTime.helper")}
              </p>
            </div>
          </ToggleSection>

          <ToggleSection
            title={t("steps.delivery.sections.methods.title")}
            description={t("steps.delivery.sections.methods.description")}
            enabled={methodsEnabled}
            onToggle={handleMethodsToggle}
            summary={<span>{methodsSummary}</span>}
          >
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {t("steps.delivery.methods.helper")}
              </p>
              {methodsQuery.isLoading ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-6 w-24 rounded-full" />
                  ))}
                </div>
              ) : catalogMethods.length === 0 ? (
                <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  {t("steps.delivery.methods.empty")}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                {catalogMethods.map((method) => {
                  const isSelected = selectedMethodIds.includes(method.id);
                  return (
                    <SelectablePill
                      key={method.id}
                        selected={isSelected}
                        onClick={() => toggleMethod(method)}
                        className="text-xs"
                      >
                      {method.name}
                    </SelectablePill>
                  );
                })}
              </div>
            )}
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Input
                  value={newMethodName}
                  onChange={(event) => setNewMethodName(event.target.value)}
                  placeholder={t("steps.delivery.methods.placeholder")}
                  className="sm:w-64"
                  disabled={isSavingMethod}
                />
                <Button
                  onClick={handleAddMethod}
                  disabled={isSavingMethod || !newMethodName.trim()}
                >
                  {isSavingMethod
                    ? t("steps.delivery.methods.saving")
                    : t("steps.delivery.methods.add")}
                </Button>
              </div>
              {methodError ? (
                <p className="text-xs text-destructive">{methodError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("steps.delivery.methods.addHelper")}
                </p>
              )}
            </div>
          </div>
        </ToggleSection>
        </div>
      )}
    </div>
  );
};
