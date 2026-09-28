"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  DEFAULT_STUDIO_LOCALE,
  STUDIO_LOCALES,
  STUDIO_LOCALE_COOKIE,
  getDictionary,
  translate,
  type DictionaryKey,
  type StudioLocale,
} from "./dictionaries";

function readLocaleCookie(): StudioLocale {
  if (typeof document === "undefined") return DEFAULT_STUDIO_LOCALE;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${STUDIO_LOCALE_COOKIE}=`));
  const value = match?.split("=").pop()?.trim();
  return STUDIO_LOCALES.includes(value as StudioLocale)
    ? (value as StudioLocale)
    : DEFAULT_STUDIO_LOCALE;
}

interface LanguageContextValue {
  locale: StudioLocale;
  setLocale: (locale: StudioLocale) => void;
  /** Translate a chrome key; falls back to `fallback`, then English, then the key. */
  t: (key: DictionaryKey | string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  // English here: components rendered WITHOUT a provider (unit tests, static
  // previews) keep the historical English strings. The real app always mounts
  // LanguageProvider, which defaults to Turkish via cookie.
  locale: "en",
  setLocale: () => {},
  t: (key, fallback) => translate(key, "en", fallback),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<StudioLocale>(() => readLocaleCookie());

  const setLocale = useCallback((next: StudioLocale) => {
    setLocaleState(next);
    if (typeof document !== "undefined") {
      document.cookie = `${STUDIO_LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, []);

  const t = useCallback(
    (key: DictionaryKey | string, fallback?: string) => translate(key, locale, fallback),
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

/** Section chrome text by section id — falls back to the canonical English title. */
export function useSectionText(section: { id: string; title: string; description?: string }): {
  title: string;
  description?: string;
} {
  const { t, locale } = useLanguage();
  const dict = getDictionary(locale);
  const titleKey = `nav.sections.${section.id}.title` as DictionaryKey;
  const descriptionKey = `nav.sections.${section.id}.description` as DictionaryKey;
  return {
    title: titleKey in dict ? t(titleKey, section.title) : section.title,
    description:
      descriptionKey in dict ? t(descriptionKey, section.description) : section.description,
  };
}
