import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserRow } from "@/lib/db";
import { count, reset, seedNote, seedRepo, seedTodo, seedUser } from "@/test/support";

/* --------------------------- sahte bagimliliklar ------------------------- */

const auth = vi.hoisted(() => ({ user: null as UserRow | null }));

const gh = vi.hoisted(() => ({
  readme: null as string | null,
  todoFile: null as { path: string; content: string } | null,
  issues: [] as unknown[],
  createdIssue: null as unknown,
  repos: [] as unknown[],
  throws: null as Error | null,
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/session", () => ({
  requireUser: async () => auth.user,
  getCurrentUser: async () => auth.user,
}));

/** Ceviri yerine anahtari donduruyoruz: dilden bagimsiz, kirilgan olmayan iddialar. */
vi.mock("@/lib/i18n/server", () => ({
  getT: async () => (key: string) => key,
  getLocale: async () => "en",
}));

vi.mock("@/lib/github", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/github")>();
  const raise = () => {
    if (gh.throws) throw gh.throws;
  };

  return {
    ...actual,
    fetchReadme: async () => {
      raise();
      return gh.readme;
    },
    fetchTodoFile: async () => {
      raise();
      return gh.todoFile;
    },
    fetchIssues: async () => {
      raise();
      return gh.issues;
    },
    fetchAllRepos: async () => {
      raise();
      return gh.repos;
    },
    createIssue: async () => {
      raise();
      return gh.createdIssue;
    },
  };
});

const { db } = await import("@/lib/db");
const actions = await import("@/lib/actions");
const { GithubError } = await import("@/lib/github");

/* --------------------------------- yardim -------------------------------- */

function selectable(githubRepoId: number, name = `repo-${githubRepoId}`) {
  return {
    github_repo_id: githubRepoId,
    full_name: `tester/${name}`,
    name,
    owner: "tester",
    description: null,
    is_private: false,
    html_url: `https://github.com/tester/${name}`,
    default_branch: "main",
    language: null,
    stars: 0,
    pushed_at: null,
  };
}

const repoRow = (githubRepoId: number) =>
  db
    .prepare(`SELECT * FROM repos WHERE github_repo_id = ?`)
    .get(githubRepoId) as { id: number; is_archived: number } | undefined;

let owner: UserRow;
let other: UserRow;

beforeEach(() => {
  reset(db);
  owner = seedUser(db, { login: "owner", githubId: 1 }) as UserRow;
  other = seedUser(db, { login: "other", githubId: 2 }) as UserRow;
  auth.user = owner;

  gh.readme = null;
  gh.todoFile = null;
  gh.issues = [];
  gh.createdIssue = null;
  gh.repos = [];
  gh.throws = null;
});

/* ------------------------------ depo seçimi ------------------------------ */

