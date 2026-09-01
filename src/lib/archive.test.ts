import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { count, reset, seedNote, seedRepo, seedTodo, seedUser } from "@/test/support";

const { db } = await import("@/lib/db");
const { env } = await import("@/lib/env");
const { daysUntilPurge, purgeExpiredArchives, retentionEnabled } = await import(
  "@/lib/archive"
);

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();

let userId: number;
const original = env.archiveRetentionDays;

beforeEach(() => {
  reset(db);
  userId = seedUser(db).id;
  env.archiveRetentionDays = 30;
});

afterEach(() => {
  env.archiveRetentionDays = original;
  vi.useRealTimers();
});

function archive(repoId: number, archivedAt: string) {
  db.prepare(
    `UPDATE repos SET is_archived = 1, archived_at = ? WHERE id = ?`,
  ).run(archivedAt, repoId);
}

describe("retentionEnabled", () => {
  it("0 yazılırsa otomatik silme kapanır", () => {
    env.archiveRetentionDays = 0;
    expect(retentionEnabled()).toBe(false);
  });

  it("pozitif değerde açıktır", () => {
    expect(retentionEnabled()).toBe(true);
  });
});

describe("daysUntilPurge", () => {
  it("kalan günü yukarı yuvarlar", () => {
    expect(daysUntilPurge(daysAgo(0))).toBe(30);
    expect(daysUntilPurge(daysAgo(29.5))).toBe(1);
  });

  it("süresi geçmişte kalanlarda sıfır döner, negatife düşmez", () => {
    expect(daysUntilPurge(daysAgo(60))).toBe(0);
  });

  it("saklama kapalıysa veya damga yoksa null döner", () => {
    expect(daysUntilPurge(null)).toBeNull();

    env.archiveRetentionDays = 0;
    expect(daysUntilPurge(daysAgo(1))).toBeNull();
  });

  it("bozuk damgada null döner", () => {
    expect(daysUntilPurge("tarih değil")).toBeNull();
  });
});

describe("purgeExpiredArchives", () => {
  it("süresi dolan arşiv kaydını notları ve görevleriyle siler", () => {
    const repo = seedRepo(db, userId, { githubRepoId: 10 });
    seedNote(db, repo.id);
    seedTodo(db, repo.id);
    archive(repo.id, daysAgo(31));

    const removed = purgeExpiredArchives(userId);

    expect(removed).toBe(1);
    expect(count(db, "repos")).toBe(0);
    expect(count(db, "notes")).toBe(0);
    expect(count(db, "todos")).toBe(0);
  });

  it("süresi dolmayana dokunmaz", () => {
    const repo = seedRepo(db, userId, { githubRepoId: 10 });
    archive(repo.id, daysAgo(29));

    expect(purgeExpiredArchives(userId)).toBe(0);
    expect(count(db, "repos")).toBe(1);
  });

  it("arşivde olmayan depoyu asla silmez", () => {
    const repo = seedRepo(db, userId, { githubRepoId: 10 });
    // Arsiv damgasi eski ama depo arsivde degil (geri getirilmis olabilir).
    db.prepare(`UPDATE repos SET archived_at = ? WHERE id = ?`).run(daysAgo(90), repo.id);

    expect(purgeExpiredArchives(userId)).toBe(0);
    expect(count(db, "repos")).toBe(1);
  });

  it("saklama kapalıyken hiçbir şey silmez", () => {
    const repo = seedRepo(db, userId, { githubRepoId: 10 });
    archive(repo.id, daysAgo(365));
    env.archiveRetentionDays = 0;

    expect(purgeExpiredArchives(userId)).toBe(0);
    expect(count(db, "repos")).toBe(1);
  });

  it("başka kullanıcının arşivine dokunmaz", () => {
    const other = seedUser(db, { login: "diger", githubId: 2 });
    const foreign = seedRepo(db, other.id, { githubRepoId: 99 });
    archive(foreign.id, daysAgo(90));

    expect(purgeExpiredArchives(userId)).toBe(0);
    expect(count(db, "repos", `id = ${foreign.id}`)).toBe(1);
  });

  it("damgası olmayan arşiv kaydını silmez", () => {
    const repo = seedRepo(db, userId, { githubRepoId: 10 });
    db.prepare(`UPDATE repos SET is_archived = 1, archived_at = NULL WHERE id = ?`).run(
      repo.id,
    );

    expect(purgeExpiredArchives(userId)).toBe(0);
    expect(count(db, "repos")).toBe(1);
  });
});
