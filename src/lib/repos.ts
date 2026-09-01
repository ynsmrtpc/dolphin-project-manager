import { db, type UserRow } from "@/lib/db";
import { env } from "@/lib/env";
import { MAX_FETCHED_REPOS, fetchAllRepos } from "@/lib/github";
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

  /**
   * Uzak listede olmayan depoyu SILMIYORUZ: bir depo silinmis olabilecegi gibi
   * erisim iptali, devir veya private'a alinma yuzunden de listeden dusebilir.
   * Isaretleyip karari kullaniciya birakiyoruz.
   *
   * Liste bos donduyse ya da sayfa ust sinirina dayandiysa guvenilmez sayip
   * hicbir seyi isaretlemiyoruz — aksi halde gecici bir API hatasi tum
   * depolari "kayip" gosterebilir.
   */
  const trustworthy = remote.length > 0 && remote.length < MAX_FETCHED_REPOS;

  const markMissing = db.prepare(
    `UPDATE repos
        SET missing_since = ?
      WHERE user_id = ?
        AND missing_since IS NULL
        AND github_repo_id NOT IN (SELECT value FROM json_each(?))`,
  );
  const clearMissing = db.prepare(
    `UPDATE repos
        SET missing_since = NULL
      WHERE user_id = ?
        AND missing_since IS NOT NULL
        AND github_repo_id IN (SELECT value FROM json_each(?))`,
  );

  let updated = 0;
  let missing = 0;

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

    if (trustworthy) {
      const ids = JSON.stringify(remote.map((repo) => repo.id));
      missing = markMissing.run(nowIso(), user.id, ids).changes;
      clearMissing.run(user.id, ids);
    }

    stamp.run(nowIso(), user.id);
  })();

  return { updated, missing };
}
