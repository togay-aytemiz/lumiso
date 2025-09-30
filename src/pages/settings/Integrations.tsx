import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle, Loader2 } from "lucide-react";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { settingsHelpContent } from "@/lib/settingsHelpContent";
import { useTranslation } from "react-i18next";

export default function Integrations() {
  const { t } = useTranslation("pages");
  const { connection, loading, connectCalendar, disconnectCalendar } = useGoogleCalendar();

  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title={t("settings.integrations.title")}
        description={t("settings.integrations.description")}
        helpContent={settingsHelpContent.integrations}
      />
      
      <div className="space-y-8">
        {/* Calendar Integration Section */}
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.integrations.calendar.title")}</CardTitle>
            <CardDescription>
              {t("settings.integrations.calendar.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {connection.connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">{t("settings.integrations.calendar.connected")}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("settings.integrations.calendar.connectedAs")} <span className="font-medium">{connection.email}</span>
                </p>
                {connection.expired && (
                  <p className="text-sm text-destructive">
                    {t("settings.integrations.calendar.expired")}
                  </p>
                )}
                <Button 
                  onClick={disconnectCalendar}
                  variant="outline"
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Calendar className="h-4 w-4" />
                  )}
                  {t("settings.integrations.calendar.disconnect")}
                </Button>
              </div>
            ) : (
              <Button 
                onClick={connectCalendar}
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
                {t("settings.integrations.calendar.connect")}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </SettingsPageWrapper>
  );
}