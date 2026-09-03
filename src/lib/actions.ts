"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { db, type RepoRow } from "@/lib/db";
import { nowIso } from "@/lib/time";
import {
  GithubError,
  createIssue,
  fetchReadme,
  fetchTodoFile,
  githubErrorMessage,
} from "@/lib/github";
import { getT } from "@/lib/i18n/server";
import { cacheIssue, syncIssues } from "@/lib/issues";
import { syncRepoMeta } from "@/lib/repos";
import { parseTodoMarkdown } from "@/lib/todo-markdown";
import { requireUser } from "@/lib/session";

export type SelectableRepo = {
  github_repo_id: number;
  full_name: string;
  name: string;
  owner: string;
  description: string | null;
  is_private: boolean;
  html_url: string;
  default_branch: string;
  language: string | null;
  stars: number;
  pushed_at: string | null;
};

export type RemovalPlan = {
  repoId: number;
  githubRepoId: number;
  fullName: string;
  notes: number;
  todos: number;
  /** Verisi olan depo arsivlenir, bos olan tamamen kaldirilir. */
  action: "archive" | "delete";
};

/**
 * Seciminden cikardigin depolarin verisine ne olacagini onceden hesaplar.
 * Kaydetmeden once kullaniciya gosterilir.
 */
export async function planRepoRemoval(keepGithubIds: number[]) {
  const user = await requireUser();

  const rows = db
    .prepare(
      `SELECT r.id, r.github_repo_id, r.full_name,
              (SELECT COUNT(*) FROM notes n WHERE n.repo_id = r.id) AS notes,
              (SELECT COUNT(*) FROM todos t WHERE t.repo_id = r.id) AS todos
         FROM repos r
        WHERE r.user_id = ? AND r.is_archived = 0 AND r.missing_since IS NULL`,
    )
    .all(user.id) as {
    id: number;
    github_repo_id: number;
    full_name: string;
    notes: number;
    todos: number;
  }[];

  const keep = new Set(keepGithubIds);

  return rows
    .filter((row) => !keep.has(row.github_repo_id))
    .map<RemovalPlan>((row) => ({
      repoId: row.id,
      githubRepoId: row.github_repo_id,
      fullName: row.full_name,
      notes: row.notes,
      todos: row.todos,
      action: row.notes + row.todos > 0 ? "archive" : "delete",
    }));
}

/**
 * Anasayfada gorunecek depolari gunceller.
 *
 * Secimden cikan depo SILINMEZ: notu veya gorevi varsa arsivlenir ve tekrar
 * secildiginde verisiyle birlikte geri gelir. Hic verisi yoksa satir kaldirilir.
 */
export async function saveSelectedRepos(selected: SelectableRepo[]) {
  const user = await requireUser();
  const keepIds = selected.map((repo) => repo.github_repo_id);
  const plan = await planRepoRemoval(keepIds);

  const upsert = db.prepare(
    `INSERT INTO repos (user_id, github_repo_id, full_name, name, owner, description,
                        is_private, html_url, default_branch, language, stars, pushed_at,
                        is_archived, archived_at)
     VALUES (@user_id, @github_repo_id, @full_name, @name, @owner, @description,
             @is_private, @html_url, @default_branch, @language, @stars, @pushed_at,
             0, NULL)
     ON CONFLICT(user_id, github_repo_id) DO UPDATE SET
       full_name      = excluded.full_name,
       name           = excluded.name,
       owner          = excluded.owner,
       description    = excluded.description,
       is_private     = excluded.is_private,
       html_url       = excluded.html_url,
       default_branch = excluded.default_branch,
       language       = excluded.language,
       stars          = excluded.stars,
       pushed_at      = excluded.pushed_at,
       is_archived    = 0,
       archived_at    = NULL`,
  );

  const archive = db.prepare(
    `UPDATE repos SET is_archived = 1, archived_at = ? WHERE id = ?`,
  );
  const remove = db.prepare(`DELETE FROM repos WHERE id = ?`);

  db.transaction(() => {
    for (const item of plan) {
      if (item.action === "archive") archive.run(nowIso(), item.repoId);
      else remove.run(item.repoId);
    }

    for (const repo of selected) {
      upsert.run({
        user_id: user.id,
        github_repo_id: repo.github_repo_id,
        full_name: repo.full_name,
        name: repo.name,
        owner: repo.owner,
        description: repo.description,
        is_private: repo.is_private ? 1 : 0,
        html_url: repo.html_url,
        default_branch: repo.default_branch,
        language: repo.language,
        stars: repo.stars,
        pushed_at: repo.pushed_at,
      });
    }
  })();

  revalidatePath("/");
  revalidatePath("/repos");

  const archived = plan.filter((item) => item.action === "archive").length;
  return { archived, removed: plan.length - archived };
}

