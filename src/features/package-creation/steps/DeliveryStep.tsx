import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePackageCreationContext } from "../hooks/usePackageCreationContext";
import { usePackageCreationActions } from "../hooks/usePackageCreationActions";
import { usePackageDeliveryMethods } from "@/hooks/useOrganizationData";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { ToggleSection } from "@/components/ui/toggle-section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

interface DeliveryMethodRecord {
  id: string;
  name: string;
  description?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
}

const DEFAULT_METHOD_NAMES = [
  "Çevrim içi galeri",
  "USB Bellek",
  "Baskılı albüm",
];

export const DeliveryStep = () => {
  const { t } = useTranslation("packageCreation");
  const { state } = usePackageCreationContext();
  const { updateDelivery } = usePackageCreationActions();
  const { activeOrganizationId } = useOrganization();
  const { toast } = useToast();

  const methodsQuery = usePackageDeliveryMethods();
  const methods = useMemo<DeliveryMethodRecord[]>(
    () =>
      ((methodsQuery.data as DeliveryMethodRecord[] | undefined) ?? []).filter(
        (method) => method.is_active !== false
      ),
    [methodsQuery.data]
  );

  const [newMethodName, setNewMethodName] = useState("");
  const [isSavingMethod, setIsSavingMethod] = useState(false);
  const [methodError, setMethodError] = useState<string | null>(null);
  const [methodToDelete, setMethodToDelete] = useState<DeliveryMethodRecord | null>(null);
  const [isDeletingMethod, setIsDeletingMethod] = useState(false);

  const leadTimeUnit = state.delivery.leadTimeUnit ?? "days";
  const photoEnabled = state.delivery.enablePhotoEstimate !== false;
  const leadTimeEnabled = state.delivery.enableLeadTime !== false;
  const methodsEnabled = state.delivery.enableMethods !== false;
  const selectedMethodIds = Array.isArray(state.delivery.methods) ? state.delivery.methods : [];

  const handleEstimateChange = (value: string) => {
    if (value !== "single" && value !== "range") return;
    updateDelivery({ estimateType: value });
    if (value === "single") {
      const singleValue = state.delivery.countMin ?? state.delivery.countMax ?? null;
      updateDelivery({ countMin: singleValue, countMax: null });
    }
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

  const toggleMethod = (methodId: string) => {
    if (!methodsEnabled) return;
    if (selectedMethodIds.includes(methodId)) {
      updateDelivery({ methods: selectedMethodIds.filter((id) => id !== methodId) });
    } else {
      updateDelivery({ methods: [...selectedMethodIds, methodId] });
    }
  };

  const handlePhotoToggle = (enabled: boolean) => {
    if (enabled) {
      updateDelivery({ enablePhotoEstimate: true });
      return;
    }
    updateDelivery({ enablePhotoEstimate: false, countMin: null, countMax: null });
  };

  const handleLeadTimeToggle = (enabled: boolean) => {
    if (enabled) {
      updateDelivery({ enableLeadTime: true });
      return;
    }
    updateDelivery({ enableLeadTime: false, leadTimeValue: null });
  };

  const handleMethodsToggle = (enabled: boolean) => {
    if (enabled) {
      updateDelivery({ enableMethods: true });
      return;
    }
    setMethodError(null);
    setNewMethodName("");
    updateDelivery({ enableMethods: false, methods: [] });
  };

  const photoSummary = photoEnabled
    ? (() => {
        if (state.delivery.estimateType === "range") {
          return state.delivery.countMin && state.delivery.countMax
            ? t("steps.delivery.sections.photo.range", {
                min: state.delivery.countMin,
                max: state.delivery.countMax,
              })
            : t("steps.delivery.sections.photo.notSet");
        }
        return state.delivery.countMin
          ? t("steps.delivery.sections.photo.single", { count: state.delivery.countMin })
          : t("steps.delivery.sections.photo.notSet");
      })()
    : t("steps.delivery.sections.disabled");

  const leadTimeSummary = leadTimeEnabled
    ? state.delivery.leadTimeValue
      ? t("steps.delivery.sections.leadTime.value", {
          value: state.delivery.leadTimeValue,
          unit: t(`steps.delivery.leadTime.${state.delivery.leadTimeUnit ?? "days"}`),
        })
      : t("steps.delivery.sections.leadTime.notSet")
    : t("steps.delivery.sections.disabled");

  const methodsSummary = methodsEnabled
    ? selectedMethodIds.length
      ? t("steps.delivery.sections.methods.count", { count: selectedMethodIds.length })
      : t("steps.delivery.sections.methods.notSet")
    : t("steps.delivery.sections.disabled");

  const handleAddMethod = async () => {
    const trimmed = newMethodName.trim();
    setMethodError(null);

    if (!methodsEnabled) {
      return;
    }

    if (!trimmed) {
      setMethodError(t("steps.delivery.methods.errors.required", { defaultValue: "Enter a method name." }));
      return;
    }

    if (!activeOrganizationId) {
      setMethodError(t("steps.delivery.methods.errors.organization", { defaultValue: "Select an organization before adding methods." }));
      return;
    }

    const catalogRecords = (methodsQuery.data as DeliveryMethodRecord[] | undefined) ?? [];
    const normalizedInput = trimmed.toLocaleLowerCase("tr-TR");
    const existingRecord = catalogRecords.find(
      (record) => record.name?.trim().toLocaleLowerCase("tr-TR") === normalizedInput
    );

    if (existingRecord && existingRecord.is_active !== false) {
      setMethodError(t("steps.delivery.methods.errors.duplicate", { defaultValue: "This method already exists." }));
      return;
    }

    setIsSavingMethod(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("Auth required");

      let methodId: string | null = null;
      let reactivated = false;

      if (existingRecord && existingRecord.is_active === false) {
        const { error } = await supabase
          .from("package_delivery_methods")
          .update({ is_active: true })
          .eq("id", existingRecord.id);
        if (error) throw error;
        methodId = existingRecord.id;
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
      }

      await methodsQuery.refetch();
      if (methodId) {
        updateDelivery({
          methods: Array.from(new Set([...selectedMethodIds.filter(Boolean), methodId])),
        });
      }
      setNewMethodName("");
      toast({
        title: t("common:toast.success"),
        description: reactivated
          ? t("steps.delivery.methods.reactivateSuccess", {
              name: existingRecord?.name ?? trimmed,
              defaultValue: "Delivery method restored.",
            })
          : t("steps.delivery.methods.success", { defaultValue: "Delivery method added." }),
      });
    } catch (error: any) {
      console.error("Failed to add delivery method", error);
      setMethodError(error.message ?? "Unable to add delivery method");
    } finally {
      setIsSavingMethod(false);
    }
  };

  const handleRequestDeleteMethod = (method: DeliveryMethodRecord) => {
    setMethodToDelete(method);
  };

  const handleConfirmDeleteMethod = async () => {
    if (!methodToDelete) return;
    setIsDeletingMethod(true);
    try {
      const { error } = await supabase
        .from("package_delivery_methods")
        .update({ is_active: false })
        .eq("id", methodToDelete.id);

      if (error) throw error;

      updateDelivery({
        methods: selectedMethodIds.filter((id) => id !== methodToDelete.id),
      });

      await methodsQuery.refetch();
      toast({
        title: t("common:toast.success", { defaultValue: "Success" }),
        description: t("steps.delivery.methods.removeSuccess", {
          name: methodToDelete.name,
          defaultValue: "Delivery method removed.",
        }),
      });
      setMethodToDelete(null);
    } catch (error: any) {
      console.error("Failed to remove delivery method", error);
      toast({
        variant: "destructive",
        title: t("common:toast.error", { defaultValue: "Something went wrong" }),
        description: t("steps.delivery.methods.removeError", {
          defaultValue: "We couldn't remove this delivery method.",
        }),
      });
    } finally {
      setIsDeletingMethod(false);
    }
  };

  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open && !isDeletingMethod) {
      setMethodToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {t("steps.delivery.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("steps.delivery.description")}
        </p>
      </div>

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
              value={state.delivery.estimateType}
              onValueChange={handleEstimateChange}
              options={[
                { value: "single", label: t("steps.delivery.photoCount.single.label") },
                { value: "range", label: t("steps.delivery.photoCount.range.label") },
              ]}
            />

            {state.delivery.estimateType === "single" ? (
              <div className="grid max-w-xs gap-2">
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={state.delivery.countMin ? String(state.delivery.countMin) : ""}
                  onChange={(event) => updateSingleCount(event.target.value)}
                  placeholder={t("steps.delivery.photoCount.single.placeholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("steps.delivery.photoCount.single.helper")}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 sm:max-w-md">
                <div className="space-y-2">
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={state.delivery.countMin ? String(state.delivery.countMin) : ""}
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
                    value={state.delivery.countMax ? String(state.delivery.countMax) : ""}
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
                value={state.delivery.leadTimeValue ? String(state.delivery.leadTimeValue) : ""}
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
            ) : methods.length === 0 ? (
              <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                {t("steps.delivery.methods.empty")}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {methods.map((method) => {
                  const isSelected = state.delivery.methods.includes(method.id);
                  return (
                    <Badge
                      key={method.id}
                      variant={isSelected ? "default" : "outline"}
                      className="group flex cursor-pointer items-center gap-2 rounded-full px-3 py-1 text-xs transition-colors"
                      onClick={() => toggleMethod(method.id)}
                      role="button"
                      aria-pressed={isSelected}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleMethod(method.id);
                        }
                      }}
                    >
                      <span>{method.name}</span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRequestDeleteMethod(method);
                        }}
                        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-slate-900/10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        aria-label={t("steps.delivery.methods.removeLabel", {
                          name: method.name,
                          defaultValue: "Remove method",
                        })}
                      >
                        <Trash2 className="h-3.5 w-3.5 opacity-70" aria-hidden />
                      </button>
                    </Badge>
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
                />
                <Button onClick={handleAddMethod} disabled={isSavingMethod || !newMethodName.trim()}>
                  {isSavingMethod
                    ? t("steps.delivery.methods.saving", { defaultValue: "Saving…" })
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

      <AlertDialog open={!!methodToDelete} onOpenChange={handleDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("steps.delivery.methods.removeConfirmTitle", {
                name: methodToDelete?.name ?? "",
                defaultValue: "Remove this delivery method?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("steps.delivery.methods.removeConfirmDescription", {
                defaultValue:
                  "This method will disappear from your catalog. Any packages using it will stop showing this method.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingMethod}>
              {t("steps.delivery.methods.removeCancel", { defaultValue: "Keep" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteMethod}
              disabled={isDeletingMethod}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingMethod
                ? t("steps.delivery.methods.removeInProgress", { defaultValue: "Removing…" })
                : t("steps.delivery.methods.removeConfirm", { defaultValue: "Remove" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function parsePositiveInt(value: string, options: { allowZero?: boolean } = {}) {
  const numeric = value.replace(/[^0-9]/g, "");
  if (!numeric) return null;
  const parsed = parseInt(numeric, 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed === 0 && !options.allowZero) return null;
  return parsed;
}
