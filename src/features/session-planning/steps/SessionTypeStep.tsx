import { useEffect, useId, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Clock, Loader2 } from "lucide-react";
import { useSessionTypes } from "@/hooks/useOrganizationData";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { useOnboarding } from "@/contexts/useOnboarding";

export const SessionTypeStep = () => {
  const { state } = useSessionPlanningContext();
  const { updateSessionType, setDefaultSessionType } = useSessionPlanningActions();
  const { t } = useTranslation("sessionPlanning");
  const { data: sessionTypes = [], isLoading: sessionTypesLoading } = useSessionTypes();
  const { settings, loading: settingsLoading } = useOrganizationSettings();
  const { isInGuidedSetup } = useOnboarding();

  const selectedId = state.sessionTypeId;
  const descriptionBaseId = useId();
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const defaultAppliedRef = useRef(false);
  const previousRecommendedIdRef = useRef<string | undefined>(undefined);
  const userInitiatedFocusRef = useRef(false);

  const defaultSessionTypeId = settings?.default_session_type_id ?? null;

  const options = useMemo(() => {
    const fallbackDescription = t("steps.sessionType.fallbackDescription");
    const normalized = sessionTypes
      .filter((type) => type?.is_active !== false)
      .map((type, index) => ({
        id: type.id,
        label: type.name,
        description: type.description?.trim() || fallbackDescription,
        durationMinutes: typeof type.duration_minutes === "number" ? type.duration_minutes : null,
        isDefault: type.id === defaultSessionTypeId,
        sortOrder:
          typeof type.sort_order === "number"
            ? type.sort_order
            : index
      }));

    return normalized
      .sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return a.sortOrder - b.sortOrder;
      })
      .map(({ sortOrder, ...option }) => option);
  }, [sessionTypes, defaultSessionTypeId, t]);

  const recommendedOption = useMemo(
    () => options.find((option) => option.isDefault) ?? options[0],
    [options]
  );

  useEffect(() => {
    if (
      previousRecommendedIdRef.current &&
      previousRecommendedIdRef.current !== recommendedOption?.id
    ) {
      defaultAppliedRef.current = false;
    }
    previousRecommendedIdRef.current = recommendedOption?.id;
  }, [recommendedOption?.id]);

  useEffect(() => {
    if (!options.length) return;

    if (!defaultAppliedRef.current && !selectedId && recommendedOption) {
      setDefaultSessionType({ id: recommendedOption.id, label: recommendedOption.label });
      defaultAppliedRef.current = true;
    }
  }, [selectedId, options, recommendedOption, setDefaultSessionType]);

  useEffect(() => {
    if (!selectedId || !userInitiatedFocusRef.current) return;
    const index = options.findIndex((option) => option.id === selectedId);
    if (index >= 0) {
      const target = optionRefs.current[index];
      target?.focus();
    }
    userInitiatedFocusRef.current = false;
  }, [selectedId, options]);

  const handleSelect = (option: { id: string; label: string }) => {
    userInitiatedFocusRef.current = true;
    updateSessionType(option);
  };

  const isLoadingData = sessionTypesLoading || settingsLoading;
  const hasOptions = options.length > 0;

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return t("steps.sessionType.duration.notSet");
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    const parts: string[] = [];

    if (hours > 0) {
      parts.push(t("steps.sessionType.duration.hours", { count: hours }));
    }
    if (remainingMinutes > 0 || parts.length === 0) {
      parts.push(t("steps.sessionType.duration.minutes", { count: remainingMinutes }));
    }

    return parts.join(" • ");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{t("steps.sessionType.navigationLabel")}</h2>
        <p className="text-sm text-muted-foreground">{t("steps.sessionType.description")}</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("steps.sessionType.listHeading")}
        </h3>

        {isInGuidedSetup ? (
          <Alert className="border-amber-200/80 bg-amber-50 text-amber-900">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
              <div className="space-y-1">
                <AlertTitle className="text-sm font-semibold text-amber-900">
                  {t("steps.sessionType.guidedNotice.title", {
                    defaultValue: "Sample session types for this tutorial",
                  })}
                </AlertTitle>
                <AlertDescription className="text-sm text-amber-900/90">
                  {t("steps.sessionType.guidedNotice.description", {
                    defaultValue:
                      "During the guided setup please pick one of these pre-seeded session types. You can manage or change them anytime in Settings.",
                  })}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        ) : null}

        {isLoadingData ? (
          <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-slate-200">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : hasOptions ? (
          <div
            className="grid gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-label={t("steps.sessionType.navigationLabel")}
          >
            {options.map((option, index) => {
              const isActive = selectedId === option.id;
              const descriptionId = `${descriptionBaseId}-${option.id}-description`;

              return (
                <button
                  key={option.id}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-describedby={descriptionId}
                  data-state={isActive ? "checked" : "unchecked"}
                  onClick={() => handleSelect({ id: option.id, label: option.label })}
                  className={cn(
                    "flex h-full flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/60 p-4 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                    isActive
                      ? "border-primary bg-primary/10 shadow-md"
                      : "hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{option.label}</span>
                        {option.isDefault ? (
                          <Badge variant="info" className="whitespace-nowrap">
                            {t("steps.sessionType.suggestedBadge")}
                          </Badge>
                        ) : null}
                      </div>
                      <p
                        id={descriptionId}
                        className="text-xs text-muted-foreground leading-relaxed line-clamp-3"
                      >
                        {option.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    <span>{formatDuration(option.durationMinutes)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">{t("steps.sessionType.emptyTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("steps.sessionType.emptyDescription")}</p>
            </div>
            <Button variant="outline" asChild>
              <a href="/settings/services" target="_blank" rel="noopener noreferrer">
                {t("steps.sessionType.manageLink")}
              </a>
            </Button>
          </div>
        )}
      </div>

    </div>
  );
};
