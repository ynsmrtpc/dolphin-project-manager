import type { Locale } from "@/lib/i18n/config";

/** Sozluk degeri: duz metin ya da tekil/cogul cifti. */
export type Message = string | { one: string; other: string };

export type MessageTree = { [key: string]: Message | MessageTree };

export type TranslateParams = Record<string, string | number>;

/** `t("a.b.c", { count: 3, name: "x" })` seklinde cagrilir. */
export type Translate = (key: string, params?: TranslateParams) => string;

function lookup(tree: MessageTree, key: string): Message | undefined {
  let current: Message | MessageTree | undefined = tree;

  for (const part of key.split(".")) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      return undefined;
    }
    current = (current as MessageTree)[part];
    if (current === undefined) return undefined;
  }

  return typeof current === "string" || isPlural(current) ? current : undefined;
}

function isPlural(value: unknown): value is { one: string; other: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "one" in value &&
    "other" in value
  );
}

function interpolate(template: string, params?: TranslateParams) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Sozlukten ceviri uretir.
 *
 * Turkce sayilardan sonra cogul eki almadigi icin cogul secimi yalnizca
 * Ingilizce'de anlamli; yine de her iki dil ayni yapiyi kullaniyor.
 */
export function createTranslate(
  messages: MessageTree,
  fallback: MessageTree,
  locale: Locale,
): Translate {
  return (key, params) => {
    const value = lookup(messages, key) ?? lookup(fallback, key);

    if (value === undefined) {
      // Eksik anahtar sessizce kaybolmasin.
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[i18n] eksik çeviri: ${key} (${locale})`);
      }
      return key;
    }

    if (typeof value === "string") return interpolate(value, params);

    const count = Number(params?.count ?? 0);
    const form = locale === "tr" ? value.other : count === 1 ? value.one : value.other;
    return interpolate(form, params);
  };
}
