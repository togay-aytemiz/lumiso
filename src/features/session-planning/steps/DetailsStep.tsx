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
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{t("steps.details.navigationLabel")}</h2>
        <p className="text-sm text-muted-foreground">{t("steps.details.description")}</p>
      </div>

      <div className="grid gap-4">
        <div className="rounded-lg border border-border/70 bg-muted/40 p-4 shadow-sm">
          <Label htmlFor="session-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("steps.details.nameLabel")}
          </Label>
          <Input
            id="session-name"
            value={state.sessionName ?? ""}
            placeholder={t("steps.details.namePlaceholder")}
            className="mt-2"
            onChange={(event) =>
              updateSessionFields({
                sessionName: event.target.value
              })
            }
          />
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/40 p-4 shadow-sm">
          <Label htmlFor="session-notes" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("steps.details.notesLabel")}
          </Label>
          <Textarea
            id="session-notes"
            rows={4}
            placeholder={t("steps.details.notesPlaceholder")}
            className="mt-2 resize-none"
            value={state.notes ?? ""}
            onChange={(event) =>
              updateSessionFields({
                notes: event.target.value
              })
            }
          />
        </div>
      </div>
    </div>
  );
};
