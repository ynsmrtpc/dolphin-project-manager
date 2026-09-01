"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Globe, Lock, X } from "lucide-react";

import { createIssueFromTodo } from "@/lib/actions";
import { useT } from "@/lib/i18n/client";

export function CreateIssueDialog({
  todo,
  repoFullName,
  repoIsPrivate,
  onClose,
  onDone,
}: {
  todo: { id: number; title: string } | null;
  repoFullName: string;
  repoIsPrivate: boolean;
  onClose: () => void;
  onDone: (result: { ok: boolean; message: string }) => void;
}) {
  const router = useRouter();
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(todo?.title ?? "");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (todo && !dialog.open) dialog.showModal();
    if (!todo && dialog.open) dialog.close();
  }, [todo]);

  function submit() {
    if (!todo) return;

    startTransition(async () => {
      const result = await createIssueFromTodo(todo.id, title, body);

      if (result.ok) {
        onDone({ ok: true, message: result.message });
        dialogRef.current?.close();
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box max-w-lg overflow-hidden border border-base-300 bg-base-100 p-0">
        <header className="flex items-start justify-between gap-3 border-b border-base-300 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold">{t("issueDialog.title")}</h2>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-[11.5px] text-base-content/50">
              {repoIsPrivate ? (
                <Lock className="size-3" aria-hidden="true" />
              ) : (
                <Globe className="size-3" aria-hidden="true" />
              )}
              {repoFullName}
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

        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-base-content/60">
              {t("issueDialog.titleField")}
            </span>
            <input
              className="input input-sm w-full text-[13px]"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-base-content/60">
              {t("issueDialog.bodyField")}{" "}
              <span className="font-normal text-base-content/40">
                {t("issueDialog.optional")}
              </span>
            </span>
            <textarea
              className="textarea textarea-sm min-h-24 w-full text-[13px] leading-relaxed"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t("issueDialog.bodyPlaceholder")}
            />
          </label>

          <div className="rounded-field border border-warning/30 bg-warning/[0.07] px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-warning">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              {t("issueDialog.warningTitle")}
            </p>
            <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-[11.5px] leading-relaxed text-base-content/60">
              <li>{t("issueDialog.warningDelete")}</li>
              <li>
                {repoIsPrivate
                  ? t("issueDialog.warningPrivate")
                  : t("issueDialog.warningPublic")}
              </li>
              <li>{t("issueDialog.warningNotify")}</li>
              <li>{t("issueDialog.warningNoSync")}</li>
            </ul>
          </div>

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
            className="btn btn-primary btn-sm"
            onClick={submit}
            disabled={pending || !title.trim()}
          >
            {pending ? (
              <span className="loading loading-spinner loading-xs" aria-hidden="true" />
            ) : null}
            {t("issueDialog.submit")}
          </button>
        </footer>
      </div>

      <form method="dialog" className="modal-backdrop">
<button aria-label={t("common.close")}>{t("common.close")}</button>
      </form>
    </dialog>
  );
}
