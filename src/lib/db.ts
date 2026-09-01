import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { encryptSecret, isEncrypted } from "@/lib/crypto";
import { env } from "@/lib/env";

declare global {
  // Dev modunda hot reload sirasinda tek bir baglanti kullanilsin diye.
  var __dolphinDb: Database.Database | undefined;
}

function createConnection() {
  const file = resolve(/* turbopackIgnore: true */ process.cwd(), env.databasePath);
  mkdirSync(dirname(file), { recursive: true });

  const db = new Database(file);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  /**
   * Ayni veritabanini birden fazla surec acabilir (dev sunucusu calisirken
   * `next build` gibi). Kilit varsa aninda hata vermek yerine bekle.
   */
  db.pragma("busy_timeout = 10000");

  migrate(db);
  encryptStoredTokens(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      github_id     INTEGER NOT NULL UNIQUE,
      login         TEXT    NOT NULL,
      name          TEXT,
      avatar_url    TEXT,
      access_token  TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT    PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      expires_at TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS repos (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      github_repo_id  INTEGER NOT NULL,
      full_name       TEXT    NOT NULL,
      name            TEXT    NOT NULL,
      owner           TEXT    NOT NULL,
      description     TEXT,
      is_private      INTEGER NOT NULL DEFAULT 0,
      html_url        TEXT    NOT NULL,
      default_branch  TEXT    NOT NULL DEFAULT 'main',
      language        TEXT,
      stars           INTEGER NOT NULL DEFAULT 0,
      pushed_at       TEXT,
      added_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE (user_id, github_repo_id)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id    INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
      title      TEXT    NOT NULL,
      content    TEXT    NOT NULL DEFAULT '',
      pinned     INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS todos (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id      INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
      title        TEXT    NOT NULL,
      done         INTEGER NOT NULL DEFAULT 0,
      priority     TEXT    NOT NULL DEFAULT 'normal',
      created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS issues (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id       INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
      number        INTEGER NOT NULL,
      title         TEXT    NOT NULL,
      state         TEXT    NOT NULL,
      is_pull       INTEGER NOT NULL DEFAULT 0,
      is_draft      INTEGER NOT NULL DEFAULT 0,
      is_merged     INTEGER NOT NULL DEFAULT 0,
      html_url      TEXT    NOT NULL,
      author_login  TEXT,
      comments      INTEGER NOT NULL DEFAULT 0,
      labels        TEXT    NOT NULL DEFAULT '[]',
      created_at    TEXT,
      updated_at    TEXT,
      UNIQUE (repo_id, number)
    );

    CREATE INDEX IF NOT EXISTS idx_repos_user  ON repos(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_repo  ON notes(repo_id);
    CREATE INDEX IF NOT EXISTS idx_todos_repo  ON todos(repo_id);
    CREATE INDEX IF NOT EXISTS idx_issues_repo ON issues(repo_id, state);
  `);

  addColumn(db, "users", "repos_synced_at", "TEXT");
  addColumn(db, "repos", "summary", "TEXT");
  addColumn(db, "repos", "summary_source", "TEXT");
  addColumn(db, "repos", "summary_updated_at", "TEXT");
  addColumn(db, "repos", "issues_synced_at", "TEXT");
  addColumn(db, "repos", "is_archived", "INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "repos", "archived_at", "TEXT");

  // Bir gorevden acilan GitHub issue'sunun izi.
  addColumn(db, "todos", "import_batch", "TEXT");
  addColumn(db, "todos", "issue_number", "INTEGER");
  addColumn(db, "todos", "issue_url", "TEXT");
}

/** Eski kurulumlardan kalan duz metin token'lari bir kereye mahsus sifreler. */
function encryptStoredTokens(db: Database.Database) {
  const rows = db.prepare(`SELECT id, access_token FROM users`).all() as {
    id: number;
    access_token: string;
  }[];

  const update = db.prepare(`UPDATE users SET access_token = ? WHERE id = ?`);

  for (const row of rows) {
    if (isEncrypted(row.access_token)) continue;
    update.run(encryptSecret(row.access_token), row.id);
  }
}

/** SQLite'ta "ADD COLUMN IF NOT EXISTS" yok; once tablo semasina bakiyoruz. */
function addColumn(
  db: Database.Database,
  table: string,
  column: string,
  definition: string,
) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];

  if (columns.some((item) => item.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export const db = globalThis.__dolphinDb ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  globalThis.__dolphinDb = db;
}

export type UserRow = {
  id: number;
  github_id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  access_token: string;
};

export type RepoRow = {
  id: number;
  user_id: number;
  github_repo_id: number;
  full_name: string;
  name: string;
  owner: string;
  description: string | null;
  is_private: number;
  html_url: string;
  default_branch: string;
  language: string | null;
  stars: number;
  pushed_at: string | null;
  added_at: string;
  summary: string | null;
  summary_source: string | null;
  summary_updated_at: string | null;
  issues_synced_at: string | null;
  is_archived: number;
  archived_at: string | null;
};

export type NoteRow = {
  id: number;
  repo_id: number;
  title: string;
  content: string;
  pinned: number;
  created_at: string;
  updated_at: string;
};

export type TodoRow = {
  id: number;
  repo_id: number;
  title: string;
  done: number;
  priority: "low" | "normal" | "high";
  created_at: string;
  completed_at: string | null;
  issue_number: number | null;
  issue_url: string | null;
  import_batch: string | null;
};

export type IssueRow = {
  id: number;
  repo_id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  is_pull: number;
  is_draft: number;
  is_merged: number;
  html_url: string;
  author_login: string | null;
  comments: number;
  labels: string;
  created_at: string | null;
  updated_at: string | null;
};
