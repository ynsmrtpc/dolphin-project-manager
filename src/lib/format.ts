import { FALLBACK_LOCALE, type Locale } from "@/lib/i18n/config";

/** Bu dosya dusuk seviye bir yardimci; sozluge bagimli olmasin diye kendi etiketleri var. */
const LABELS: Record<Locale, { none: string; justNow: string; empty: string }> = {
  tr: { none: "tarih yok", justNow: "az önce", empty: "-" },
  en: { none: "no date", justNow: "just now", empty: "-" },
};

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

/**
 * Eski satirlar SQLite'in `datetime('now')` bicimini ("YYYY-MM-DD HH:MM:SS")
 * tasiyabilir; bu deger UTC'dir ama Z tasimaz, ekleyerek okuyoruz.
 */
function toDate(value: string | null | undefined) {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} /.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatRelative(
  value: string | null | undefined,
  locale: Locale = FALLBACK_LOCALE,
) {
  const date = toDate(value);
  if (!date) return LABELS[locale].none;

  const diff = date.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) {
      return formatter.format(Math.round(diff / ms), unit);
    }
  }

  return LABELS[locale].justNow;
}

export function formatDateTime(
  value: string | null | undefined,
  locale: Locale = FALLBACK_LOCALE,
) {
  const date = toDate(value);
  if (!date) return LABELS[locale].empty;

  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