/** Arsivdeki depoyu panoya geri alir; notlari ve gorevleri yerinde durur. */
export async function restoreArchivedRepo(repoId: number) {
  const user = await requireUser();

  db.prepare(
    `UPDATE repos SET is_archived = 0, archived_at = NULL
      WHERE id = ? AND user_id = ?`,
  ).run(repoId, user.id);

  revalidatePath("/");
  revalidatePath("/repos");
}

/** Depoyu panodan cikarir ama verisini saklar. Geri alinabilir. */
export async function archiveRepo(repoId: number) {
  const user = await requireUser();
  const t = await getT();

  const repo = db
    .prepare(`SELECT full_name FROM repos WHERE id = ? AND user_id = ?`)
    .get(repoId, user.id) as { full_name: string } | undefined;

  if (!repo) return { ok: false as const, message: t("errors.repoNotFound") };

  db.prepare(
    `UPDATE repos SET is_archived = 1, archived_at = ? WHERE id = ? AND user_id = ?`,
  ).run(nowIso(), repoId, user.id);

  revalidatePath("/");
  revalidatePath("/repos");

  return { ok: true as const, message: t("archive.archived", { repo: repo.full_name }) };
}

/**
 * Depoyu notlari ve gorevleriyle birlikte kalici olarak siler.
 *
 * Geri alinamaz oldugu icin cagiranin deponun tam adini yazmasi gerekiyor;
 * bu kontrol sunucuda yapiliyor, yanlis baglanmis bir arayuz silemesin diye.
 */
export async function deleteRepo(repoId: number, confirmation: string) {
  const user = await requireUser();
  const t = await getT();

  const repo = db
    .prepare(`SELECT full_name FROM repos WHERE id = ? AND user_id = ?`)
    .get(repoId, user.id) as { full_name: string } | undefined;

  if (!repo) return { ok: false as const, message: t("errors.repoNotFound") };

  if (confirmation.trim() !== repo.full_name) {
    return { ok: false as const, message: t("deleteRepo.mismatch") };
  }

  db.prepare(`DELETE FROM repos WHERE id = ? AND user_id = ?`).run(repoId, user.id);

  revalidatePath("/");
  revalidatePath("/repos");

  return { ok: true as const, message: t("deleteRepo.deleted", { repo: repo.full_name }) };
}

/** Depo bu kullaniciya ait degilse islem yapilmaz. */
async function ownedRepo(repoId: number): Promise<RepoRow> {
  const user = await requireUser();
  const repo = db
    .prepare(`SELECT * FROM repos WHERE id = ? AND user_id = ?`)
    .get(repoId, user.id) as RepoRow | undefined;

  if (!repo) {
    const t = await getT();
    throw new Error(t("errors.repoNotFound"));
  }
  return repo;
}

/** Panodaki depo bilgilerini (yildiz, aciklama, son push) GitHub'dan tazeler. */
export async function refreshRepoMeta() {
  const user = await requireUser();
  const t = await getT();

  try {
    const { updated } = await syncRepoMeta(user);
    revalidatePath("/");
    return { ok: true as const, message: t("errors.repoSynced", { count: updated }) };
  } catch (error) {
    return {
      ok: false as const,
      message: githubErrorMessage(t, error, t("errors.repoSyncError")),
    };
  }
}

