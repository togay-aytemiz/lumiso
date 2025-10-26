import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useTranslation } from "react-i18next";

const TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Istanbul"
] as const;

export const ScheduleStep = () => {
  const { state } = useSessionPlanningContext();
  const { updateSchedule } = useSessionPlanningActions();
  const { t } = useTranslation("sessionPlanning");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("steps.schedule.description")}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="session-date">{t("steps.schedule.dateLabel")}</Label>
          <Input
            id="session-date"
            type="date"
            value={state.schedule.date ?? ""}
            onChange={(event) =>
              updateSchedule({
                date: event.target.value
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="session-time">{t("steps.schedule.timeLabel")}</Label>
          <Input
            id="session-time"
            type="time"
            value={state.schedule.time ?? ""}
            onChange={(event) =>
              updateSchedule({
                time: event.target.value
              })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="session-timezone">{t("steps.schedule.timezoneLabel")}</Label>
        <Select
          value={state.schedule.timezone ?? "UTC"}
          onValueChange={(value) =>
            updateSchedule({
              timezone: value
            })
          }
        >
          <SelectTrigger id="session-timezone" aria-label={t("steps.schedule.timezoneLabel")}>
            <SelectValue placeholder={t("steps.schedule.timezonePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONE_OPTIONS.map((timezone) => (
              <SelectItem key={timezone} value={timezone}>
                {timezone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
