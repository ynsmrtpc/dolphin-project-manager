"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, Trash2 } from "lucide-react";

import { deleteArchivedRepo, restoreArchivedRepo } from "@/lib/actions";
import { formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

export type ArchivedRepo = {
  repoId: number;
  name: string;
  fullName: string;
  notes: number;
  todos: number;
  archivedAt: string | null;
};

export function ArchivedRepos({ repos }: { repos: ArchivedRepo[] }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<number | null>(null);

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      setConfirmId(null);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Archive
          className="size-3.5 text-base-content/40"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <h2 className="eyebrow">
          {t("archive.title", { count: repos.length })}
        </h2>
      </div>

      <p className="text-[12px] leading-relaxed text-base-content/50">
        {t("archive.description")}
      </p>

      <ul className="mt-1 overflow-hidden rounded-box border border-base-300 bg-base-100">
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
                {t("archive.counts", { notes: repo.notes, todos: repo.todos })}
                {repo.archivedAt
                  ? ` · ${t("archive.archivedAt", { time: formatRelative(repo.archivedAt, locale) })}`
                  : ""}
              </p>
            </div>

            {confirmId === repo.repoId ? (
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] text-error">
                  {t("archive.deleteWarning", { count: repo.notes + repo.todos })}
                </span>
                <button
                  type="button"
                  className="btn btn-error btn-xs"
                  disabled={pending}
                  onClick={() => run(() => deleteArchivedRepo(repo.repoId))}
                >
                  {t("common.confirmDelete")}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs font-normal"
                  onClick={() => setConfirmId(null)}
                >
                  {t("common.cancel")}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs font-normal text-base-content/60"
                  disabled={pending}
                  onClick={() => run(() => restoreArchivedRepo(repo.repoId))}
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  {t("archive.restore")}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-error"
                  onClick={() => setConfirmId(repo.repoId)}
                  aria-label={t("archive.deleteAria", { repo: repo.fullName })}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
