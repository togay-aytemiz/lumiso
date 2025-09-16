import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminSystem() {
  const { isAdminOrSupport } = useUserRole();

  // Redirect if user doesn't have admin/support role
  if (!isAdminOrSupport()) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
          <p className="text-muted-foreground">
            Monitor system health, usage, and analytics
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary">Coming Soon</Badge>
              System Monitoring Features
            </CardTitle>
            <CardDescription>
              This section will include comprehensive system monitoring and analytics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold">Usage Statistics</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Track system usage across all users
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold">Performance Metrics</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Monitor response times and system health
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold">Error Tracking</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  View and manage system errors and issues
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}