describe("saveSelectedRepos", () => {
  it("seçilen depoları ekler", async () => {
    await actions.saveSelectedRepos([selectable(10), selectable(11)]);
    expect(count(db, "repos", `user_id = ${owner.id}`)).toBe(2);
  });

  it("tekrar kaydetmede üzerine yazar, kopya oluşturmaz", async () => {
    await actions.saveSelectedRepos([selectable(10, "eski")]);
    await actions.saveSelectedRepos([selectable(10, "yeni")]);

    expect(count(db, "repos")).toBe(1);
    const row = db.prepare(`SELECT name FROM repos`).get() as { name: string };
    expect(row.name).toBe("yeni");
  });

  it("verisi olan depoyu SİLMEZ, arşivler", async () => {
    await actions.saveSelectedRepos([selectable(10)]);
    const repo = repoRow(10)!;
    seedNote(db, repo.id);
    seedTodo(db, repo.id);

    const result = await actions.saveSelectedRepos([]);

    expect(result).toEqual({ archived: 1, removed: 0 });
    expect(repoRow(10)?.is_archived).toBe(1);
    // Asil mesele: veri yerinde duruyor mu?
    expect(count(db, "notes")).toBe(1);
    expect(count(db, "todos")).toBe(1);
  });

  it("verisi olmayan depoyu tamamen kaldırır", async () => {
    await actions.saveSelectedRepos([selectable(10)]);

    const result = await actions.saveSelectedRepos([]);

    expect(result).toEqual({ archived: 0, removed: 1 });
    expect(repoRow(10)).toBeUndefined();
  });

  it("arşivdeki depo tekrar seçilince verisiyle geri gelir", async () => {
    await actions.saveSelectedRepos([selectable(10)]);
    const repo = repoRow(10)!;
    const noteId = seedNote(db, repo.id, "kalıcı not");

    await actions.saveSelectedRepos([]);
    expect(repoRow(10)?.is_archived).toBe(1);

    await actions.saveSelectedRepos([selectable(10)]);

    expect(repoRow(10)?.is_archived).toBe(0);
    expect(count(db, "notes", `id = ${noteId}`)).toBe(1);
  });

  it("başka kullanıcının depolarına dokunmaz", async () => {
    const foreign = seedRepo(db, other.id, { githubRepoId: 99 });
    seedNote(db, foreign.id);

    await actions.saveSelectedRepos([]);

    expect(count(db, "repos", `id = ${foreign.id}`)).toBe(1);
    expect(count(db, "notes")).toBe(1);
  });
});

describe("planRepoRemoval", () => {
  it("her depo için doğru eylemi hesaplar", async () => {
    await actions.saveSelectedRepos([selectable(10), selectable(11)]);
    seedNote(db, repoRow(10)!.id);

    const plan = await actions.planRepoRemoval([]);

    expect(plan).toHaveLength(2);
    expect(plan.find((item) => item.githubRepoId === 10)).toMatchObject({
      action: "archive",
      notes: 1,
      todos: 0,
    });
    expect(plan.find((item) => item.githubRepoId === 11)?.action).toBe("delete");
  });

  it("korunacak depoları plana almaz", async () => {
    await actions.saveSelectedRepos([selectable(10), selectable(11)]);
    const plan = await actions.planRepoRemoval([10, 11]);
    expect(plan).toEqual([]);
  });

  it("zaten arşivde olanları tekrar plana almaz", async () => {
    seedRepo(db, owner.id, { githubRepoId: 20, archived: true });
    const plan = await actions.planRepoRemoval([]);
    expect(plan).toEqual([]);
  });
});

describe("arşiv işlemleri", () => {
  it("geri getirince depo panoya döner", async () => {
    const repo = seedRepo(db, owner.id, { githubRepoId: 20, archived: true });
    await actions.restoreArchivedRepo(repo.id);

    expect(repoRow(20)?.is_archived).toBe(0);
  });

  it("kalıcı silme veriyi de götürür", async () => {
    const repo = seedRepo(db, owner.id, { githubRepoId: 20, archived: true });
    seedNote(db, repo.id);
    seedTodo(db, repo.id);

    await actions.deleteArchivedRepo(repo.id);

    expect(repoRow(20)).toBeUndefined();
    expect(count(db, "notes")).toBe(0);
    expect(count(db, "todos")).toBe(0);
  });

  it("arşivde olmayan depoyu kalıcı silmez", async () => {
    const repo = seedRepo(db, owner.id, { githubRepoId: 20 });
    await actions.deleteArchivedRepo(repo.id);

    expect(count(db, "repos", `id = ${repo.id}`)).toBe(1);
  });

  it("başkasının arşivini silemez", async () => {
    const foreign = seedRepo(db, other.id, { githubRepoId: 99, archived: true });
    await actions.deleteArchivedRepo(foreign.id);

    expect(count(db, "repos", `id = ${foreign.id}`)).toBe(1);
  });
});

/* --------------------------------- notlar -------------------------------- */

