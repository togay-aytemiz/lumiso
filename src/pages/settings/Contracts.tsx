import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { settingsHelpContent } from "@/lib/settingsHelpContent";
import { useTranslation } from "react-i18next";

export default function Contracts() {
  const { t } = useTranslation("pages");
  
  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title={t("settings.contracts.title")}
        description={t("settings.contracts.description")}
        helpContent={settingsHelpContent.contracts}
      />
      <p className="text-muted-foreground">{t("settings.contracts.comingSoon")}</p>
    </SettingsPageWrapper>
  );
}