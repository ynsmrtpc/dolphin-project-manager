"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ChevronRight, Lock, Search, Star } from "lucide-react";

import { fadeUp, reducedFade, staggerContainer } from "@/components/motion/motion-presets";
import { formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { languageColor } from "@/lib/languages";

export type ProjectRow = {
  id: number;
  full_name: string;
  name: string;
  owner: string;
  description: string | null;
  is_private: number;
  html_url: string;
  language: string | null;
  stars: number;
  pushed_at: string | null;
  missing_since: string | null;
  note_count: number;
  open_todos: number;
  done_todos: number;
};

type Sort = "pushed" | "todos" | "name";

export function ProjectList({ projects }: { projects: ProjectRow[] }) {
  const reduced = useReducedMotion();
  const t = useT();
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("pushed");

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(locale);
    const filtered = projects.filter(
      (project) =>
        !q ||
        project.full_name.toLocaleLowerCase(locale).includes(q) ||
        (project.description ?? "").toLocaleLowerCase(locale).includes(q),
    );

    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, locale);
      if (sort === "todos") return b.open_todos - a.open_todos;
      return (b.pushed_at ?? "").localeCompare(a.pushed_at ?? "");
    });
  }, [projects, query, sort, locale]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="input input-sm h-8 w-full max-w-xs bg-base-100 text-[13px]">
          <Search className="size-3.5 opacity-45" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("common.search")}
            aria-label={t("projectList.searchAria")}
          />
        </label>

        <label className="flex items-center gap-2 text-[13px] text-base-content/50">
          {t("projectList.sortLabel")}
          <select
            className="select select-sm h-8 w-36 bg-base-100 text-[13px]"
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            aria-label={t("projectList.sortAria")}
          >
            <option value="pushed">{t("projectList.sortPushed")}</option>
            <option value="todos">{t("projectList.sortTodos")}</option>
            <option value="name">{t("projectList.sortName")}</option>
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-box border border-base-300 bg-base-100 px-4 py-14 text-center text-[13px] text-base-content/50">
          {t("projectList.empty")}
        </p>
      ) : (
        <motion.ul
          className="overflow-hidden rounded-box border border-base-300 bg-base-100"
          variants={reduced ? undefined : staggerContainer}
          initial={reduced ? undefined : "hidden"}
          animate={reduced ? undefined : "show"}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((project) => (
              <motion.li
                key={project.id}
                layout={!reduced}
                variants={reduced ? reducedFade : fadeUp}
                initial="hidden"
                animate="show"
                exit="exit"
                className="group relative border-b border-base-300 transition-colors last:border-b-0 hover:bg-base-content/[0.025]"
              >
                <div className="flex items-center gap-4 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-[14px] leading-snug">
                        <Link
                          href={`/projects/${project.id}`}
                          className="after:absolute after:inset-0"
                        >
                          <span className="text-base-content/40">{project.owner}/</span>
                          <span className="font-medium">{project.name}</span>
                        </Link>
                      </h3>
                      {project.is_private ? (
                        <Lock
                          className="size-3 shrink-0 text-base-content/35"
                          aria-label={t("common.privateRepo")}
                        />
                      ) : null}

                      {project.missing_since ? (
                        <span
                          className="flex shrink-0 items-center gap-1 rounded-selector bg-warning/15 px-1.5 py-0.5 text-[10.5px] text-warning"
                          title={t("missing.badgeTitle")}
                        >
                          <AlertTriangle className="size-2.5" aria-hidden="true" />
                          {t("missing.badge")}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 truncate text-[12.5px] leading-relaxed text-base-content/50">
                      {project.description ?? t("projectList.noDescription")}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-base-content/45">
                      {project.language ? (
                        <span className="flex items-center gap-1.5">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: languageColor(project.language) }}
                            aria-hidden="true"
                          />
                          {project.language}
                        </span>
                      ) : null}
                      {project.stars > 0 ? (
                        <span className="tabular flex items-center gap-1">
                          <Star className="size-3" aria-hidden="true" />
                          {project.stars}
                        </span>
                      ) : null}
                      <span>{formatRelative(project.pushed_at, locale)}</span>
                    </div>
                  </div>

                  <div className="hidden shrink-0 items-center gap-5 text-[12px] sm:flex">
                    <Counter
                      value={project.open_todos}
                      label={t("projectList.openTodos")}
                      emphasize={project.open_todos > 0}
                    />
                    <Counter value={project.note_count} label={t("projectList.notes")} />
                  </div>

                  <ChevronRight
                    className="size-4 shrink-0 text-base-content/20 transition-colors group-hover:text-base-content/50"
                    aria-hidden="true"
                  />
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </section>
  );
}

function Counter({
  value,
  label,
  emphasize = false,
}: {
  value: number;
  label: string;
  emphasize?: boolean;
}) {
  return (
    <span className="flex w-16 flex-col items-end leading-tight">
      <span
        className={`tabular text-[15px] font-medium ${
          emphasize ? "text-base-content" : "text-base-content/35"
        }`}
      >
        {value}
      </span>
      <span className="text-[10.5px] text-base-content/40">{label}</span>
    </span>
  );
}
