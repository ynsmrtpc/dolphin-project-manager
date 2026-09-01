import { db, type IssueRow, type RepoRow } from "@/lib/db";
import { env } from "@/lib/env";
import { fetchIssues, type GithubIssue } from "@/lib/github";
import { nowIso } from "@/lib/time";

export type IssueItem = {
  number: number;
  title: string;
  state: "open" | "closed";
  isPull: boolean;
  isDraft: boolean;
  isMerged: boolean;
  htmlUrl: string;
  author: string | null;
  comments: number;
  labels: { name: string; color: string }[];
  updatedAt: string | null;
};

/** Onbellek TTL'den eskiyse (ya da hic yoksa) tazelenmeli. */
export function isStale(repo: RepoRow) {
  if (!repo.issues_synced_at) return true;
  const age = Date.now() - new Date(repo.issues_synced_at).getTime();
  return !Number.isFinite(age) || age > env.issueSyncTtlMinutes * 60 * 1000;
}

/**
 * Acik ve kapali kayitlari cekip depo icin onbellegi tamamen yeniler.
 * Iki GitHub istegi harcar; yalnizca TTL dolunca veya elle tazelemede cagrilir.
 */
export async function syncIssues(token: string, repo: RepoRow) {
  const [open, closed] = await Promise.all([
    fetchIssues(token, repo.full_name, "open"),
    fetchIssues(token, repo.full_name, "closed"),
  ]);

  const rows = [...open, ...closed];

  const remove = db.prepare(`DELETE FROM issues WHERE repo_id = ?`);
  const insert = db.prepare(
    `INSERT INTO issues (repo_id, number, title, state, is_pull, is_draft, is_merged,
                         html_url, author_login, comments, labels, created_at, updated_at)
     VALUES (@repo_id, @number, @title, @state, @is_pull, @is_draft, @is_merged,
             @html_url, @author_login, @comments, @labels, @created_at, @updated_at)
     ON CONFLICT(repo_id, number) DO NOTHING`,
  );
  const stamp = db.prepare(`UPDATE repos SET issues_synced_at = ? WHERE id = ?`);

  db.transaction(() => {
    remove.run(repo.id);

    for (const item of rows) {
      insert.run({
        repo_id: repo.id,
        number: item.number,
        title: item.title,
        state: item.state,
        is_pull: item.pull_request ? 1 : 0,
        is_draft: item.draft ? 1 : 0,
        is_merged: item.pull_request?.merged_at ? 1 : 0,
        html_url: item.html_url,
        author_login: item.user?.login ?? null,
        comments: item.comments,
        labels: JSON.stringify(
          (item.labels ?? []).map((label) => ({
            name: label.name,
            color: label.color,
          })),
        ),
        created_at: item.created_at,
        updated_at: item.updated_at,
      });
    }

    stamp.run(nowIso(), repo.id);
  })();

  return rows.length;
}

/** Tek bir yeni kaydi (ornegin az once acilan issue'yu) onbellege ekler. */
export function cacheIssue(repoId: number, item: GithubIssue) {
  db.prepare(
    `INSERT INTO issues (repo_id, number, title, state, is_pull, is_draft, is_merged,
                         html_url, author_login, comments, labels, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(repo_id, number) DO UPDATE SET
       title = excluded.title,
       state = excluded.state,
       updated_at = excluded.updated_at`,
  ).run(
    repoId,
    item.number,
    item.title,
    item.state,
    item.html_url,
    item.user?.login ?? null,
    item.comments ?? 0,
    JSON.stringify([]),
    item.created_at,
    item.updated_at,
  );
}

export function readIssues(repoId: number, state: "open" | "closed"): IssueItem[] {
  const rows = db
    .prepare(
      `SELECT * FROM issues
        WHERE repo_id = ? AND state = ?
        ORDER BY updated_at DESC NULLS LAST, number DESC`,
    )
    .all(repoId, state) as IssueRow[];

  return rows.map((row) => ({
    number: row.number,
    title: row.title,
    state: row.state,
    isPull: Boolean(row.is_pull),
    isDraft: Boolean(row.is_draft),
    isMerged: Boolean(row.is_merged),
    htmlUrl: row.html_url,
    author: row.author_login,
    comments: row.comments,
    labels: safeLabels(row.labels),
    updatedAt: row.updated_at,
  }));
}

function safeLabels(raw: string): { name: string; color: string }[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
