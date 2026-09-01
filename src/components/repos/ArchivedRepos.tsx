"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, Trash2 } from "lucide-react";

import {
  DeleteRepoDialog,
  type DeletableRepo,
} from "@/components/repos/DeleteRepoDialog";
import { restoreArchivedRepo } from "@/lib/actions";
import { formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

export type ArchivedRepo = DeletableRepo & {
  name: string;
  archivedAt: string | null;
  /** Kalici silmeye kalan gun; saklama suresi kapaliysa null. */
  daysLeft: number | null;
};

export function ArchivedRepos({
  repos,
  retentionDays,
}: {
  repos: ArchivedRepo[];
  retentionDays: number;
}) {
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
        <Archive
          className="size-3.5 text-base-content/40"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <h2 className="eyebrow">{t("archive.title", { count: repos.length })}</h2>
      </div>

      <p className="text-[12px] leading-relaxed text-base-content/50">
        {t("archive.description")}{" "}
        {retentionDays > 0
          ? t("archive.retention", { days: retentionDays })
          : t("archive.retentionOff")}
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
                {repo.daysLeft !== null ? (
                  <span className={repo.daysLeft <= 3 ? "text-warning" : undefined}>
                    {" · "}
                    {repo.daysLeft === 0
                      ? t("archive.expiresToday")
                      : t("archive.expiresIn", { days: repo.daysLeft })}
                  </span>
                ) : null}
              </p>
            </div>

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

              {/* Etiketli: yalnizca ikon birakildiginda kullanici silmeyi bulamiyordu. */}
              <button
                type="button"
                className="btn btn-ghost btn-xs font-normal text-base-content/60 hover:text-error"
                onClick={() => setDeleting(repo)}
                aria-label={t("archive.deleteAria", { repo: repo.fullName })}
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
