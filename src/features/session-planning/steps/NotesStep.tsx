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
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{t("steps.notes.navigationLabel")}</h2>
        <p className="text-sm text-muted-foreground">{t("steps.notes.description")}</p>
      </div>

      <div className="rounded-lg border border-border/70 bg-muted/40 p-4 shadow-sm">
        <Label htmlFor="session-notes" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("steps.notes.notesLabel")}
        </Label>
        <Textarea
          id="session-notes"
          rows={6}
          className="mt-2"
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
