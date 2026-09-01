import type { Metadata } from "next";
import Link from "next/link";
import { FolderGit2, Settings2 } from "lucide-react";

import { ProjectList, type ProjectRow } from "@/components/home/ProjectList";
import { RefreshRepos } from "@/components/home/RefreshRepos";
import { Reveal } from "@/components/motion/Reveal";
import { MetaStrip, PageHeader } from "@/components/ui/PageHeader";
import { purgeExpiredArchives } from "@/lib/archive";
import { db } from "@/lib/db";
import { isRepoMetaStale, repoMetaSyncedAt, syncRepoMeta } from "@/lib/repos";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("home.title") };
}

export default async function HomePage() {
  const user = await requireUser();
  const t = await getT();

  purgeExpiredArchives(user.id);

  // Yildiz/aciklama/son push bilgisi bayatladiysa tek istekle hepsini tazele.
  let syncedAt = repoMetaSyncedAt(user.id);
  if (isRepoMetaStale(syncedAt)) {
    try {
      await syncRepoMeta(user);
      syncedAt = repoMetaSyncedAt(user.id);
    } catch {
      /* Tazeleme basarisizsa kayitli veriyle devam ediyoruz. */
    }
  }

  const projects = db
    .prepare(
      `SELECT r.id, r.full_name, r.name, r.owner, r.description, r.is_private,
              r.html_url, r.language, r.stars, r.pushed_at, r.missing_since,
              (SELECT COUNT(*) FROM notes n WHERE n.repo_id = r.id) AS note_count,
              (SELECT COUNT(*) FROM todos t WHERE t.repo_id = r.id AND t.done = 0) AS open_todos,
              (SELECT COUNT(*) FROM todos t WHERE t.repo_id = r.id AND t.done = 1) AS done_todos
         FROM repos r
        WHERE r.user_id = ? AND r.is_archived = 0
        ORDER BY r.pushed_at DESC NULLS LAST, r.full_name`,
    )
    .all(user.id) as ProjectRow[];

  const totals = projects.reduce(
    (acc, project) => ({
      notes: acc.notes + project.note_count,
      open: acc.open + project.open_todos,
      done: acc.done + project.done_todos,
    }),
    { notes: 0, open: 0, done: 0 },
  );

  return (
    <Reveal className="flex flex-col gap-6">
      <PageHeader
        title={t("home.title")}
        description={t("home.description")}
        actions={
          <>
            <RefreshRepos syncedAt={syncedAt} />
            <Link href="/repos" className="btn btn-sm">
              <Settings2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {t("shell.repoSelection")}
            </Link>
          </>
        }
      />

      {projects.length === 0 ? (
        <div className="flex flex-col items-center rounded-box border border-dashed border-base-300 px-6 py-20 text-center">
          <FolderGit2
            className="size-8 text-base-content/20"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <h2 className="mt-4 text-[15px] font-medium">{t("home.emptyTitle")}</h2>
          <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-base-content/50">
            {t("home.emptyBody")}
          </p>
          <Link href="/repos" className="btn btn-primary btn-sm mt-6">
            {t("home.emptyAction")}
          </Link>
        </div>
      ) : (
        <>
          <MetaStrip
            items={[
              { label: t("home.statProjects"), value: projects.length },
              { label: t("home.statOpenTodos"), value: totals.open },
              { label: t("home.statDone"), value: totals.done },
              { label: t("home.statNotes"), value: totals.notes },
            ]}
          />

          <ProjectList projects={projects} />
        </>
      )}
    </Reveal>
  );
}
