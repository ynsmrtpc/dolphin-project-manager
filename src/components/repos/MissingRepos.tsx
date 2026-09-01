"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Archive, Trash2 } from "lucide-react";

import {
  DeleteRepoDialog,
  type DeletableRepo,
} from "@/components/repos/DeleteRepoDialog";
import { archiveRepo } from "@/lib/actions";
import { formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

export type MissingRepo = DeletableRepo & {
  name: string;
  missingSince: string | null;
};

export function MissingRepos({ repos }: { repos: MissingRepo[] }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<DeletableRepo | null>(null);

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <AlertTriangle
          className="size-3.5 text-warning"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <h2 className="eyebrow">{t("missing.title", { count: repos.length })}</h2>
      </div>

      <p className="text-[12px] leading-relaxed text-base-content/50">
        {t("missing.description")}
      </p>

      <ul className="mt-1 overflow-hidden rounded-box border border-warning/30 bg-base-100">
        {repos.map((repo) => (
          <li
            key={repo.repoId}
            className="flex flex-wrap items-center gap-3 border-b border-base-300 px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px]">
                <span className="text-base-content/40">
                  {repo.fullName.split("/")[0]}/
                </span>
                <span className="font-medium">{repo.name}</span>
              </p>
              <p className="tabular mt-0.5 text-[11.5px] text-base-content/45">
                {t("missing.counts", { notes: repo.notes, todos: repo.todos })}
                {repo.missingSince
                  ? ` · ${t("missing.since", { time: formatRelative(repo.missingSince, locale) })}`
                  : ""}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn btn-ghost btn-xs font-normal text-base-content/60"
                disabled={pending}
                title={t("missing.archiveTitle")}
                onClick={() => run(() => archiveRepo(repo.repoId))}
              >
                <Archive className="size-3.5" aria-hidden="true" />
                {t("missing.archive")}
              </button>

              {/* Etiketli: yalnizca ikon birakildiginda kullanici silmeyi bulamiyordu. */}
              <button
                type="button"
                className="btn btn-ghost btn-xs font-normal text-base-content/60 hover:text-error"
                onClick={() => setDeleting(repo)}
                aria-label={t("missing.deleteAria", { repo: repo.fullName })}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                {t("common.delete")}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <DeleteRepoDialog
        key={deleting?.repoId ?? "closed"}
        repo={deleting}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}
