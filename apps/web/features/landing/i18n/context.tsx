"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { en } from "./en";
import { zh } from "./zh";
import type { LandingDict, Locale } from "./types";
import { useI18nStore } from "@multica/core";

const dictionaries: Record<Locale, LandingDict> = { en, zh };

const COOKIE_NAME = "harness-locale";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

type LocaleContextValue = {
  locale: Locale;
  t: LandingDict;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const i18nLanguage = useI18nStore((s) => s.language);
  const setI18nLanguage = useI18nStore((s) => s.setLanguage);
  const isMounted = useRef(false);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    if (i18nLanguage !== locale) {
      setLocaleState(i18nLanguage);
    }
  }, [i18nLanguage, locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setI18nLanguage(l);
    document.cookie = `${COOKIE_NAME}=${l}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }, [setI18nLanguage]);

  return (
    <LocaleContext.Provider
      value={{ locale, t: dictionaries[locale], setLocale }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