describe("notlar", () => {
  it("başlıksız notu adlandırır", async () => {
    const repo = seedRepo(db, owner.id);
    await actions.createNote(repo.id, "   ", "içerik");

    const row = db.prepare(`SELECT title FROM notes`).get() as { title: string };
    expect(row.title).toBe("notes.untitled");
  });

  it("sabitleme durumunu değiştirir", async () => {
    const repo = seedRepo(db, owner.id);
    const noteId = seedNote(db, repo.id);

    await actions.toggleNotePin(noteId);
    expect(count(db, "notes", `id = ${noteId} AND pinned = 1`)).toBe(1);

    await actions.toggleNotePin(noteId);
    expect(count(db, "notes", `id = ${noteId} AND pinned = 0`)).toBe(1);
  });

  it("başkasının notunu güncelleyemez", async () => {
    const foreign = seedRepo(db, other.id, { githubRepoId: 99 });
    const noteId = seedNote(db, foreign.id, "dokunma");

    await actions.updateNote(noteId, "ele geçirildi", "");

    const row = db.prepare(`SELECT title FROM notes WHERE id = ?`).get(noteId) as {
      title: string;
    };
    expect(row.title).toBe("dokunma");
  });

  it("başkasının notunu silemez", async () => {
    const foreign = seedRepo(db, other.id, { githubRepoId: 99 });
    const noteId = seedNote(db, foreign.id);

    await actions.deleteNote(noteId);
    expect(count(db, "notes", `id = ${noteId}`)).toBe(1);
  });

  it("kendi deposu olmayan projeye not ekleyemez", async () => {
    const foreign = seedRepo(db, other.id, { githubRepoId: 99 });
    await expect(actions.createNote(foreign.id, "başlık", "")).rejects.toThrow();
  });
});

/* -------------------------------- görevler ------------------------------- */

describe("görevler", () => {
  it("boş başlıklı görev eklemez", async () => {
    const repo = seedRepo(db, owner.id);
    await actions.createTodo(repo.id, "   ");
    expect(count(db, "todos")).toBe(0);
  });

  it("tamamlandı işaretlerken zaman damgası yazar, geri alınca siler", async () => {
    const repo = seedRepo(db, owner.id);
    const todoId = seedTodo(db, repo.id);

    await actions.toggleTodo(todoId);
    let row = db
      .prepare(`SELECT done, completed_at FROM todos WHERE id = ?`)
      .get(todoId) as { done: number; completed_at: string | null };
    expect(row.done).toBe(1);
    expect(row.completed_at).toMatch(/Z$/);

    await actions.toggleTodo(todoId);
    row = db.prepare(`SELECT done, completed_at FROM todos WHERE id = ?`).get(todoId) as {
      done: number;
      completed_at: string | null;
    };
    expect(row.done).toBe(0);
    expect(row.completed_at).toBeNull();
  });

  it("toplu tamamlama yalnızca kendi görevlerini etkiler", async () => {
    const mine = seedRepo(db, owner.id, { githubRepoId: 10 });
    const foreign = seedRepo(db, other.id, { githubRepoId: 99 });
    const a = seedTodo(db, mine.id);
    const b = seedTodo(db, foreign.id);

    const result = await actions.bulkSetTodoDone([a, b], true);

    expect(result.changed).toBe(1);
    expect(count(db, "todos", `id = ${a} AND done = 1`)).toBe(1);
    expect(count(db, "todos", `id = ${b} AND done = 0`)).toBe(1);
  });

  it("toplu silme yalnızca kendi görevlerini siler", async () => {
    const mine = seedRepo(db, owner.id, { githubRepoId: 10 });
    const foreign = seedRepo(db, other.id, { githubRepoId: 99 });
    const a = seedTodo(db, mine.id);
    const b = seedTodo(db, foreign.id);

    const result = await actions.bulkDeleteTodos([a, b]);

    expect(result.changed).toBe(1);
    expect(count(db, "todos", `id = ${b}`)).toBe(1);
  });

  it("boş liste için hiçbir şey yapmaz", async () => {
    expect(await actions.bulkDeleteTodos([])).toEqual({ changed: 0 });
    expect(await actions.bulkSetTodoDone([], true)).toEqual({ changed: 0 });
  });

  it("tamamlananları temizler, açıkları bırakır", async () => {
    const repo = seedRepo(db, owner.id);
    seedTodo(db, repo.id, { done: true });
    seedTodo(db, repo.id, { done: false });

    await actions.clearCompletedTodos(repo.id);

    expect(count(db, "todos")).toBe(1);
    expect(count(db, "todos", "done = 0")).toBe(1);
  });
});

