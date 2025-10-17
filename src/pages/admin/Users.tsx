import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

export default function AdminUsers() {
  const { t } = useTranslation("pages");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.users.title")}</h1>
          <p className="text-muted-foreground">
            {t("admin.users.subtitle")}
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary">{t("admin.users.badge")}</Badge>
              {t("admin.users.sectionTitle")}
            </CardTitle>
            <CardDescription>
              {t("admin.users.sectionDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold">{t("admin.users.features.userList.title")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("admin.users.features.userList.description")}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold">{t("admin.users.features.roleManagement.title")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("admin.users.features.roleManagement.description")}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold">{t("admin.users.features.impersonation.title")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("admin.users.features.impersonation.description")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
