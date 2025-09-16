import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminUsers() {

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts, roles, and permissions
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary">Coming Soon</Badge>
              User Management Features
            </CardTitle>
            <CardDescription>
              This section will include comprehensive user management capabilities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold">User List & Search</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Browse and search all users in the system
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold">Role Management</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Assign admin, support, or user roles
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold">User Impersonation</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Switch context to view as any user
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}