/* --------------------------- TODO.md içe aktarma -------------------------- */

describe("TODO.md aktarımı", () => {
  it("dosya yoksa hata döner", async () => {
    const repo = seedRepo(db, owner.id);
    const result = await actions.previewTodoImport(repo.id);

    expect(result.ok).toBe(false);
    expect(result.message).toBe("todoImport.notFound");
  });

  it("mevcut başlıkları kopya olarak işaretler", async () => {
    const repo = seedRepo(db, owner.id);
    seedTodo(db, repo.id, { title: "Zaten var" });
    gh.todoFile = { path: "TODO.md", content: "- [ ] Zaten var\n- [ ] Yeni madde" };

    const result = await actions.previewTodoImport(repo.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toHaveLength(2);
    expect(result.items.find((item) => item.title === "Zaten var")?.duplicate).toBe(true);
    expect(result.items.find((item) => item.title === "Yeni madde")?.duplicate).toBe(
      false,
    );
  });

  it("GitHub hatasını kullanıcıya taşır", async () => {
    const repo = seedRepo(db, owner.id);
    gh.throws = new GithubError(403, "rate", { rateLimited: true });

    const result = await actions.previewTodoImport(repo.id);

    expect(result.ok).toBe(false);
    expect(result.message).toBe("errors.rateLimited");
  });

  it("seçilenleri ekler ve geri alınabilir bir parti kimliği verir", async () => {
    const repo = seedRepo(db, owner.id);
    seedTodo(db, repo.id, { title: "elle yazılmış" });

    const result = await actions.importSelectedTodos(repo.id, [
      { title: "bir", done: false, priority: "normal" },
      { title: "iki", done: true, priority: "high" },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.added).toBe(2);
    expect(count(db, "todos")).toBe(3);
    expect(count(db, "todos", `import_batch = '${result.batch}'`)).toBe(2);
    // Tamamlanmis gelen madde zaman damgasi almali
    expect(count(db, "todos", "done = 1 AND completed_at IS NOT NULL")).toBe(1);
  });

  it("geri alma yalnızca o partiyi siler", async () => {
    const repo = seedRepo(db, owner.id);
    seedTodo(db, repo.id, { title: "elle yazılmış" });

    const first = await actions.importSelectedTodos(repo.id, [
      { title: "parti-1", done: false, priority: "normal" },
    ]);
    const second = await actions.importSelectedTodos(repo.id, [
      { title: "parti-2", done: false, priority: "normal" },
    ]);
    if (!first.ok || !second.ok) throw new Error("aktarım başarısız");

    const undone = await actions.undoTodoImport(repo.id, first.batch);

    expect(undone.removed).toBe(1);
    expect(count(db, "todos")).toBe(2);
    expect(count(db, "todos", "title = 'parti-2'")).toBe(1);
    expect(count(db, "todos", "title = 'elle yazılmış'")).toBe(1);
  });

  it("boş seçimde ekleme yapmaz", async () => {
    const repo = seedRepo(db, owner.id);
    const result = await actions.importSelectedTodos(repo.id, []);

    expect(result.ok).toBe(false);
    expect(count(db, "todos")).toBe(0);
  });
});

/* ---------------------------------- özet --------------------------------- */

describe("özet", () => {
  it("README'yi kaynak bilgisiyle birlikte yazar", async () => {
    const repo = seedRepo(db, owner.id);
    gh.readme = "# Başlık\n\nAçıklama";

    const result = await actions.importReadmeSummary(repo.id);

    expect(result.ok).toBe(true);
    const row = db
      .prepare(`SELECT summary, summary_source, summary_updated_at FROM repos WHERE id = ?`)
      .get(repo.id) as {
      summary: string;
      summary_source: string;
      summary_updated_at: string;
    };
    expect(row.summary).toContain("Açıklama");
    expect(row.summary_source).toBe("README.md");
    expect(row.summary_updated_at).toMatch(/Z$/);
  });

  it("README yoksa yazmaz", async () => {
    const repo = seedRepo(db, owner.id);
    gh.readme = null;

    const result = await actions.importReadmeSummary(repo.id);

    expect(result.ok).toBe(false);
    expect(result.message).toBe("errors.readmeNotFound");
  });

  it("boş özet kaydı alanı temizler", async () => {
    const repo = seedRepo(db, owner.id);
    await actions.updateSummary(repo.id, "bir şeyler");
    await actions.updateSummary(repo.id, "   ");

    const row = db
      .prepare(`SELECT summary, summary_source FROM repos WHERE id = ?`)
      .get(repo.id) as { summary: string | null; summary_source: string | null };

    expect(row.summary).toBeNull();
    expect(row.summary_source).toBeNull();
  });
});

/* ------------------------------ issue açma -------------------------------- */

describe("görevden issue açma", () => {
  const issue = {
    number: 7,
    html_url: "https://github.com/tester/repo/issues/7",
    state: "open",
    title: "başlık",
    comments: 0,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    user: { login: "owner", avatar_url: "" },
    labels: [],
  };

  it("issue numarasını göreve bağlar ve önbelleğe yazar", async () => {
    const repo = seedRepo(db, owner.id);
    const todoId = seedTodo(db, repo.id, { title: "iş" });
    gh.createdIssue = issue;

    const result = await actions.createIssueFromTodo(todoId, "iş", "gövde");

    expect(result.ok).toBe(true);
    const row = db
      .prepare(`SELECT issue_number, issue_url FROM todos WHERE id = ?`)
      .get(todoId) as { issue_number: number; issue_url: string };
    expect(row.issue_number).toBe(7);
    expect(row.issue_url).toContain("/issues/7");
    expect(count(db, "issues", "number = 7")).toBe(1);
  });

  it("aynı görev için ikinci kez açmaz", async () => {
    const repo = seedRepo(db, owner.id);
    const todoId = seedTodo(db, repo.id);
    gh.createdIssue = issue;

    await actions.createIssueFromTodo(todoId, "iş", "");
    const second = await actions.createIssueFromTodo(todoId, "iş", "");

    expect(second.ok).toBe(false);
    expect(second.message).toBe("issueDialog.alreadyCreated");
  });

  it("boş başlıkla açmaz", async () => {
    const repo = seedRepo(db, owner.id);
    const todoId = seedTodo(db, repo.id);

    const result = await actions.createIssueFromTodo(todoId, "   ", "");

    expect(result.ok).toBe(false);
    expect(result.message).toBe("issueDialog.emptyTitle");
  });

  it("başkasının görevinden issue açmaz", async () => {
    const foreign = seedRepo(db, other.id, { githubRepoId: 99 });
    const todoId = seedTodo(db, foreign.id);

    const result = await actions.createIssueFromTodo(todoId, "iş", "");

    expect(result.ok).toBe(false);
    expect(result.message).toBe("issueDialog.notFound");
  });

  it("yetki hatasını doğru mesaja çevirir", async () => {
    const repo = seedRepo(db, owner.id);
    const todoId = seedTodo(db, repo.id);
    gh.throws = new GithubError(403, "forbidden");

    const result = await actions.createIssueFromTodo(todoId, "iş", "");

    expect(result.ok).toBe(false);
    expect(result.message).toBe("issueDialog.noPermission");
  });

  it("kota hatasını yetki hatasıyla karıştırmaz", async () => {
    const repo = seedRepo(db, owner.id);
    const todoId = seedTodo(db, repo.id);
    gh.throws = new GithubError(403, "rate", { rateLimited: true });

    const result = await actions.createIssueFromTodo(todoId, "iş", "");

    expect(result.ok).toBe(false);
    expect(result.message).toBe("errors.rateLimited");
  });
});
