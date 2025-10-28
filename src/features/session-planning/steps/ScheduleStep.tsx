import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarTimePicker } from "@/components/CalendarTimePicker";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useTranslation } from "react-i18next";
import { format, parseISO } from "date-fns";
import { useSessionTypes } from "@/hooks/useOrganizationData";

export const ScheduleStep = () => {
  const { state } = useSessionPlanningContext();
  const { updateSchedule } = useSessionPlanningActions();
  const { t } = useTranslation("sessionPlanning");
  const { data: sessionTypes = [] } = useSessionTypes();

  const initialDate = useMemo(() => {
    if (!state.schedule.date) return undefined;
    try {
      return parseISO(state.schedule.date);
    } catch (error) {
      console.error("Unable to parse schedule date", error);
      return undefined;
    }
  }, [state.schedule.date]);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate);

  useEffect(() => {
    if (!state.schedule.date) {
      setSelectedDate(undefined);
      return;
    }
    try {
      const parsed = parseISO(state.schedule.date);
      if (!Number.isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
      }
    } catch (error) {
      console.error("Schedule step parse error", error);
    }
  }, [state.schedule.date]);

  const handleDateChange = (date: Date | undefined) => {
    setSelectedDate(date);
    updateSchedule({
      date: date ? format(date, "yyyy-MM-dd") : "",
      time: date ? state.schedule.time : ""
    });
  };

  const handleDateStringChange = (dateString: string) => {
    updateSchedule({ date: dateString });
  };

  const handleTimeChange = (time: string) => {
    updateSchedule({ time });
  };

  const selectedSessionDurationMinutes = useMemo(() => {
    if (!state.sessionTypeId) return null;
    const match = sessionTypes.find((type) => type.id === state.sessionTypeId);
    if (typeof match?.duration_minutes === "number" && match.duration_minutes > 0) {
      return match.duration_minutes;
    }
    return null;
  }, [sessionTypes, state.sessionTypeId]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{t("steps.schedule.navigationLabel")}</h2>
        <p className="text-sm text-muted-foreground">{t("steps.schedule.description")}</p>
      </div>

      <CalendarTimePicker
        selectedDate={selectedDate}
        selectedTime={state.schedule.time ?? ""}
        onDateChange={handleDateChange}
        onTimeChange={handleTimeChange}
        onDateStringChange={handleDateStringChange}
        selectedSessionDurationMinutes={selectedSessionDurationMinutes ?? undefined}
      />

    </div>
  );
};
