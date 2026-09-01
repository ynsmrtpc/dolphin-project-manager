"use client";

import { createContext, useContext, useMemo } from "react";

import type { Locale } from "@/lib/i18n/config";
import { createTranslate, type MessageTree, type Translate } from "@/lib/i18n/translate";

type LocaleContextValue = { locale: Locale; messages: MessageTree };

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  messages,
  children,
}: LocaleContextValue & { children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleContext() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("LocaleProvider bulunamadı.");
  }
  return context;
}

export function useLocale(): Locale {
  return useLocaleContext().locale;
}

/** İstemci bilesenleri icin ceviri fonksiyonu. */
export function useT(): Translate {
  const { locale, messages } = useLocaleContext();
  return useMemo(
    () => createTranslate(messages, messages, locale),
    [messages, locale],
  );
}
