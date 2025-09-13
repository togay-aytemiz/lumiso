import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeft } from "lucide-react";

export default function AcceptInvitation() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <CardTitle>Team Invitations Not Available</CardTitle>
          <CardDescription>
            This is a single photographer application. Team management features are not available.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            If you're looking to manage your photography business, please use the main dashboard.
          </p>
          <Button 
            onClick={() => navigate("/")}
            className="w-full"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}