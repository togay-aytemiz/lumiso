import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import { useTranslation } from "react-i18next";

export default function BillingSubscription() {
  const { t } = useTranslation("pages");

  return (
    <SettingsPageWrapper>
      <div className="rounded-2xl border border-dashed border-muted-foreground/40 bg-muted/10 p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          {t("settings.billingSubscription.title")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("settings.billingSubscription.description")}
        </p>
        <p className="mt-6 text-sm font-medium text-muted-foreground">
          {t("settings.billingSubscription.comingSoon")}
        </p>
      </div>
    </SettingsPageWrapper>
  );
}
