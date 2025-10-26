import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export const SessionTypeStep = () => {
  const { state } = useSessionPlanningContext();
  const { updateSessionType } = useSessionPlanningActions();
  const { t } = useTranslation("sessionPlanning");

  const selectedId = useMemo(() => state.sessionTypeId, [state.sessionTypeId]);
  const options = useMemo(
    () => [
      { id: "consultation", label: t("steps.sessionType.options.consultation") },
      { id: "portrait", label: t("steps.sessionType.options.portrait") },
      { id: "wedding", label: t("steps.sessionType.options.wedding") },
      { id: "other", label: t("steps.sessionType.options.other") }
    ],
    [t]
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("steps.sessionType.description")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => updateSessionType(option)}
            className={cn(
              "rounded-lg border p-4 text-left transition-colors",
              selectedId === option.id ? "border-primary bg-primary/10" : "hover:border-primary/60"
            )}
          >
            <h3 className="font-medium">{option.label}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t("steps.sessionType.optionDescription")}</p>
          </button>
        ))}
      </div>
      <Button variant="outline" onClick={() => updateSessionType({ id: undefined, label: undefined })}>
        {t("steps.sessionType.clear")}
      </Button>
    </div>
  );
};
