"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { CommitDetailModal } from "@/components/project/CommitDetailModal";
import { fadeUp, reducedFade, staggerContainer } from "@/components/motion/motion-presets";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import type { GithubCommit } from "@/lib/github";

function pageHref(repoId: number, branch: string, page: number) {
  const params = new URLSearchParams({ tab: "history", branch, page: String(page) });
  return `/projects/${repoId}?${params.toString()}`;
}

export function CommitHistory({
  repoId,
  commits,
  branch,
  page,
  perPage,
}: {
  repoId: number;
  commits: GithubCommit[];
  branch: string;
  page: number;
  perPage: number;
}) {
  const reduced = useReducedMotion();
  const t = useT();
  const locale = useLocale();
  const [selected, setSelected] = useState<string | null>(null);

  if (commits.length === 0) {
    return (
      <div className="max-w-3xl rounded-box border border-dashed border-base-300 px-4 py-16 text-center">
        <p className="text-[13px] text-base-content/45">
          {page > 1 ? t("commits.emptyPage") : t("commits.emptyBranch")}
        </p>
        {page > 1 ? (
          <Link href={pageHref(repoId, branch, 1)} className="btn btn-sm mt-4 font-normal">
            {t("commits.firstPage")}
          </Link>
        ) : null}
      </div>
    );
  }

  const hasNext = commits.length === perPage;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <motion.ul
        className="overflow-hidden rounded-box border border-base-300 bg-base-100"
        variants={reduced ? undefined : staggerContainer}
        initial={reduced ? undefined : "hidden"}
        animate={reduced ? undefined : "show"}
      >
        {commits.map((commit) => {
          // Listede yalnizca baslik durur; govde ve diff detay modalinda.
          const subject = commit.commit.message.split("\n")[0];
          const date = commit.commit.author?.date ?? null;
          const author =
            commit.author?.login ?? commit.commit.author?.name ?? t("common.unknown");

          return (
            <motion.li
              key={commit.sha}
              variants={reduced ? reducedFade : fadeUp}
              className="border-b border-base-300 last:border-b-0"
            >
              <button
                type="button"
                onClick={() => setSelected(commit.sha)}
                className="group flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-base-content/[0.03]"
                aria-label={t("commits.openDetail", { subject })}
              >
                {commit.author?.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={commit.author.avatar_url}
                    alt=""
                    width={20}
                    height={20}
                    className="mt-0.5 size-5 shrink-0 rounded-full ring-1 ring-base-300"
                  />
                ) : (
                  <span
                    className="mt-0.5 size-5 shrink-0 rounded-full bg-base-300"
                    aria-hidden="true"
                  />
                )}

                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-[13.5px] font-medium leading-snug">
                    {subject}
                  </span>

                  <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-base-content/45">
                    <span className="text-base-content/60">{author}</span>
                    <span aria-hidden="true">·</span>
                    <time title={formatDateTime(date, locale)}>
                      {formatRelative(date, locale)}
                    </time>
                  </span>
                </span>

                <span className="flex h-6 shrink-0 items-center rounded-selector border border-base-300 px-1.5 font-mono text-[11px] text-base-content/55 transition-colors group-hover:border-base-content/25 group-hover:text-base-content">
                  {commit.sha.slice(0, 7)}
                </span>
              </button>
            </motion.li>
          );
        })}
      </motion.ul>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11.5px] text-base-content/40">
          <span className="font-mono">{branch}</span> ·{" "}
          <span className="tabular">{t("commits.pageInfo", { page })}</span>
        </span>

        <div className="join">
          {page > 1 ? (
            <Link
              href={pageHref(repoId, branch, page - 1)}
              scroll={false}
              className="btn btn-xs join-item h-8 border-base-300 bg-base-100 font-normal"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
              {t("commits.previous")}
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn-xs join-item btn-disabled h-8 font-normal"
              tabIndex={-1}
              aria-disabled="true"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
              {t("commits.previous")}
            </button>
          )}

          {hasNext ? (
            <Link
              href={pageHref(repoId, branch, page + 1)}
              scroll={false}
              className="btn btn-xs join-item h-8 border-base-300 bg-base-100 font-normal"
            >
              {t("commits.next")}
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn-xs join-item btn-disabled h-8 font-normal"
              tabIndex={-1}
              aria-disabled="true"
            >
              {t("commits.next")}
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* sha degisince bilesen sifirdan kurulur; efekt icinde state sifirlamaya gerek kalmaz */}
      <CommitDetailModal
        key={selected ?? "closed"}
        repoId={repoId}
        sha={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
