import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

export default function AdminSystem() {
  const { t } = useTranslation("pages");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.system.title")}</h1>
          <p className="text-muted-foreground">
            {t("admin.system.subtitle")}
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary">{t("admin.system.badge")}</Badge>
              {t("admin.system.sectionTitle")}
            </CardTitle>
            <CardDescription>
              {t("admin.system.sectionDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold">{t("admin.system.features.usage.title")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("admin.system.features.usage.description")}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold">{t("admin.system.features.performance.title")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("admin.system.features.performance.description")}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold">{t("admin.system.features.errors.title")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("admin.system.features.errors.description")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
