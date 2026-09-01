"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";

import { deleteRepo } from "@/lib/actions";
import { useT } from "@/lib/i18n/client";

export type DeletableRepo = {
  repoId: number;
  fullName: string;
  notes: number;
  todos: number;
};

/**
 * Geri alinamaz silme icin GitHub tarzi onay: kullanicinin deponun tam adini
 * yazmasi gerekiyor. Ayni kontrol sunucuda da var.
 */
export function DeleteRepoDialog({
  repo,
  onClose,
  redirectTo,
}: {
  repo: DeletableRepo | null;
  onClose: () => void;
  /** Silindikten sonra gidilecek adres; verilmezse sayfa tazelenir. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();

  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (repo && !dialog.open) dialog.showModal();
    if (!repo && dialog.open) dialog.close();
  }, [repo]);

  const matches = repo ? typed.trim() === repo.fullName : false;

  function submit() {
    if (!repo || !matches) return;

    startTransition(async () => {
      const result = await deleteRepo(repo.repoId, typed);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      dialogRef.current?.close();
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box max-w-lg overflow-hidden border border-base-300 bg-base-100 p-0">
        <header className="flex items-start justify-between gap-3 border-b border-base-300 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold">{t("deleteRepo.title")}</h2>
            <p className="mt-1 truncate font-mono text-[11.5px] text-base-content/50">
              {repo?.fullName}
            </p>
          </div>

          <form method="dialog">
            <button
              className="btn btn-ghost btn-xs btn-square text-base-content/45"
              aria-label={t("common.close")}
              disabled={pending}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </form>
        </header>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="rounded-field border border-error/30 bg-error/[0.07] px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-error">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              {t("deleteRepo.irreversible")}
            </p>
            <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-[11.5px] leading-relaxed text-base-content/65">
              <li>
                {t("deleteRepo.whatGoes", {
                  notes: repo?.notes ?? 0,
                  todos: repo?.todos ?? 0,
                })}
              </li>
              <li>{t("deleteRepo.githubSafe")}</li>
            </ul>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-[12.5px] text-base-content/60">
              {t("deleteRepo.confirmLabel")}
            </span>
            <code className="select-all rounded-field bg-base-200 px-2.5 py-1.5 font-mono text-[12.5px]">
              {repo?.fullName}
            </code>
            <input
              className="input input-sm w-full font-mono text-[13px]"
              value={typed}
              onChange={(event) => {
                setTyped(event.target.value);
                setError(null);
              }}
              placeholder={repo?.fullName}
              aria-label={t("deleteRepo.inputAria")}
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          {error ? (
            <p role="alert" className="text-[12.5px] text-error">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-1 border-t border-base-300 px-5 py-3">
          <form method="dialog">
            <button
              className="btn btn-ghost btn-sm font-normal text-base-content/60"
              disabled={pending}
            >
              {t("common.cancel")}
            </button>
          </form>
          <button
            type="button"
            className="btn btn-error btn-sm"
            onClick={submit}
            disabled={pending || !matches}
          >
            {pending ? (
              <span className="loading loading-spinner loading-xs" aria-hidden="true" />
            ) : null}
            {t("deleteRepo.submit")}
          </button>
        </footer>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button aria-label={t("common.close")}>{t("common.close")}</button>
      </form>
    </dialog>
  );
}
