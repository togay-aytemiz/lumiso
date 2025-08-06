import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle, Loader2 } from "lucide-react";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import ServicesSection from "@/components/ServicesSection";
import ProjectStatusesSection from "@/components/ProjectStatusesSection";
import ProjectTypesSection from "@/components/ProjectTypesSection";
import LeadStatusesSection from "@/components/LeadStatusesSection";
import { LeadPreferencesSection } from "@/components/LeadPreferencesSection";
import GlobalSearch from "@/components/GlobalSearch";

const Settings = () => {
  const { connection, loading, connectCalendar, disconnectCalendar } = useGoogleCalendar();

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your account and integrations</p>
          </div>
          <div className="w-full max-w-lg min-w-[480px] ml-8">
            <GlobalSearch />
          </div>
        </div>
      </div>

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

        {/* Lead Statuses Management Section */}
        <LeadStatusesSection />

        {/* Lead Preferences Section */}
        <LeadPreferencesSection />

        {/* Project Statuses Management Section */}
        <ProjectStatusesSection />

        {/* Project Types Management Section */}
        <ProjectTypesSection />

        {/* Services Management Section */}
        <ServicesSection />

        {/* Future Settings Placeholder */}
        <div className="pt-16">
          <p className="text-sm text-muted-foreground">
            More settings like profile, notifications, and preferences will appear here soon.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;