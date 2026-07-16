import { create } from "zustand";

export type Language = "en" | "zh";

export interface I18nState {
  language: Language;
  setLanguage: (language: Language) => void;
  initializeFromCookie: () => void;
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export const useI18nStore = create<I18nState>((set) => ({
  language: "en",
  setLanguage: (language) => {
    document.cookie = `harness-locale=${language}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    set({ language });
  },
  initializeFromCookie: () => {
    if (typeof window !== "undefined") {
      const match = document.cookie.match(/(?:^|;\s*)harness-locale=(\w+)/);
      const locale = match?.[1] === "zh" ? "zh" : "en";
      set({ language: locale });
      document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    }
  },
}));