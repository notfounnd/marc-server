import i18n from "i18next";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

void i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: "en_US",
    fallbackLng: "en_US",
    supportedLngs: ["en_US"],
    keySeparator: false,
    returnNull: false,
    backend: {
      loadPath: "/locales/{{lng}}/translation.json"
    },
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

export default i18n;
