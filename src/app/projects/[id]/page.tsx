import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  ChevronRight,
  GitCommitVertical,
  GitPullRequest,
  ListChecks,
  Lock,
  NotebookPen,
  Star,
} from "lucide-react";

import { Reveal } from "@/components/motion/Reveal";
import { HistorySection } from "@/components/project/HistorySection";
import { IssuesSection } from "@/components/project/IssuesSection";
import { NotesPanel } from "@/components/project/NotesPanel";
import { ProjectActions } from "@/components/project/ProjectActions";
import { SectionSkeleton } from "@/components/project/SectionSkeleton";
import { SummaryPanel } from "@/components/project/SummaryPanel";
import { TodosPanel } from "@/components/project/TodosPanel";
import { db, type NoteRow, type RepoRow, type TodoRow } from "@/lib/db";
import { formatRelative } from "@/lib/format";
import { getLocale, getT } from "@/lib/i18n/server";
import { languageColor } from "@/lib/languages";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "notes", labelKey: "project.tabNotes", icon: NotebookPen },
  { key: "todos", labelKey: "project.tabTodos", icon: ListChecks },
  { key: "history", labelKey: "project.tabHistory", icon: GitCommitVertical },
  { key: "issues", labelKey: "project.tabIssues", icon: GitPullRequest },
] as const;

type Tab = (typeof TABS)[number]["key"];

const PER_PAGE = 20;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const user = await requireUser();
  const { id } = await params;
  const repo = db
    .prepare(`SELECT name FROM repos WHERE id = ? AND user_id = ?`)
    .get(Number(id), user.id) as { name: string } | undefined;

  const t = await getT();
  return { title: repo?.name ?? t("project.fallbackTitle") };
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; branch?: string; page?: string; state?: string }>;
}) {
  const user = await requireUser();
  const t = await getT();
  const locale = await getLocale();
  const { id } = await params;
  const query = await searchParams;

  const repo = db
    .prepare(`SELECT * FROM repos WHERE id = ? AND user_id = ?`)
    .get(Number(id), user.id) as RepoRow | undefined;

  if (!repo) notFound();
  const repoId = repo.id;

  const tab: Tab = TABS.some((item) => item.key === query.tab)
    ? (query.tab as Tab)
    : "notes";
  const branch = query.branch || repo.default_branch;
  const page = Math.max(1, Number(query.page) || 1);

  const notes = db
    .prepare(`SELECT * FROM notes WHERE repo_id = ? ORDER BY pinned DESC, updated_at DESC`)
    .all(repoId) as NoteRow[];

  const todos = db
    .prepare(
      `SELECT * FROM todos
        WHERE repo_id = ?
        ORDER BY done ASC,
                 CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
                 created_at DESC`,
    )
    .all(repoId) as TodoRow[];

  const issueState: "open" | "closed" = query.state === "closed" ? "closed" : "open";

  const openTodos = todos.filter((todo) => !todo.done).length;
  const noteCount = notes.length;

  function tabHref(next: Tab) {
    const search = new URLSearchParams({ tab: next });
    if (next === "history" && branch) search.set("branch", branch);
    return `/projects/${repoId}?${search.toString()}`;
  }

  return (
    <Reveal className="flex flex-col gap-6">
      <div>
        <nav
          aria-label="Konum"
          className="flex items-center gap-1.5 text-[12px] text-base-content/40"
        >
          <Link href="/" className="transition-colors hover:text-base-content">
            {t("project.breadcrumb")}
          </Link>
          <ChevronRight className="size-3" aria-hidden="true" />
          <span className="truncate font-mono text-base-content/55">
            {repo.full_name}
          </span>
        </nav>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-[22px] font-semibold leading-tight tracking-tight">
              {repo.name}
              {repo.is_private ? (
                <Lock
                  className="size-3.5 text-base-content/35"
                  aria-label={t("common.privateRepo")}
                />
              ) : null}
            </h1>

            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-base-content/55">
              {repo.description ?? t("project.noDescription")}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-base-content/45">
              {repo.language ? (
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: languageColor(repo.language) }}
                    aria-hidden="true"
                  />
                  {repo.language}
                </span>
              ) : null}
              {repo.stars > 0 ? (
                <span className="tabular flex items-center gap-1">
                  <Star className="size-3" aria-hidden="true" />
                  {repo.stars}
                </span>
              ) : null}
              <span className="font-mono">{repo.default_branch}</span>
              <span>{t("project.lastPush", { time: formatRelative(repo.pushed_at, locale) })}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href={repo.html_url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm font-normal"
            >
              {t("common.github")}
              <ArrowUpRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
            </a>

            <ProjectActions
              repo={{
                repoId,
                fullName: repo.full_name,
                notes: noteCount,
                todos: todos.length,
              }}
            />
          </div>
        </div>
      </div>

      <SummaryPanel
        repoId={repoId}
        summary={repo.summary}
        source={repo.summary_source}
        updatedAt={repo.summary_updated_at}
      />

      <div role="tablist" className="tabs tabs-border border-b border-base-300">
        {TABS.map((item) => {
          const active = tab === item.key;
          const count =
            item.key === "notes" ? notes.length : item.key === "todos" ? openTodos : 0;

          return (
            <Link
              key={item.key}
              role="tab"
              aria-selected={active}
              href={tabHref(item.key)}
              scroll={false}
              className={`tab gap-2 text-[13px]${active ? " tab-active font-medium" : " text-base-content/55"}`}
            >
              <item.icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              {t(item.labelKey)}
              {count > 0 ? (
                <span className="tabular rounded-selector bg-base-content/[0.08] px-1.5 text-[11px] text-base-content/60">
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {tab === "notes" ? <NotesPanel repoId={repoId} notes={notes} /> : null}
      {tab === "todos" ? <TodosPanel
          repoId={repoId}
          repoFullName={repo.full_name}
          repoIsPrivate={Boolean(repo.is_private)}
          todos={todos}
        /> : null}
      {tab === "issues" ? (
        <Suspense fallback={<SectionSkeleton />}>
          <IssuesSection
            token={user.access_token}
            repo={repo}
            state={issueState}
          />
        </Suspense>
      ) : null}

      {tab === "history" ? (
        <Suspense fallback={<SectionSkeleton />}>
          <HistorySection
            token={user.access_token}
            repoId={repoId}
            fullName={repo.full_name}
            branch={branch}
            page={page}
            perPage={PER_PAGE}
          />
        </Suspense>
      ) : null}
    </Reveal>
  );
}
