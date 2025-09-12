import { ShieldX, ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface PermissionDeniedProps {
  title?: string;
  description?: string;
  requiredPermission?: string;
  showBackButton?: boolean;
}

export function PermissionDenied({ 
  title = "Access Denied", 
  description = "You don't have permission to access this page or feature.",
  requiredPermission,
  showBackButton = true 
}: PermissionDeniedProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="rounded-full bg-destructive/10 p-3">
              <Lock className="h-8 w-8 text-destructive" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
              {requiredPermission && (
                <p className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  Required permission: {requiredPermission}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {showBackButton && (
                <Button 
                  variant="outline" 
                  onClick={() => navigate(-1)}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Go Back
                </Button>
              )}
              <Button onClick={() => navigate("/")}>
                Go to Dashboard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}