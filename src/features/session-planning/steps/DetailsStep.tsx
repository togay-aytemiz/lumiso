import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useTranslation } from "react-i18next";

export const DetailsStep = () => {
  const { state } = useSessionPlanningContext();
  const { updateSessionFields } = useSessionPlanningActions();
  const { t } = useTranslation("sessionPlanning");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("steps.details.description")}</p>

      <div className="space-y-2">
        <Label htmlFor="session-name">{t("steps.details.nameLabel")}</Label>
        <Input
          id="session-name"
          value={state.sessionName ?? ""}
          placeholder={t("steps.details.namePlaceholder")}
          onChange={(event) =>
            updateSessionFields({
              sessionName: event.target.value
            })
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="session-notes">{t("steps.details.notesLabel")}</Label>
        <Textarea
          id="session-notes"
          rows={3}
          placeholder={t("steps.details.notesPlaceholder")}
          value={state.notes ?? ""}
          onChange={(event) =>
            updateSessionFields({
              notes: event.target.value
            })
          }
        />
      </div>
    </div>
  );
};
