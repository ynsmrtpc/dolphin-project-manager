"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, MoreHorizontal, Trash2 } from "lucide-react";

import {
  DeleteRepoDialog,
  type DeletableRepo,
} from "@/components/repos/DeleteRepoDialog";
import { archiveRepo } from "@/lib/actions";
import { useT } from "@/lib/i18n/client";

/** <details> tabanli menu, bir ogeye tiklaninca kendiliginden kapanmaz. */
function closeMenu(event: React.MouseEvent<HTMLElement>) {
  event.currentTarget.closest("details")?.removeAttribute("open");
}

export function ProjectActions({ repo }: { repo: DeletableRepo }) {
  const router = useRouter();
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<DeletableRepo | null>(null);

  return (
    <>
      <details className="dropdown dropdown-end">
        <summary
          className="btn btn-sm btn-square font-normal"
          aria-label={t("project.actionsAria")}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </summary>

        <div className="dropdown-content z-40 mt-2 w-64 overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-lg">
          <button
            type="button"
            disabled={pending}
            className="flex w-full flex-col items-start gap-0.5 px-3.5 py-2.5 text-left transition-colors hover:bg-base-content/[0.04]"
            onClick={(event) => {
              closeMenu(event);
              startTransition(async () => {
                await archiveRepo(repo.repoId);
                router.push("/");
              });
            }}
          >
            <span className="flex items-center gap-2.5 text-[13px]">
              <Archive className="size-3.5" aria-hidden="true" />
              {t("project.archive")}
            </span>
            <span className="pl-6 text-[11.5px] text-base-content/45">
              {t("project.archiveHint")}
            </span>
          </button>

          <button
            type="button"
            className="flex w-full items-center gap-2.5 border-t border-base-300 px-3.5 py-2.5 text-left text-[13px] text-base-content/70 transition-colors hover:bg-error/[0.06] hover:text-error"
            onClick={(event) => {
              closeMenu(event);
              setDeleting(repo);
            }}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            {t("project.delete")}
          </button>
        </div>
      </details>

      <DeleteRepoDialog
        key={deleting?.repoId ?? "closed"}
        repo={deleting}
        onClose={() => setDeleting(null)}
        redirectTo="/"
      />
    </>
  );
}
