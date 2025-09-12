import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle, Loader2 } from "lucide-react";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { settingsHelpContent } from "@/lib/settingsHelpContent";
import { ProtectedFeature } from "@/components/ProtectedFeature";

export default function Integrations() {
  const { connection, loading, connectCalendar, disconnectCalendar } = useGoogleCalendar();

  return (
    <ProtectedFeature
      requiredPermissions={['manage_integrations', 'admin']}
      title="Integrations Access Required"
      description="You need integration management or admin permissions to access this section."
    >
      <SettingsPageWrapper>
      <SettingsHeader
        title="Integrations"
        description="Connect external services and manage third-party integrations"
        helpContent={settingsHelpContent.integrations}
      />
      
      <div className="space-y-8">
        {/* Calendar Integration Section */}
        <Card>
          <CardHeader>
            <CardTitle>Calendar Integration</CardTitle>
            <CardDescription>
              Connect your Google Calendar to sync sessions and reminders
            </CardDescription>
          </CardHeader>
          <CardContent>
            {connection.connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Connected to Google Calendar</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connected as: <span className="font-medium">{connection.email}</span>
                </p>
                {connection.expired && (
                  <p className="text-sm text-destructive">
                    Session expired. Please reconnect your calendar.
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
                  Disconnect Google Calendar
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
                Connect Google Calendar
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </SettingsPageWrapper>
    </ProtectedFeature>
  );
}