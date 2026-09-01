/**
 * Veritabanina yazilan tum zaman damgalari tek formatta olsun diye
 * merkezi yardimci: her zaman UTC, her zaman ISO-8601 ("...Z").
 *
 * Eski satirlar SQLite'in `datetime('now')` bicimini ("YYYY-MM-DD HH:MM:SS")
 * tasiyabilir; okuma tarafi (`lib/format.ts`) ikisini de tanir.
 */
export function nowIso() {
  return new Date().toISOString();
}
