import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Reveal } from "@/components/motion/Reveal";
import { ArchivedRepos, type ArchivedRepo } from "@/components/repos/ArchivedRepos";
import { RepoPicker, type RepoMeta } from "@/components/repos/RepoPicker";
import { PageHeader } from "@/components/ui/PageHeader";
import type { SelectableRepo } from "@/lib/actions";
import { db } from "@/lib/db";
import { fetchAllRepos, githubErrorMessage } from "@/lib/github";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("repos.title") };
}

type StoredRepo = {
  id: number;
  github_repo_id: number;
  full_name: string;
  name: string;
  is_archived: number;
  archived_at: string | null;
  notes: number;
  todos: number;
};

export default async function ReposPage() {
  const user = await requireUser();
  const t = await getT();

  const stored = db
    .prepare(
      `SELECT r.id, r.github_repo_id, r.full_name, r.name, r.is_archived, r.archived_at,
              (SELECT COUNT(*) FROM notes n WHERE n.repo_id = r.id) AS notes,
              (SELECT COUNT(*) FROM todos t WHERE t.repo_id = r.id) AS todos
         FROM repos r
        WHERE r.user_id = ?`,
    )
    .all(user.id) as StoredRepo[];

  const selectedIds = stored
    .filter((row) => !row.is_archived)
    .map((row) => row.github_repo_id);

  const meta: RepoMeta[] = stored.map((row) => ({
    githubRepoId: row.github_repo_id,
    fullName: row.full_name,
    notes: row.notes,
    todos: row.todos,
    archived: Boolean(row.is_archived),
  }));

  const archived: ArchivedRepo[] = stored
    .filter((row) => row.is_archived)
    .map((row) => ({
      repoId: row.id,
      name: row.name,
      fullName: row.full_name,
      notes: row.notes,
      todos: row.todos,
      archivedAt: row.archived_at,
    }));

  let repos: SelectableRepo[] = [];
  let loadError: string | null = null;

  try {
    repos = (await fetchAllRepos(user.access_token)).map((repo) => ({
      github_repo_id: repo.id,
      full_name: repo.full_name,
      name: repo.name,
      owner: repo.owner.login,
      description: repo.description,
      is_private: repo.private,
      html_url: repo.html_url,
      default_branch: repo.default_branch,
      language: repo.language,
      stars: repo.stargazers_count,
      pushed_at: repo.pushed_at,
    }));
  } catch (error) {
    loadError = githubErrorMessage(t, error, t("repos.loadError"));
  }

  return (
    <Reveal className="flex flex-col gap-6">
      <PageHeader
        title={t("repos.title")}
        description={t("repos.description")}
        actions={
          <Link href="/" className="btn btn-ghost btn-sm font-normal">
            {t("repos.backToBoard")}
          </Link>
        }
      />

      {loadError ? (
        <div role="alert" className="alert alert-error alert-soft text-[13px]">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      ) : (
        <RepoPicker repos={repos} initialSelectedIds={selectedIds} meta={meta} />
      )}

      {archived.length > 0 ? <ArchivedRepos repos={archived} /> : null}
    </Reveal>
  );
}
