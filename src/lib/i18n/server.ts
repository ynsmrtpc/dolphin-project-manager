import { cookies, headers } from "next/headers";

import {
  FALLBACK_LOCALE,
  LOCALE_COOKIE,
  SOURCE_LOCALE,
  isLocale,
  localeFromAcceptLanguage,
  type Locale,
} from "@/lib/i18n/config";
import { en } from "@/lib/i18n/messages/en";
import { tr } from "@/lib/i18n/messages/tr";
import { createTranslate, type MessageTree, type Translate } from "@/lib/i18n/translate";

const DICTIONARIES: Record<Locale, MessageTree> = {
  tr: tr as unknown as MessageTree,
  en: en as unknown as MessageTree,
};

/**
 * Dil sirasi:
 *   1. Kullanicinin acikca sectigi dil (cerez)
 *   2. Tarayici/isletim sistemi dili (Accept-Language)
 *   3. Ingilizce
 */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  const browser = localeFromAcceptLanguage((await headers()).get("accept-language"));
  return browser ?? FALLBACK_LOCALE;
}

export function getMessages(locale: Locale): MessageTree {
  return DICTIONARIES[locale];
}

/** Sunucu bilesenleri ve server action'lar icin ceviri fonksiyonu. */
export async function getT(): Promise<Translate> {
  const locale = await getLocale();
  return createTranslate(DICTIONARIES[locale], DICTIONARIES[SOURCE_LOCALE], locale);
}
