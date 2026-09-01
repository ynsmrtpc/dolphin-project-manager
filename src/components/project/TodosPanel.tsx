"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CheckSquare,
  CircleDot,
  Download,
  Plus,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";

import { fadeUp, reducedFade } from "@/components/motion/motion-presets";
import { CreateIssueDialog } from "@/components/project/CreateIssueDialog";
import { TodoImportDialog } from "@/components/project/TodoImportDialog";
import {
  bulkDeleteTodos,
  bulkSetTodoDone,
  clearCompletedTodos,
  createTodo,
  deleteTodo,
  toggleTodo,
  undoTodoImport,
} from "@/lib/actions";
import type { TodoRow } from "@/lib/db";
import { formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

type Priority = TodoRow["priority"];

const PRIORITY_DOT: Record<Priority, string> = {
  high: "bg-error",
  normal: "bg-info",
  low: "bg-base-content/25",
};

const PRIORITY_LABEL_KEY: Record<Priority, string> = {
  high: "todos.priorityHighLabel",
  normal: "todos.priorityNormalLabel",
  low: "todos.priorityLowLabel",
};

/** Uzun listelerde DOM'u ve layout animasyonlarini sinirli tutuyoruz. */
const PAGE_SIZE = 50;

export function TodosPanel({
  repoId,
  repoFullName,
  repoIsPrivate,
  todos,
}: {
  repoId: number;
  repoFullName: string;
  repoIsPrivate: boolean;
  todos: TodoRow[];
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const t = useT();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [lastImport, setLastImport] = useState<{ batch: string; added: number } | null>(
    null,
  );

  const [issueTodo, setIssueTodo] = useState<{ id: number; title: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [limit, setLimit] = useState(PAGE_SIZE);

  const open = useMemo(() => todos.filter((todo) => !todo.done), [todos]);
  const done = useMemo(() => todos.filter((todo) => todo.done), [todos]);
  const ratio = todos.length > 0 ? (done.length / todos.length) * 100 : 0;

  const shown = open.slice(0, limit);
  const hidden = open.length - shown.length;
  /** Liste uzunken layout animasyonu takilmaya yol aciyor. */
  const animate = !reduced && open.length <= 60;

  useEffect(() => {
    if (!message || lastImport) return;
    const timer = setTimeout(() => setMessage(null), 4500);
    return () => clearTimeout(timer);
  }, [message, lastImport]);

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;

    run(async () => {
      await createTodo(repoId, title, priority);
      setTitle("");
      setPriority("normal");
    });
  }

  function togglePick(id: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setPicked(new Set());
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AnimatePresence mode="wait">
          {message ? (
            <motion.p
              key={message.text}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="status"
              aria-live="polite"
              className={`flex items-center gap-2 text-[12.5px] ${
                message.ok ? "text-success" : "text-warning"
              }`}
            >
              {message.text}
              {lastImport ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs font-normal text-base-content/60"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const result = await undoTodoImport(repoId, lastImport.batch);
                      setLastImport(null);
                      setMessage({
                        ok: true,
text: t("todos.undone", { count: result.removed }),
                      });
                    })
                  }
                >
                  <Undo2 className="size-3.5" aria-hidden="true" />
                  {t("common.undo")}
                </button>
              ) : null}
            </motion.p>
          ) : (
            <span key="empty" className="text-[12.5px] text-base-content/40">
              {t("todos.importHint")}
            </span>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-1">
          {open.length > 1 ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs font-normal text-base-content/60"
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            >
              <CheckSquare className="size-3.5" aria-hidden="true" />
              {selectMode ? t("todos.bulkEditDone") : t("todos.bulkEdit")}
            </button>
          ) : null}

          <button
            type="button"
            className="btn btn-ghost btn-xs font-normal text-base-content/60"
            onClick={() => setImportOpen(true)}
            disabled={pending}
            title={t("todos.importButtonTitle")}
          >
            <Download className="size-3.5" aria-hidden="true" />
            {t("todos.importButton")}
          </button>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="flex items-center gap-2 rounded-box border border-base-300 bg-base-100 px-2 py-2 transition-colors focus-within:border-base-content/25"
      >
        <input
          className="min-w-0 flex-1 bg-transparent px-2 text-[13.5px] outline-none placeholder:text-base-content/40"
          placeholder={t("todos.newPlaceholder")}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label={t("todos.newAria")}
        />
        <select
          className="select select-xs h-7 w-28 border-base-300 bg-base-200 text-[12px]"
          value={priority}
          onChange={(event) => setPriority(event.target.value as Priority)}
          aria-label={t("todos.priorityAria")}
        >
          <option value="high">{t("todos.priorityHigh")}</option>
          <option value="normal">{t("todos.priorityNormal")}</option>
          <option value="low">{t("todos.priorityLow")}</option>
        </select>
        <button
          type="submit"
          className="btn btn-primary btn-xs h-7"
          disabled={pending || !title.trim()}
        >
          {pending ? (
            <span className="loading loading-spinner loading-xs" aria-hidden="true" />
          ) : (
            <Plus className="size-3.5" aria-hidden="true" />
          )}
          {t("todos.add")}
        </button>
      </form>

      {todos.length > 0 ? (
        <div className="flex items-center gap-3">
          <div
            className="h-1 flex-1 overflow-hidden rounded-full bg-base-300"
            role="progressbar"
            aria-valuenow={Math.round(ratio)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("todos.progressAria")}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                open.length === 0 ? "bg-success" : "bg-primary"
              }`}
              style={{ width: `${ratio}%` }}
            />
          </div>
          <span className="tabular shrink-0 text-[11.5px] text-base-content/45">
            {done.length}/{todos.length}
          </span>
        </div>
      ) : null}

      {selectMode ? (
        <div className="flex flex-wrap items-center gap-2 rounded-box border border-base-300 bg-base-100 px-3 py-2">
          <span className="tabular text-[12.5px]">
            {t("todos.selectedCount", { count: picked.size })}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-xs font-normal text-base-content/60"
            onClick={() => setPicked(new Set(shown.map((todo) => todo.id)))}
          >
            {t("todos.selectVisible")}
          </button>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-xs font-normal"
              disabled={pending || picked.size === 0}
              onClick={() =>
                run(async () => {
                  const result = await bulkSetTodoDone([...picked], true);
                  setMessage({
                    ok: true,
text: t("todos.bulkDone", { count: result.changed }),
                  });
                  exitSelectMode();
                })
              }
            >
              {t("todos.markDone")}
            </button>
            <button
              type="button"
              className="btn btn-error btn-xs"
              disabled={pending || picked.size === 0}
              onClick={() =>
                run(async () => {
                  const result = await bulkDeleteTodos([...picked]);
setMessage({ ok: true, text: t("todos.bulkDeleted", { count: result.changed }) });
                  exitSelectMode();
                })
              }
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              {t("common.delete")}
            </button>
          </div>
        </div>
      ) : null}

      {todos.length === 0 ? (
        <p className="rounded-box border border-dashed border-base-300 px-4 py-16 text-center text-[13px] text-base-content/45">
          {t("todos.empty")}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-box border border-base-300 bg-base-100">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((todo) => (
              <motion.li
                key={todo.id}
                layout={animate}
                variants={reduced ? reducedFade : fadeUp}
                initial="hidden"
                animate="show"
                exit="exit"
                className="group flex items-center gap-3 border-b border-base-300 px-4 py-2.5 transition-colors last:border-b-0 hover:bg-base-content/[0.025]"
              >
                {selectMode ? (
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={picked.has(todo.id)}
                    onChange={() => togglePick(todo.id)}
                    aria-label={t("todos.selectAria", { title: todo.title })}
                  />
                ) : (
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs checkbox-primary"
                    checked={false}
                    onChange={() => run(() => toggleTodo(todo.id))}
                    aria-label={t("todos.completeAria", { title: todo.title })}
                  />
                )}

                <span
                  className={`size-1.5 shrink-0 rounded-full ${PRIORITY_DOT[todo.priority]}`}
                  title={t(PRIORITY_LABEL_KEY[todo.priority])}
                  aria-label={t(PRIORITY_LABEL_KEY[todo.priority])}
                />
                <span className="min-w-0 flex-1 truncate text-[13.5px]">
                  {todo.title}
                </span>

                {todo.issue_number && todo.issue_url ? (
                  <a
                    href={todo.issue_url}
                    target="_blank"
                    rel="noreferrer"
                    className="tabular shrink-0 rounded-selector border border-base-300 px-1.5 font-mono text-[11px] text-base-content/50 transition-colors hover:border-base-content/25 hover:text-base-content"
                    title={t("todos.linkedIssue")}
                  >
                    #{todo.issue_number}
                  </a>
                ) : selectMode ? null : (
                  <button
                    type="button"
                    className="row-actions btn btn-ghost btn-xs btn-square text-base-content/40 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-success"
                    onClick={() => setIssueTodo({ id: todo.id, title: todo.title })}
                    aria-label={t("todos.issueAria", { title: todo.title })}
                    title={t("todos.issueTitle")}
                  >
                    <CircleDot className="size-3.5" aria-hidden="true" />
                  </button>
                )}

                <span className="hidden shrink-0 text-[11.5px] text-base-content/35 sm:inline">
                  {formatRelative(todo.created_at, locale)}
                </span>

                {selectMode ? null : (
                  <button
                    type="button"
                    className="row-actions btn btn-ghost btn-xs btn-square text-base-content/40 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-error"
                    onClick={() => run(() => deleteTodo(todo.id))}
                    aria-label={t("todos.deleteAria", { title: todo.title })}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>

          {hidden > 0 ? (
            <li className="border-t border-base-300">
              <button
                type="button"
                className="btn btn-ghost btn-sm w-full font-normal text-base-content/60"
                onClick={() => setLimit((value) => value + PAGE_SIZE)}
              >
                {t("todos.showMore", { count: hidden })}
              </button>
            </li>
          ) : null}

          {open.length === 0 ? (
            <li className="px-4 py-10 text-center text-[13px] text-base-content/45">
              {t("todos.allDone")}
            </li>
          ) : null}
        </ul>
      )}

      {done.length > 0 ? (
        <details className="group rounded-box border border-base-300 bg-base-100">
          <summary className="flex list-none items-center justify-between px-4 py-2.5 text-[13px] text-base-content/55 [&::-webkit-details-marker]:hidden">
            <span>
              {t("todos.completedTitle")}{" "}
              <span className="tabular text-base-content/35">{done.length}</span>
            </span>

            {confirmClear ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn btn-error btn-xs"
                  disabled={pending}
                  onClick={(event) => {
                    event.preventDefault();
                    run(async () => {
                      await clearCompletedTodos(repoId);
                      setConfirmClear(false);
                    });
                  }}
                >
                  {t("todos.deleteAllCompleted")}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs font-normal"
                  onClick={(event) => {
                    event.preventDefault();
                    setConfirmClear(false);
                  }}
                >
                  {t("common.cancel")}
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-xs font-normal text-base-content/45"
                onClick={(event) => {
                  event.preventDefault();
                  setConfirmClear(true);
                }}
              >
                {t("common.clear")}
              </button>
            )}
          </summary>

          <ul className="border-t border-base-300">
            {done.slice(0, PAGE_SIZE).map((todo) => (
              <li
                key={todo.id}
                className="group/item flex items-center gap-3 border-b border-base-300 px-4 py-2 last:border-b-0"
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  checked
                  onChange={() => run(() => toggleTodo(todo.id))}
                  aria-label={t("todos.reopenAria", { title: todo.title })}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-base-content/40 line-through">
                  {todo.title}
                </span>
                <span className="shrink-0 text-[11.5px] text-base-content/30">
                  {formatRelative(todo.completed_at, locale)}
                </span>
                <button
                  type="button"
                  className="row-actions btn btn-ghost btn-xs btn-square text-base-content/40 group-hover/item:opacity-100"
                  onClick={() => run(() => toggleTodo(todo.id))}
                  aria-label={t("todos.reopenAria", { title: todo.title })}
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}

            {done.length > PAGE_SIZE ? (
              <li className="px-4 py-2 text-center text-[11.5px] text-base-content/35">
                {t("todos.moreCompleted", { count: done.length - PAGE_SIZE })}
              </li>
            ) : null}
          </ul>
        </details>
      ) : null}

      <TodoImportDialog
        repoId={repoId}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(result) => {
          setLastImport({ batch: result.batch, added: result.added });
          setMessage({ ok: true, text: result.message });
        }}
      />

      <CreateIssueDialog
        key={issueTodo?.id ?? "closed"}
        todo={issueTodo}
        repoFullName={repoFullName}
        repoIsPrivate={repoIsPrivate}
        onClose={() => setIssueTodo(null)}
        onDone={(result) => setMessage({ ok: result.ok, text: result.message })}
      />
    </div>
  );
}
