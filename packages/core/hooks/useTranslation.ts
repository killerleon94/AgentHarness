import { useEffect, useMemo, useRef } from "react";
import { translations } from "../i18n";
import { useI18nStore } from "../i18n/store";

const defaultLanguage: keyof typeof translations = "en";

export function useTranslation() {
  const language = useI18nStore((state) => state.language);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      useI18nStore.getState().initializeFromCookie();
    }
  }, []);

  const t = useMemo(() => {
    const trans = translations[language] || translations[defaultLanguage];

    return (key: string, valuesOrFallback?: Record<string, string | number> | string): string => {
      const keys = key.split(".");
      let value: any = trans;

      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) break;
      }

      if (typeof value !== "string") {
        return typeof valuesOrFallback === "string" ? valuesOrFallback : key;
      }

      if (typeof valuesOrFallback === "string") {
        return value;
      }

      if (!valuesOrFallback) {
        return value;
      }

      return value.replace(/\{(\w+)\}/g, (match, varName) => {
        return String(valuesOrFallback[varName] ?? match);
      });
    };
  }, [language]);

  return { t, language };
}