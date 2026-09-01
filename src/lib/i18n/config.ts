export const LOCALES = ["tr", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * Ceviri kaynagi. Bir anahtar secili dilde eksikse buradaki metne dusulur;
 * `tr.ts` tam olmak zorunda oldugu icin kaynak dil odur.
 */
export const SOURCE_LOCALE: Locale = "tr";

/** Tarayici dili desteklenmiyorsa gosterilecek dil. */
export const FALLBACK_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "dolphin-locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  tr: "Türkçe",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * `Accept-Language` basligindan desteklenen ilk dili secer.
 * Ornek: "tr-TR,tr;q=0.9,en-US;q=0.8" -> "tr"
 *
 * Kalite degeri (q) yuksekten dusuge siralanir; alt etiketler
 * ("en-GB") ana dile indirgenir.
 */
export function localeFromAcceptLanguage(header: string | null | undefined) {
  if (!header) return null;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const quality = params
        .map((param) => param.trim())
        .find((param) => param.startsWith("q="));

      const q = quality ? Number(quality.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((entry) => entry.tag.length > 0 && entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }

  return null;
}
