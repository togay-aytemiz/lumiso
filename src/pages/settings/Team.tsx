import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Team() {
  const navigate = useNavigate();

  return (
    <SettingsPageWrapper>
      <SettingsHeader 
        title="Team Management" 
        description="Team features are not available in single photographer mode" 
      />
      
      <Card className="max-w-2xl">
        <CardHeader className="text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <CardTitle>Team Management Not Available</CardTitle>
          <CardDescription>
            This is a single photographer application. Team management, invitations, and role assignments are not supported.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              As a solo photographer, you have full access to all features without needing team management.
            </p>
            <p className="text-sm text-muted-foreground">
              You can manage your leads, projects, sessions, and settings directly from the main dashboard.
            </p>
          </div>
          <Button 
            onClick={() => navigate("/settings/profile")}
            variant="outline"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
        </CardContent>
      </Card>
    </SettingsPageWrapper>
  );
}