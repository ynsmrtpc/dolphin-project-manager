import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RepoRow } from "@/lib/db";
import { count, reset, seedRepo, seedUser } from "@/test/support";

const gh = vi.hoisted(() => ({ open: [] as unknown[], closed: [] as unknown[] }));

vi.mock("@/lib/github", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/github")>();
  return {
    ...actual,
    fetchIssues: async (_token: string, _full: string, state: "open" | "closed") =>
      state === "open" ? gh.open : gh.closed,
  };
});

const { db } = await import("@/lib/db");
const { cacheIssue, isStale, readIssues, syncIssues } = await import("@/lib/issues");

function githubIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    number: 1,
    title: "issue",
    html_url: "https://github.com/tester/repo/issues/1",
    state: "open",
    comments: 0,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    user: { login: "tester", avatar_url: "" },
    labels: [],
    assignees: [],
    ...overrides,
  };
}

const repoRow = (id: number) =>
  db.prepare(`SELECT * FROM repos WHERE id = ?`).get(id) as RepoRow;

let repoId: number;

beforeEach(() => {
  reset(db);
  const user = seedUser(db);
  repoId = seedRepo(db, user.id).id;
  gh.open = [];
  gh.closed = [];
});

describe("isStale", () => {
  const base = { issues_synced_at: null } as RepoRow;

  it("hiç senkron yapılmadıysa bayat sayar", () => {
    expect(isStale(base)).toBe(true);
  });

  it("taze önbelleği bayat saymaz", () => {
    expect(isStale({ ...base, issues_synced_at: new Date().toISOString() })).toBe(false);
  });

  it("TTL dolduysa bayat sayar", () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    expect(isStale({ ...base, issues_synced_at: old })).toBe(true);
  });

  it("bozuk damgayı bayat sayar", () => {
    expect(isStale({ ...base, issues_synced_at: "tarih değil" })).toBe(true);
  });
});

describe("syncIssues", () => {
  it("açık ve kapalı kayıtları yazıp damga atar", async () => {
    gh.open = [githubIssue({ number: 1 })];
    gh.closed = [githubIssue({ number: 2, state: "closed" })];

    const written = await syncIssues("token", repoRow(repoId));

    expect(written).toBe(2);
    expect(count(db, "issues")).toBe(2);
    expect(repoRow(repoId).issues_synced_at).toMatch(/Z$/);
  });

  it("PR'ı issue'dan ayırır ve birleşmiş olanı işaretler", async () => {
    gh.open = [
      githubIssue({ number: 1 }),
      githubIssue({
        number: 2,
        draft: true,
        pull_request: { html_url: "", merged_at: null },
      }),
    ];
    gh.closed = [
      githubIssue({
        number: 3,
        state: "closed",
        pull_request: { html_url: "", merged_at: "2026-09-01T11:00:00Z" },
      }),
    ];

    await syncIssues("token", repoRow(repoId));

    expect(count(db, "issues", "is_pull = 0")).toBe(1);
    expect(count(db, "issues", "is_pull = 1 AND is_draft = 1")).toBe(1);
    expect(count(db, "issues", "is_merged = 1")).toBe(1);
  });

  it("önbelleği değiştirir, üst üste biriktirmez", async () => {
    gh.open = [githubIssue({ number: 1 }), githubIssue({ number: 2 })];
    await syncIssues("token", repoRow(repoId));
    expect(count(db, "issues")).toBe(2);

    gh.open = [githubIssue({ number: 3 })];
    await syncIssues("token", repoRow(repoId));

    expect(count(db, "issues")).toBe(1);
    expect(count(db, "issues", "number = 3")).toBe(1);
  });

  it("etiketleri saklar", async () => {
    gh.open = [
      githubIssue({
        labels: [
          { id: 1, name: "bug", color: "d73a4a" },
          { id: 2, name: "ui", color: "0e8a16" },
        ],
      }),
    ];

    await syncIssues("token", repoRow(repoId));
    const [item] = readIssues(repoId, "open");

    expect(item.labels).toEqual([
      { name: "bug", color: "d73a4a" },
      { name: "ui", color: "0e8a16" },
    ]);
  });
});

describe("readIssues", () => {
  it("duruma göre filtreler", async () => {
    gh.open = [githubIssue({ number: 1 })];
    gh.closed = [githubIssue({ number: 2, state: "closed" })];
    await syncIssues("token", repoRow(repoId));

    expect(readIssues(repoId, "open").map((item) => item.number)).toEqual([1]);
    expect(readIssues(repoId, "closed").map((item) => item.number)).toEqual([2]);
  });

  it("bozuk etiket verisinde çökmez", () => {
    db.prepare(
      `INSERT INTO issues (repo_id, number, title, state, html_url, labels)
       VALUES (?, 9, 'bozuk', 'open', 'https://example.com', 'bu json değil')`,
    ).run(repoId);

    const [item] = readIssues(repoId, "open");
    expect(item.labels).toEqual([]);
  });

  it("başka deponun kayıtlarını getirmez", async () => {
    const user = seedUser(db, { login: "diger", githubId: 77 });
    const otherRepo = seedRepo(db, user.id, { githubRepoId: 77 });

    gh.open = [githubIssue({ number: 1 })];
    await syncIssues("token", repoRow(repoId));

    expect(readIssues(otherRepo.id, "open")).toEqual([]);
  });
});

describe("cacheIssue", () => {
  it("yeni açılan issue'yu ekler", () => {
    cacheIssue(repoId, githubIssue({ number: 5 }) as never);
    expect(count(db, "issues", "number = 5")).toBe(1);
  });

  it("aynı numarayı iki kez eklemez, günceller", () => {
    cacheIssue(repoId, githubIssue({ number: 5, title: "ilk" }) as never);
    cacheIssue(repoId, githubIssue({ number: 5, title: "güncel" }) as never);

    expect(count(db, "issues", "number = 5")).toBe(1);
    const row = db.prepare(`SELECT title FROM issues WHERE number = 5`).get() as {
      title: string;
    };
    expect(row.title).toBe("güncel");
  });
});
