import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminLocalization() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Localization</h1>
          <p className="text-muted-foreground">
            Manage languages and regional settings
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary">Coming Soon</Badge>
              Language Management Features
            </CardTitle>
            <CardDescription>
              This section will include comprehensive language and localization management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold">Language Settings</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure available languages and default locale
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold">Translation Management</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage translations for all system text
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold">Regional Formats</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure date, time, and number formats
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}