/* -------------------------------- Özet --------------------------------- */

export async function updateSummary(repoId: number, summary: string) {
  const repo = await ownedRepo(repoId);
  const value = summary.trim();

  db.prepare(
    `UPDATE repos
        SET summary = ?, summary_source = ?, summary_updated_at = ?
      WHERE id = ?`,
  ).run(value || null, value ? "manual" : null, nowIso(), repo.id);

  revalidatePath(`/projects/${repo.id}`);
}

/** Deponun README dosyasini ozet alanina aktarir. */
export async function importReadmeSummary(repoId: number) {
  const user = await requireUser();
  const repo = await ownedRepo(repoId);
  const t = await getT();

  const readme = await fetchReadme(user.access_token, repo.full_name);
  if (readme === null || !readme.trim()) {
    return { ok: false as const, message: t("errors.readmeNotFound") };
  }

  db.prepare(
    `UPDATE repos
        SET summary = ?, summary_source = 'README.md', summary_updated_at = ?
      WHERE id = ?`,
  ).run(readme, nowIso(), repo.id);

  revalidatePath(`/projects/${repo.id}`);
  return { ok: true as const, message: t("errors.readmeImported") };
}

/* -------------------------- TODO.md içe aktarma ------------------------- */

export type TodoCandidate = {
  title: string;
  done: boolean;
  priority: "low" | "normal" | "high";
  /** Ayni baslikli bir gorev zaten varsa isaretlenir. */
  duplicate: boolean;
};

/** TODO.md dosyasini okur ama hicbir sey yazmaz; kullaniciya onizleme icin. */
export async function previewTodoImport(repoId: number) {
  const user = await requireUser();
  const repo = await ownedRepo(repoId);
  const t = await getT();

  let file: { path: string; content: string } | null = null;
  try {
    file = await fetchTodoFile(user.access_token, repo.full_name);
  } catch (error) {
    return {
      ok: false as const,
      message: githubErrorMessage(t, error, t("todoImport.readError")),
    };
  }

  if (!file) {
    return { ok: false as const, message: t("todoImport.notFound") };
  }

  const parsed = parseTodoMarkdown(file.content);
  if (parsed.length === 0) {
    return {
      ok: false as const,
      message: t("todoImport.emptyFile", { path: file.path }),
    };
  }

  const existing = new Set(
    (
      db
        .prepare(`SELECT title FROM todos WHERE repo_id = ?`)
        .all(repo.id) as { title: string }[]
    ).map((row) => row.title.toLocaleLowerCase("tr")),
  );

  const items: TodoCandidate[] = parsed.map((item) => ({
    ...item,
    duplicate: existing.has(item.title.toLocaleLowerCase("tr")),
  }));

  return { ok: true as const, path: file.path, items };
}

