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
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("steps.location.description")}</p>

      <div className="space-y-2">
        <Label htmlFor="location-address">{t("steps.location.addressLabel")}</Label>
        <Textarea
          id="location-address"
          rows={3}
          placeholder={t("steps.location.addressPlaceholder")}
          value={state.location ?? ""}
          onChange={(event) =>
            updateSessionFields({
              location: event.target.value
            })
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location-url">{t("steps.location.meetingUrlLabel")}</Label>
        <Input
          id="location-url"
          placeholder={t("steps.location.meetingUrlPlaceholder")}
          value={state.meetingUrl ?? ""}
          onChange={(event) =>
            updateSessionFields({
              meetingUrl: event.target.value
            })
          }
        />
      </div>
    </div>
  );
};
