import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserRow } from "@/lib/db";
import { count, reset, seedRepo, seedUser } from "@/test/support";

const gh = vi.hoisted(() => ({ repos: [] as unknown[] }));

vi.mock("@/lib/github", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/github")>();
  return { ...actual, fetchAllRepos: async () => gh.repos };
});

const { db } = await import("@/lib/db");
const { isRepoMetaStale, repoMetaSyncedAt, syncRepoMeta } = await import("@/lib/repos");

function remoteRepo(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `repo-${id}`,
    full_name: `tester/repo-${id}`,
    owner: { login: "tester", avatar_url: "" },
    description: "güncel açıklama",
    private: false,
    html_url: `https://github.com/tester/repo-${id}`,
    default_branch: "main",
    language: "TypeScript",
    stargazers_count: 12,
    pushed_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

const missingSince = (repoId: number) =>
  (
    db.prepare(`SELECT missing_since FROM repos WHERE id = ?`).get(repoId) as {
      missing_since: string | null;
    }
  ).missing_since;

let user: UserRow;

beforeEach(() => {
  reset(db);
  user = seedUser(db) as UserRow;
  gh.repos = [];
});

describe("isRepoMetaStale", () => {
  it("hiç senkron yapılmadıysa bayat sayar", () => {
    expect(isRepoMetaStale(null)).toBe(true);
  });

  it("taze damgayı bayat saymaz", () => {
    expect(isRepoMetaStale(new Date().toISOString())).toBe(false);
  });

  it("TTL dolduysa bayat sayar", () => {
    expect(isRepoMetaStale(new Date(Date.now() - 48 * 3600 * 1000).toISOString())).toBe(
      true,
    );
  });
});

describe("syncRepoMeta", () => {
  it("kayıtlı deponun bilgilerini günceller", async () => {
    const repo = seedRepo(db, user.id, { githubRepoId: 10, name: "eski-ad" });
    gh.repos = [remoteRepo(10, { name: "yeni-ad" })];

    const { updated } = await syncRepoMeta(user);

    expect(updated).toBe(1);
    const row = db
      .prepare(
        `SELECT name, description, stars, language, pushed_at FROM repos WHERE id = ?`,
      )
      .get(repo.id) as {
      name: string;
      description: string;
      stars: number;
      language: string;
      pushed_at: string;
    };

    expect(row.name).toBe("yeni-ad");
    expect(row.description).toBe("güncel açıklama");
    expect(row.stars).toBe(12);
    expect(row.language).toBe("TypeScript");
    expect(row.pushed_at).toBe("2026-09-01T10:00:00Z");
  });

  it("senkron damgasını kullanıcıya yazar", async () => {
    seedRepo(db, user.id, { githubRepoId: 10 });
    gh.repos = [remoteRepo(10)];

    expect(repoMetaSyncedAt(user.id)).toBeNull();
    await syncRepoMeta(user);
    expect(repoMetaSyncedAt(user.id)).toMatch(/Z$/);
  });

  it("seçilmemiş depoları eklemez", async () => {
    seedRepo(db, user.id, { githubRepoId: 10 });
    gh.repos = [remoteRepo(10), remoteRepo(11), remoteRepo(12)];

    const { updated } = await syncRepoMeta(user);

    expect(updated).toBe(1);
    expect(count(db, "repos")).toBe(1);
  });

  it("başka kullanıcının aynı deposuna dokunmaz", async () => {
    const other = seedUser(db, { login: "diger", githubId: 2 }) as UserRow;
    const foreign = seedRepo(db, other.id, { githubRepoId: 10, name: "dokunma" });
    seedRepo(db, user.id, { githubRepoId: 10, name: "benim" });

    gh.repos = [remoteRepo(10, { name: "yeni-ad" })];
    await syncRepoMeta(user);

    const row = db.prepare(`SELECT name FROM repos WHERE id = ?`).get(foreign.id) as {
      name: string;
    };
    expect(row.name).toBe("dokunma");
  });

  it("arşivdeki deponun bilgisini de tazeler", async () => {
    const repo = seedRepo(db, user.id, { githubRepoId: 10, archived: true });
    gh.repos = [remoteRepo(10, { name: "yeni-ad" })];

    await syncRepoMeta(user);

    const row = db
      .prepare(`SELECT name, is_archived FROM repos WHERE id = ?`)
      .get(repo.id) as { name: string; is_archived: number };

    expect(row.name).toBe("yeni-ad");
    // Tazeleme arsiv durumunu bozmamali.
    expect(row.is_archived).toBe(1);
  });
});

describe("GitHub'da bulunamayan depolar", () => {
  it("uzak listede olmayanı kayıp işaretler, silmez", async () => {
    const gone = seedRepo(db, user.id, { githubRepoId: 10 });
    seedRepo(db, user.id, { githubRepoId: 11 });
    // 10 numarali depo GitHub'dan silinmis; uzak liste yalnizca 11'i doner.
    gh.repos = [remoteRepo(11)];

    const result = await syncRepoMeta(user);

    expect(result.missing).toBe(1);
    // Asil mesele: kayit ve verisi duruyor mu?
    expect(count(db, "repos")).toBe(2);
    expect(missingSince(gone.id)).toMatch(/Z$/);
  });

  it("ilk fark edilme anını sonraki senkronlarda değiştirmez", async () => {
    const gone = seedRepo(db, user.id, { githubRepoId: 10 });
    seedRepo(db, user.id, { githubRepoId: 11 });
    gh.repos = [remoteRepo(11)];

    await syncRepoMeta(user);
    const first = missingSince(gone.id);

    const second = await syncRepoMeta(user);

    expect(second.missing).toBe(0);
    expect(missingSince(gone.id)).toBe(first);
  });

  it("depo geri gelirse işareti kaldırır", async () => {
    const gone = seedRepo(db, user.id, { githubRepoId: 10 });
    seedRepo(db, user.id, { githubRepoId: 11 });

    gh.repos = [remoteRepo(11)];
    await syncRepoMeta(user);
    expect(missingSince(gone.id)).not.toBeNull();

    gh.repos = [remoteRepo(10), remoteRepo(11)];
    await syncRepoMeta(user);

    expect(missingSince(gone.id)).toBeNull();
  });

  /** Gecici bir API hatasi tum depolari "silinmis" gostermemeli. */
  it("uzak liste boş dönerse hiçbir şeyi işaretlemez", async () => {
    seedRepo(db, user.id, { githubRepoId: 10 });
    gh.repos = [];

    const result = await syncRepoMeta(user);

    expect(result.missing).toBe(0);
    expect(count(db, "repos", "missing_since IS NOT NULL")).toBe(0);
  });

  it("başka kullanıcının deposunu işaretlemez", async () => {
    const other = seedUser(db, { login: "diger", githubId: 2 }) as UserRow;
    const foreign = seedRepo(db, other.id, { githubRepoId: 50 });
    seedRepo(db, user.id, { githubRepoId: 10 });
    gh.repos = [remoteRepo(10)];

    await syncRepoMeta(user);

    expect(missingSince(foreign.id)).toBeNull();
  });

  it("arşivdeki depoyu da işaretler", async () => {
    const archived = seedRepo(db, user.id, { githubRepoId: 10, archived: true });
    seedRepo(db, user.id, { githubRepoId: 11 });
    gh.repos = [remoteRepo(11)];

    await syncRepoMeta(user);

    expect(missingSince(archived.id)).not.toBeNull();
  });
});
