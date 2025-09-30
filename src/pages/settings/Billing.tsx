import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { settingsHelpContent } from "@/lib/settingsHelpContent";
import { useTranslation } from "react-i18next";

export default function Billing() {
  const { t } = useTranslation("pages");
  
  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title={t("settings.billing.title")}
        description={t("settings.billing.description")}
        helpContent={settingsHelpContent.billing}
      />
      <p className="text-muted-foreground">{t("settings.billing.comingSoon")}</p>
    </SettingsPageWrapper>
  );
}