/** Onizlemede secilen maddeleri ekler; parti kimligi geri almayi mumkun kilar. */
export async function importSelectedTodos(
  repoId: number,
  items: { title: string; done: boolean; priority: "low" | "normal" | "high" }[],
) {
  const repo = await ownedRepo(repoId);
  const t = await getT();

  if (items.length === 0) {
    return { ok: false as const, message: t("todoImport.nothingSelected") };
  }

  const batch = randomUUID();
  const insert = db.prepare(
    `INSERT INTO todos (repo_id, title, priority, done, completed_at, import_batch)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    for (const item of items) {
      insert.run(
        repo.id,
        item.title.slice(0, 300),
        item.priority,
        item.done ? 1 : 0,
        item.done ? nowIso() : null,
        batch,
      );
    }
  })();

  revalidatePath(`/projects/${repo.id}`);
  revalidatePath("/");

  return {
    ok: true as const,
    batch,
    added: items.length,
    message: t("todoImport.added", { count: items.length }),
  };
}

/** Az once yapilan iceri aktarmayi tamamen geri alir. */
export async function undoTodoImport(repoId: number, batch: string) {
  const repo = await ownedRepo(repoId);

  const result = db
    .prepare(`DELETE FROM todos WHERE repo_id = ? AND import_batch = ?`)
    .run(repo.id, batch);

  revalidatePath(`/projects/${repo.id}`);
  revalidatePath("/");

  return { ok: true as const, removed: result.changes };
}

/* --------------------------- Issue / PR senkronu ------------------------ */

/** Kullanicinin elle tetikledigi tazeleme. */
export async function refreshIssues(repoId: number) {
  const user = await requireUser();
  const repo = await ownedRepo(repoId);
  const t = await getT();

  try {
    const count = await syncIssues(user.access_token, repo);
    revalidatePath(`/projects/${repo.id}`);
    return { ok: true as const, message: t("issues.refreshed", { count }) };
  } catch (error) {
    return {
      ok: false as const,
      message: githubErrorMessage(t, error, t("issues.refreshError")),
    };
  }
}

/**
 * Bir gorevden GitHub issue'su acar.
 * Uygulamanin GitHub'da yazma yapan tek islemi; her zaman kullanici onayiyla calisir.
 */
export async function createIssueFromTodo(
  todoId: number,
  title: string,
  body: string,
) {
  const user = await requireUser();
  const t = await getT();

  const todo = db
    .prepare(
      `SELECT t.id, t.repo_id, t.issue_number, r.full_name
         FROM todos t
         JOIN repos r ON r.id = t.repo_id
        WHERE t.id = ? AND r.user_id = ?`,
    )
    .get(todoId, user.id) as
    | { id: number; repo_id: number; issue_number: number | null; full_name: string }
    | undefined;

  if (!todo) {
    return { ok: false as const, message: t("issueDialog.notFound") };
  }

  if (todo.issue_number) {
    return {
      ok: false as const,
      message: t("issueDialog.alreadyCreated", { number: todo.issue_number }),
    };
  }

  const cleanTitle = title.trim();
  if (!cleanTitle) {
    return { ok: false as const, message: t("issueDialog.emptyTitle") };
  }

  try {
    const issue = await createIssue(user.access_token, todo.full_name, {
      title: cleanTitle,
      body: body.trim(),
    });

    db.prepare(`UPDATE todos SET issue_number = ?, issue_url = ? WHERE id = ?`).run(
      issue.number,
      issue.html_url,
      todo.id,
    );
    cacheIssue(todo.repo_id, issue);

    revalidatePath(`/projects/${todo.repo_id}`);
    return {
      ok: true as const,
      message: t("issueDialog.created", { number: issue.number }),
      url: issue.html_url,
      number: issue.number,
    };
  } catch (error) {
    const status = error instanceof GithubError ? error.status : 0;
    const limited = error instanceof GithubError && error.rateLimited;

    return {
      ok: false as const,
      message:
        !limited && (status === 403 || status === 404)
          ? t("issueDialog.noPermission")
          : status === 410
            ? t("issueDialog.disabled")
            : githubErrorMessage(t, error, t("issueDialog.failed")),
    };
  }
}

/* ------------------------------- Notlar -------------------------------- */

export async function createNote(repoId: number, title: string, content: string) {
  const repo = await ownedRepo(repoId);
  const t = await getT();
  const cleanTitle = title.trim() || t("notes.untitled");

  db.prepare(
    `INSERT INTO notes (repo_id, title, content) VALUES (?, ?, ?)`,
  ).run(repo.id, cleanTitle, content.trim());

  revalidatePath(`/projects/${repo.id}`);
}

export async function updateNote(noteId: number, title: string, content: string) {
  const user = await requireUser();
  const t = await getT();

  db.prepare(
    `UPDATE notes
        SET title = ?, content = ?, updated_at = ?
      WHERE id = ?
        AND repo_id IN (SELECT id FROM repos WHERE user_id = ?)`,
  ).run(title.trim() || t("notes.untitled"), content.trim(), nowIso(), noteId, user.id);

  revalidatePath("/projects", "layout");
}

export async function toggleNotePin(noteId: number) {
  const user = await requireUser();

  db.prepare(
    `UPDATE notes
        SET pinned = CASE pinned WHEN 1 THEN 0 ELSE 1 END
      WHERE id = ?
        AND repo_id IN (SELECT id FROM repos WHERE user_id = ?)`,
  ).run(noteId, user.id);

  revalidatePath("/projects", "layout");
}

export async function deleteNote(noteId: number) {
  const user = await requireUser();

  db.prepare(
    `DELETE FROM notes
      WHERE id = ?
        AND repo_id IN (SELECT id FROM repos WHERE user_id = ?)`,
  ).run(noteId, user.id);

  revalidatePath("/projects", "layout");
}

/* -------------------------------- Todos -------------------------------- */

export async function createTodo(
  repoId: number,
  title: string,
  priority: "low" | "normal" | "high" = "normal",
) {
  const repo = await ownedRepo(repoId);
  const cleanTitle = title.trim();
  if (!cleanTitle) return;

  db.prepare(
    `INSERT INTO todos (repo_id, title, priority) VALUES (?, ?, ?)`,
  ).run(repo.id, cleanTitle, priority);

  revalidatePath(`/projects/${repo.id}`);
  revalidatePath("/");
}

export async function updateTodoTitle(todoId: number, title: string) {
  const user = await requireUser();
  const cleanTitle = title.trim();
  if (!cleanTitle) return;

  db.prepare(
    `UPDATE todos
        SET title = ?
      WHERE id = ?
        AND repo_id IN (SELECT id FROM repos WHERE user_id = ?)`,
  ).run(cleanTitle, todoId, user.id);

  revalidatePath("/projects", "layout");
}

export async function toggleTodo(todoId: number) {
  const user = await requireUser();

  db.prepare(
    `UPDATE todos
        SET done = CASE done WHEN 1 THEN 0 ELSE 1 END,
            completed_at = CASE done WHEN 1 THEN NULL ELSE ? END
      WHERE id = ?
        AND repo_id IN (SELECT id FROM repos WHERE user_id = ?)`,
  ).run(nowIso(), todoId, user.id);

  revalidatePath("/projects", "layout");
  revalidatePath("/");
}

export async function deleteTodo(todoId: number) {
  const user = await requireUser();

  db.prepare(
    `DELETE FROM todos
      WHERE id = ?
        AND repo_id IN (SELECT id FROM repos WHERE user_id = ?)`,
  ).run(todoId, user.id);

  revalidatePath("/projects", "layout");
  revalidatePath("/");
}

/** Secili gorevleri topluca tamamlandi/acik yapar. */
export async function bulkSetTodoDone(todoIds: number[], done: boolean) {
  const user = await requireUser();
  if (todoIds.length === 0) return { changed: 0 };

  const placeholders = todoIds.map(() => "?").join(",");
  const result = db
    .prepare(
      `UPDATE todos
          SET done = ?, completed_at = ?
        WHERE id IN (${placeholders})
          AND repo_id IN (SELECT id FROM repos WHERE user_id = ?)`,
    )
    .run(done ? 1 : 0, done ? nowIso() : null, ...todoIds, user.id);

  revalidatePath("/projects", "layout");
  revalidatePath("/");
  return { changed: result.changes };
}

/** Secili gorevleri topluca siler. */
export async function bulkDeleteTodos(todoIds: number[]) {
  const user = await requireUser();
  if (todoIds.length === 0) return { changed: 0 };

  const placeholders = todoIds.map(() => "?").join(",");
  const result = db
    .prepare(
      `DELETE FROM todos
        WHERE id IN (${placeholders})
          AND repo_id IN (SELECT id FROM repos WHERE user_id = ?)`,
    )
    .run(...todoIds, user.id);

  revalidatePath("/projects", "layout");
  revalidatePath("/");
  return { changed: result.changes };
}

export async function clearCompletedTodos(repoId: number) {
  const repo = await ownedRepo(repoId);

  db.prepare(`DELETE FROM todos WHERE repo_id = ? AND done = 1`).run(repo.id);

  revalidatePath(`/projects/${repo.id}`);
  revalidatePath("/");
}
