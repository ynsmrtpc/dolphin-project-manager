import { db } from "@/lib/db";
import { env } from "@/lib/env";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Saklama suresi kapaliysa (0) arsiv kendiliginden silinmez. */
export function retentionEnabled() {
  return env.archiveRetentionDays > 0;
}

/** Bu arsiv kaydinin kalici silinmesine kac gun kaldi (kapaliysa null). */
export function daysUntilPurge(archivedAt: string | null) {
  if (!retentionEnabled() || !archivedAt) return null;

  const archived = new Date(archivedAt).getTime();
  if (!Number.isFinite(archived)) return null;

  const elapsed = (Date.now() - archived) / DAY_MS;
  return Math.max(0, Math.ceil(env.archiveRetentionDays - elapsed));
}

/**
 * Saklama suresi dolan arsiv kayitlarini notlari ve gorevleriyle birlikte siler.
 *
 * Zamanlanmis is yok: sayfa acilislarinda cagriliyor. Yalnizca yerel bir
 * DELETE oldugu icin maliyeti yok denecek kadar az.
 */
export function purgeExpiredArchives(userId: number) {
  if (!retentionEnabled()) return 0;

  const cutoff = new Date(Date.now() - env.archiveRetentionDays * DAY_MS).toISOString();

  return db
    .prepare(
      `DELETE FROM repos
        WHERE user_id = ?
          AND is_archived = 1
          AND archived_at IS NOT NULL
          AND archived_at < ?`,
    )
    .run(userId, cutoff).changes;
}
