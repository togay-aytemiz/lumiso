import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useTranslation } from "react-i18next";

export const LocationStep = () => {
  const { state } = useSessionPlanningContext();
  const { updateSessionFields } = useSessionPlanningActions();
  const { t } = useTranslation("sessionPlanning");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{t("steps.location.navigationLabel")}</h2>
        <p className="text-sm text-muted-foreground">{t("steps.location.description")}</p>
      </div>

      <div className="grid gap-4">
        <div className="rounded-lg border border-border/70 bg-muted/40 p-4 shadow-sm">
          <Label htmlFor="location-address" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("steps.location.addressLabel")}
          </Label>
          <Textarea
            id="location-address"
            rows={4}
            placeholder={t("steps.location.addressPlaceholder")}
            className="mt-2 resize-none"
            value={state.location ?? ""}
            onChange={(event) =>
              updateSessionFields({
                location: event.target.value
              })
            }
          />
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/40 p-4 shadow-sm">
          <Label htmlFor="location-url" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("steps.location.meetingUrlLabel")}
          </Label>
          <Input
            id="location-url"
            placeholder={t("steps.location.meetingUrlPlaceholder")}
            className="mt-2"
            value={state.meetingUrl ?? ""}
            onChange={(event) =>
              updateSessionFields({
                meetingUrl: event.target.value
              })
            }
          />
        </div>
      </div>
    </div>
  );
};
