import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, MapPin, User, Briefcase, Tag, FileText, Bell } from "lucide-react";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { getUserLocale, formatLongDate, formatTime } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useCommonTranslation } from "@/hooks/useTypedTranslation";
import type { SessionPlanningStepId } from "../types";
import { cn } from "@/lib/utils";

interface SessionPlanningSummarySidebarProps {
  onEditStep: (step: SessionPlanningStepId) => void;
  focusedStep?: SessionPlanningStepId;
}

export const SessionPlanningSummarySidebar = ({ onEditStep, focusedStep }: SessionPlanningSummarySidebarProps) => {
  const { state } = useSessionPlanningContext();
  const { t } = useTranslation("sessionPlanning");
  const { t: tCommon } = useCommonTranslation();

  const locale = getUserLocale();
  const sessionDateLabel = useMemo(() => {
    if (!state.schedule.date) return t("summary.values.notScheduled");
    return formatLongDate(state.schedule.date, locale);
  }, [state.schedule.date, locale, t]);

  const sessionTimeLabel = useMemo(() => {
    if (!state.schedule.time || !state.schedule.date) return undefined;
    return formatTime(state.schedule.time, locale);
  }, [state.schedule.time, state.schedule.date, locale]);

  const sections: {
    id: SessionPlanningStepId;
    title: string;
    icon: React.ElementType;
    value: string | null;
    helper?: string;
    badges?: string[];
  }[] = [
    {
      id: "lead",
      title: t("summary.labels.lead"),
      icon: User,
      value: state.lead.name || t("summary.values.notSet")
    },
    {
      id: "project",
      title: t("summary.labels.project"),
      icon: Briefcase,
      value: state.project.name || t("summary.values.notLinked")
    },
    {
      id: "sessionType",
      title: t("summary.labels.sessionType"),
      icon: Tag,
      value: state.sessionTypeLabel || t("summary.values.notSet")
    },
    {
      id: "schedule",
      title: t("summary.labels.schedule"),
      icon: Calendar,
      value: sessionDateLabel,
      badges: sessionTimeLabel ? [sessionTimeLabel, state.schedule.timezone || ""] : state.schedule.timezone ? [state.schedule.timezone] : []
    },
    {
      id: "location",
      title: t("summary.labels.location"),
      icon: MapPin,
      value: state.location || state.meetingUrl || t("summary.values.notSet")
    },
    {
      id: "notes",
      title: t("summary.labels.notes"),
      icon: FileText,
      value: state.notes?.trim() || t("summary.values.empty")
    }
  ];

  const notifications = {
    reminders: state.notifications.sendReminder ? t("summary.status.on") : t("summary.status.off"),
    summaryEmail: state.notifications.sendSummaryEmail ? t("summary.status.on") : t("summary.status.off")
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/15 shadow-sm shadow-primary/10">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold tracking-tight">{t("summaryPanel.title")}</CardTitle>
            <Badge variant="secondary" className="text-xs font-medium uppercase tracking-wide">
              {t("summaryPanel.status.draft")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{t("summaryPanel.subtitle")}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {sections.map((section) => {
            const Icon = section.icon;
            const isUnset = !section.value || section.value === t("summary.values.notSet");
            return (
              <div
                key={section.id}
                className={cn(
                  "group rounded-lg border border-border/60 bg-muted/40 px-4 py-3 transition-colors",
                  focusedStep === section.id ? "border-primary bg-primary/5" : "hover:border-primary/60"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {section.title}
                      </p>
                      <p className="text-sm font-medium text-foreground">{section.value}</p>
                      {section.badges && section.badges.filter(Boolean).length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {section.badges.filter(Boolean).map((badge) => (
                            <Badge key={badge} variant="outline" className="text-xs">
                              {badge}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                    onClick={() => onEditStep(section.id)}
                  >
                    {isUnset ? tCommon("buttons.add") : tCommon("buttons.edit")}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-muted/60 bg-muted/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Bell className="h-4 w-4 text-primary" />
            {t("summary.notifications.summaryEmail")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t("summaryPanel.notificationsHelper")}</p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("summary.notifications.reminders")}</span>
            <Badge variant={state.notifications.sendReminder ? "secondary" : "outline"} className="text-xs">
              {notifications.reminders}
            </Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("summary.notifications.summaryEmail")}</span>
            <Badge variant={state.notifications.sendSummaryEmail ? "secondary" : "outline"} className="text-xs">
              {notifications.summaryEmail}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
