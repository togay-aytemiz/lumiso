import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, CheckCircle } from "lucide-react";
import Layout from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const { toast } = useToast();
  
  const handleConnectGoogleCalendar = () => {
    setIsCalendarConnected(true);
    toast({
      title: "Google Calendar Connected",
      description: "Successfully connected to your Google Calendar.",
    });
  };
  
  const handleDisconnectGoogleCalendar = () => {
    setIsCalendarConnected(false);
    toast({
      title: "Google Calendar Disconnected",
      description: "Successfully disconnected from your Google Calendar.",
    });
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and integrations</p>
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
              {isCalendarConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Connected to Google Calendar</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Connected as: <span className="font-medium">user@example.com</span>
                  </p>
                  <Button 
                    onClick={handleDisconnectGoogleCalendar}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    Disconnect Google Calendar
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={handleConnectGoogleCalendar}
                  className="flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Connect Google Calendar
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Future Settings Placeholder */}
          <div className="pt-16">
            <p className="text-sm text-muted-foreground">
              More settings like profile, notifications, and preferences will appear here soon.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;