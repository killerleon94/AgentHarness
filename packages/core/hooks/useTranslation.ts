import { useMemo } from "react";
import { translations } from "../i18n";
import { useI18nStore } from "../i18n/store";

const defaultLanguage: keyof typeof translations = "en";

/**
 * Translate function accepting a key and a fallback string.
 * Shared across view components that receive an optional `t` prop.
 */
export type TranslateFn = (key: string, fallback: string) => string;

/** Identity translate that always returns the provided fallback string. */
export const fallbackT: TranslateFn = (_key, fallback) => fallback;

/** Resolve an optional translate prop to a concrete function, defaulting to `fallbackT`. */
export function withT(t?: TranslateFn): TranslateFn {
  return t ?? fallbackT;
}

export function useTranslation() {
  const language = useI18nStore((state) => state.language);

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