import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useTranslation } from "react-i18next";

export const LeadStep = () => {
  const { state } = useSessionPlanningContext();
  const { updateLead } = useSessionPlanningActions();
  const { t } = useTranslation("sessionPlanning");
  const leadPlaceholder = state.lead.name || t("steps.lead.namePlaceholder");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("steps.lead.description")}</p>
      <div className="space-y-2">
        <Label htmlFor="lead-name">{t("steps.lead.nameLabel")}</Label>
        <Input
          id="lead-name"
          placeholder={leadPlaceholder}
          value={state.lead.name ?? ""}
          onChange={(event) =>
            updateLead({
              ...state.lead,
              name: event.target.value
            })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lead-id">{t("steps.lead.idLabel")}</Label>
        <Input
          id="lead-id"
          placeholder={t("steps.lead.idPlaceholder")}
          value={state.lead.id ?? ""}
          onChange={(event) =>
            updateLead({
              ...state.lead,
              id: event.target.value
            })
          }
        />
      </div>
      <Button
        variant="outline"
        onClick={() =>
          updateLead({
            id: "lead-demo-id",
            name: t("steps.lead.demoName")
          })
        }
      >
        {t("steps.lead.loadDemo")}
      </Button>
    </div>
  );
};
