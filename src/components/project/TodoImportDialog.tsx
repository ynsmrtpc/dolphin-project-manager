"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDown, X } from "lucide-react";

import {
  importSelectedTodos,
  previewTodoImport,
  type TodoCandidate,
} from "@/lib/actions";
import { useT } from "@/lib/i18n/client";

const PRIORITY_KEY: Record<TodoCandidate["priority"], string> = {
  high: "todos.priorityHigh",
  normal: "todos.priorityNormal",
  low: "todos.priorityLow",
};

export function TodoImportDialog({
  repoId,
  open,
  onClose,
  onImported,
}: {
  repoId: number;
  open: boolean;
  onClose: () => void;
  onImported: (result: { batch: string; added: number; message: string }) => void;
}) {
  const router = useRouter();
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();

  const [items, setItems] = useState<TodoCandidate[] | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;

    let cancelled = false;

    previewTodoImport(repoId).then((result) => {
      if (cancelled) return;

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setPath(result.path);
      setItems(result.items);
      // Zaten var olanlar varsayilan olarak isaretsiz gelir.
      setChosen(
        new Set(
          result.items
            .map((item, index) => (item.duplicate ? -1 : index))
            .filter((index) => index >= 0),
        ),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [open, repoId]);

  function toggle(index: number) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function submit() {
    if (!items) return;
    const payload = [...chosen]
      .sort((a, b) => a - b)
      .map((index) => items[index])
      .map(({ title, done, priority }) => ({ title, done, priority }));

    startTransition(async () => {
      const result = await importSelectedTodos(repoId, payload);

      if (result.ok) {
        onImported({
          batch: result.batch,
          added: result.added,
          message: result.message,
        });
        dialogRef.current?.close();
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  const duplicates = items?.filter((item) => item.duplicate).length ?? 0;

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box max-w-xl overflow-hidden border border-base-300 bg-base-100 p-0">
        <header className="flex items-start justify-between gap-3 border-b border-base-300 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold">{t("todoImport.title")}</h2>
            <p className="mt-1 font-mono text-[11.5px] text-base-content/50">
              {path ?? t("todoImport.searching")}
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

        {error ? (
          <p className="px-5 py-10 text-center text-[13px] text-warning">{error}</p>
        ) : !items ? (
          <div className="flex flex-col gap-2 px-5 py-6">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-4 w-3/5" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-base-300 px-5 py-2.5 text-[12px]">
              <span className="text-base-content/55">
                {t("todoImport.selected", {
                  selected: chosen.size,
                  total: items.length,
                })}
                {duplicates > 0 ? t("todoImport.duplicates", { count: duplicates }) : ""}
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs font-normal text-base-content/60"
                  onClick={() => setChosen(new Set(items.map((_, index) => index)))}
                >
                  {t("common.all")}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs font-normal text-base-content/60"
                  onClick={() => setChosen(new Set())}
                >
                  {t("common.none")}
                </button>
              </span>
            </div>

            <ul className="max-h-[50vh] overflow-y-auto">
              {items.map((item, index) => (
                <li key={`${item.title}-${index}`} className="border-b border-base-300 last:border-b-0">
                  <label className="flex items-start gap-3 px-5 py-2 transition-colors hover:bg-base-content/[0.03]">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs checkbox-primary mt-0.5"
                      checked={chosen.has(index)}
                      onChange={() => toggle(index)}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[13px] ${
                          item.done ? "text-base-content/45 line-through" : ""
                        }`}
                      >
                        {item.title}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-base-content/40">
                        <span>{t(PRIORITY_KEY[item.priority])}</span>
                        {item.done ? <span>{t("todoImport.completed")}</span> : null}
                        {item.duplicate ? (
                          <span className="text-warning">{t("todoImport.duplicate")}</span>
                        ) : null}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

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
            disabled={pending || !items || chosen.size === 0}
          >
            {pending ? (
              <span className="loading loading-spinner loading-xs" aria-hidden="true" />
            ) : (
              <FileDown className="size-3.5" aria-hidden="true" />
            )}
            {chosen.size > 0
              ? t("todoImport.submit", { count: chosen.size })
              : t("todoImport.submitEmpty")}
          </button>
        </footer>
      </div>

      <form method="dialog" className="modal-backdrop">
<button aria-label={t("common.close")}>{t("common.close")}</button>
      </form>
    </dialog>
  );
}
