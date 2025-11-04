import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import { useTranslation } from "react-i18next";

export default function Contracts() {
  const { t } = useTranslation("pages");
  
  return (
    <SettingsPageWrapper>
      <p className="text-muted-foreground">{t("settings.contracts.comingSoon")}</p>
    </SettingsPageWrapper>
  );
}
