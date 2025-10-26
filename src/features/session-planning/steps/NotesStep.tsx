import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useTranslation } from "react-i18next";

export const NotesStep = () => {
  const { state } = useSessionPlanningContext();
  const { updateSessionFields } = useSessionPlanningActions();
  const { t } = useTranslation("sessionPlanning");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("steps.notes.description")}</p>

      <div className="space-y-2">
        <Label htmlFor="session-notes">{t("steps.notes.notesLabel")}</Label>
        <Textarea
          id="session-notes"
          rows={5}
          value={state.notes ?? ""}
          placeholder={t("steps.notes.notesPlaceholder")}
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
