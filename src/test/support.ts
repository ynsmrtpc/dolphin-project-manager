import type Database from "better-sqlite3";

import { nowIso } from "@/lib/time";

/** Testler arasi temiz sayfa: tablolari bosaltir. */
export function reset(db: Database.Database) {
  db.exec(`
    DELETE FROM issues;
    DELETE FROM todos;
    DELETE FROM notes;
    DELETE FROM repos;
    DELETE FROM sessions;
    DELETE FROM users;
  `);
}

export function seedUser(
  db: Database.Database,
  overrides: Partial<{ login: string; githubId: number; token: string }> = {},
) {
  const login = overrides.login ?? "tester";
  const githubId = overrides.githubId ?? Math.floor(Math.random() * 1_000_000);
  const token = overrides.token ?? "gho_test_token";

  const result = db
    .prepare(
      `INSERT INTO users (github_id, login, name, avatar_url, access_token)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(githubId, login, login, null, token);

  return {
    id: Number(result.lastInsertRowid),
    github_id: githubId,
    login,
    name: login,
    avatar_url: null,
    access_token: token,
  };
}

export function seedRepo(
  db: Database.Database,
  userId: number,
  overrides: Partial<{
    githubRepoId: number;
    fullName: string;
    name: string;
    archived: boolean;
  }> = {},
) {
  const githubRepoId = overrides.githubRepoId ?? Math.floor(Math.random() * 1_000_000);
  const name = overrides.name ?? `repo-${githubRepoId}`;
  const fullName = overrides.fullName ?? `tester/${name}`;

  const result = db
    .prepare(
      `INSERT INTO repos (user_id, github_repo_id, full_name, name, owner, html_url,
                          default_branch, is_archived, archived_at)
       VALUES (?, ?, ?, ?, 'tester', ?, 'main', ?, ?)`,
    )
    .run(
      userId,
      githubRepoId,
      fullName,
      name,
      `https://github.com/${fullName}`,
      overrides.archived ? 1 : 0,
      overrides.archived ? nowIso() : null,
    );

  return { id: Number(result.lastInsertRowid), githubRepoId, fullName, name };
}

export function seedNote(db: Database.Database, repoId: number, title = "not") {
  const result = db
    .prepare(`INSERT INTO notes (repo_id, title, content) VALUES (?, ?, '')`)
    .run(repoId, title);
  return Number(result.lastInsertRowid);
}

export function seedTodo(
  db: Database.Database,
  repoId: number,
  overrides: Partial<{ title: string; done: boolean; batch: string }> = {},
) {
  const result = db
    .prepare(
      `INSERT INTO todos (repo_id, title, done, import_batch) VALUES (?, ?, ?, ?)`,
    )
    .run(
      repoId,
      overrides.title ?? "görev",
      overrides.done ? 1 : 0,
      overrides.batch ?? null,
    );
  return Number(result.lastInsertRowid);
}

export const count = (db: Database.Database, table: string, where = "1=1") =>
  (db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE ${where}`).get() as { c: number })
    .c;
