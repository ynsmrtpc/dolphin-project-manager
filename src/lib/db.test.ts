import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { count, reset, seedNote, seedRepo, seedTodo, seedUser } from "@/test/support";

beforeEach(() => reset(db));

function columns(table: string) {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
    (row) => row.name,
  );
}

describe("şema", () => {
  it("tüm tabloları oluşturur", () => {
    const tables = (
      db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
        .all() as { name: string }[]
    ).map((row) => row.name);

    for (const table of ["users", "sessions", "repos", "notes", "todos", "issues"]) {
      expect(tables, table).toContain(table);
    }
  });

  it("sonradan eklenen kolonları taşır", () => {
    expect(columns("users")).toContain("repos_synced_at");
    expect(columns("repos")).toEqual(
      expect.arrayContaining([
        "summary",
        "summary_source",
        "summary_updated_at",
        "issues_synced_at",
        "is_archived",
        "archived_at",
      ]),
    );
    expect(columns("todos")).toEqual(
      expect.arrayContaining(["import_batch", "issue_number", "issue_url"]),
    );
  });

  it("yabancı anahtarlar açık", () => {
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  it("kilit bekleme süresi tanımlı (eşzamanlı süreçler için)", () => {
    expect(db.pragma("busy_timeout", { simple: true })).toBeGreaterThan(0);
  });
});

describe("silme zinciri", () => {
  it("depo silinince notları, görevleri ve issue'ları da gider", () => {
    const user = seedUser(db);
    const repo = seedRepo(db, user.id);

    seedNote(db, repo.id);
    seedTodo(db, repo.id);
    db.prepare(
      `INSERT INTO issues (repo_id, number, title, state, html_url)
       VALUES (?, 1, 'issue', 'open', 'https://example.com')`,
    ).run(repo.id);

    expect(count(db, "notes")).toBe(1);
    expect(count(db, "todos")).toBe(1);
    expect(count(db, "issues")).toBe(1);

    db.prepare(`DELETE FROM repos WHERE id = ?`).run(repo.id);

    expect(count(db, "notes")).toBe(0);
    expect(count(db, "todos")).toBe(0);
    expect(count(db, "issues")).toBe(0);
  });

  it("kullanıcı silinince depoları da gider", () => {
    const user = seedUser(db);
    seedRepo(db, user.id);

    db.prepare(`DELETE FROM users WHERE id = ?`).run(user.id);
    expect(count(db, "repos")).toBe(0);
  });
});

describe("varsayılan zaman damgaları", () => {
  it("ISO-8601/UTC biçiminde yazılır", () => {
    const user = seedUser(db);
    const repo = seedRepo(db, user.id);
    seedNote(db, repo.id);

    const row = db.prepare(`SELECT created_at FROM notes LIMIT 1`).get() as {
      created_at: string;
    };

    expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/);
    expect(Number.isNaN(new Date(row.created_at).getTime())).toBe(false);
  });
});

describe("benzersizlik kısıtları", () => {
  it("aynı kullanıcıya aynı depo iki kez eklenemez", () => {
    const user = seedUser(db);
    seedRepo(db, user.id, { githubRepoId: 42 });

    expect(() => seedRepo(db, user.id, { githubRepoId: 42 })).toThrow();
  });

  it("farklı kullanıcılar aynı depoyu ekleyebilir", () => {
    const a = seedUser(db, { login: "a", githubId: 1 });
    const b = seedUser(db, { login: "b", githubId: 2 });

    seedRepo(db, a.id, { githubRepoId: 42 });
    expect(() => seedRepo(db, b.id, { githubRepoId: 42 })).not.toThrow();
    expect(count(db, "repos")).toBe(2);
  });
});
