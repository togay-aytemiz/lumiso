import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import Layout from "@/components/Layout";

const Settings = () => {
  const handleConnectGoogleCalendar = () => {
    // TODO: Implement Google Calendar integration
    console.log("Google Calendar integration will be implemented here");
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
              <Button 
                onClick={handleConnectGoogleCalendar}
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                Connect Google Calendar
              </Button>
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