import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Import translation resources
import enCommon from "./resources/en/common.json";
import enDashboard from "./resources/en/dashboard.json";
import enForms from "./resources/en/forms.json";
import enNavigation from "./resources/en/navigation.json";
import enMessages from "./resources/en/messages.json";
import enPages from "./resources/en/pages.json";
import enSessionPlanning from "./resources/en/sessionPlanning.json";
import enProjectCreation from "./resources/en/projectCreation.json";

import trCommon from "./resources/tr/common.json";
import trDashboard from "./resources/tr/dashboard.json";
import trForms from "./resources/tr/forms.json";
import trNavigation from "./resources/tr/navigation.json";
import trMessages from "./resources/tr/messages.json";
import trPages from "./resources/tr/pages.json";
import trSessionPlanning from "./resources/tr/sessionPlanning.json";
import trProjectCreation from "./resources/tr/projectCreation.json";

const resources = {
  en: {
    common: enCommon,
    dashboard: enDashboard,
    forms: enForms,
    navigation: enNavigation,
    messages: enMessages,
    pages: enPages,
    sessionPlanning: enSessionPlanning,
    projectCreation: enProjectCreation,
  },
  tr: {
    common: trCommon,
    dashboard: trDashboard,
    forms: trForms,
    navigation: trNavigation,
    messages: trMessages,
    pages: trPages,
    sessionPlanning: trSessionPlanning,
    projectCreation: trProjectCreation,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    debug: false,

    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
    },

    interpolation: {
      escapeValue: false,
    },

    defaultNS: "common",
    ns: ["common", "dashboard", "forms", "navigation", "messages", "pages", "sessionPlanning", "projectCreation"],
  });

i18n.addResourceBundle("en", "forms", enForms, true, false);
i18n.addResourceBundle("tr", "forms", trForms, true, true);
i18n.addResourceBundle("en", "sessionPlanning", enSessionPlanning, true, false);
i18n.addResourceBundle("tr", "sessionPlanning", trSessionPlanning, true, true);
i18n.addResourceBundle("en", "projectCreation", enProjectCreation, true, false);
i18n.addResourceBundle("tr", "projectCreation", trProjectCreation, true, true);

export default i18n;
