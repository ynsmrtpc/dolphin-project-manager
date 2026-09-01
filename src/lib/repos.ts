import { db, type UserRow } from "@/lib/db";
import { env } from "@/lib/env";
import { fetchAllRepos } from "@/lib/github";
import { nowIso } from "@/lib/time";

/** Depo meta verisi (yildiz, aciklama, son push) bu sureden eskiyse tazelenir. */
export function isRepoMetaStale(syncedAt: string | null) {
  if (!syncedAt) return true;
  const age = Date.now() - new Date(syncedAt).getTime();
  return !Number.isFinite(age) || age > env.repoSyncTtlMinutes * 60 * 1000;
}

export function repoMetaSyncedAt(userId: number) {
  const row = db
    .prepare(`SELECT repos_synced_at FROM users WHERE id = ?`)
    .get(userId) as { repos_synced_at: string | null } | undefined;

  return row?.repos_synced_at ?? null;
}

/**
 * Tek bir `GET /user/repos` turuyla kullanicinin TUM depolarinin meta verisini
 * gunceller — depo basina istek atmaz.
 */
export async function syncRepoMeta(user: UserRow) {
  const remote = await fetchAllRepos(user.access_token);

  const update = db.prepare(
    `UPDATE repos
        SET full_name = ?, name = ?, owner = ?, description = ?, is_private = ?,
            html_url = ?, default_branch = ?, language = ?, stars = ?, pushed_at = ?
      WHERE user_id = ? AND github_repo_id = ?`,
  );
  const stamp = db.prepare(`UPDATE users SET repos_synced_at = ? WHERE id = ?`);

  let updated = 0;

  db.transaction(() => {
    for (const repo of remote) {
      const result = update.run(
        repo.full_name,
        repo.name,
        repo.owner.login,
        repo.description,
        repo.private ? 1 : 0,
        repo.html_url,
        repo.default_branch,
        repo.language,
        repo.stargazers_count,
        repo.pushed_at,
        user.id,
        repo.id,
      );
      updated += result.changes;
    }

    stamp.run(nowIso(), user.id);
  })();

  return updated;
}
