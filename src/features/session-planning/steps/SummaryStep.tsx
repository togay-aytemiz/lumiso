import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useTranslation } from "react-i18next";
import { TFunction } from "i18next";

export const SummaryStep = () => {
  const { state } = useSessionPlanningContext();
  const { t } = useTranslation("sessionPlanning");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("steps.summary.description")}</p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {state.sessionName || t("summary.untitled")}
            {state.sessionTypeLabel ? <Badge variant="secondary">{state.sessionTypeLabel}</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <SummaryRow label={t("summary.labels.lead")} value={state.lead.name ?? t("summary.values.notSet")} />
          <SummaryRow label={t("summary.labels.project")} value={state.project.name ?? t("summary.values.notLinked")} />
          <SummaryRow label={t("summary.labels.schedule")} value={renderSchedule(state.schedule, t)} />
          <SummaryRow
            label={t("summary.labels.location")}
            value={state.location || state.meetingUrl || t("summary.values.notSet")}
          />
          <SummaryRow
            label={t("summary.labels.notes")}
            value={state.notes?.trim() ? state.notes : t("summary.values.empty")}
          />
          <Separator />
          <div className="text-muted-foreground">
            {t("summary.notifications.reminders")}:{" "}
            {t(state.notifications.sendReminder ? "summary.status.on" : "summary.status.off")} ·{" "}
            {t("summary.notifications.summaryEmail")}:{" "}
            {t(state.notifications.sendSummaryEmail ? "summary.status.on" : "summary.status.off")}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface SummaryRowProps {
  label: string;
  value: string;
}

const SummaryRow = ({ label, value }: SummaryRowProps) => (
  <div className="flex items-start gap-3">
    <span className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="flex-1">{value}</span>
  </div>
);

const renderSchedule = (schedule: { date?: string; time?: string; timezone?: string }, t: TFunction<"sessionPlanning">) => {
  if (!schedule.date && !schedule.time) {
    return t("summary.values.notScheduled");
  }
  const parts = [schedule.date ?? t("summary.values.dateTbd"), schedule.time ?? t("summary.values.timeTbd")];
  if (schedule.timezone) {
    parts.push(schedule.timezone);
  }
  return parts.join(" · ");
};
