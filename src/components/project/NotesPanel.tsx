"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pencil, Pin, PinOff, Trash2 } from "lucide-react";

import { fadeUp, reducedFade } from "@/components/motion/motion-presets";
import { createNote, deleteNote, toggleNotePin, updateNote } from "@/lib/actions";
import type { NoteRow } from "@/lib/db";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

export function NotesPanel({ repoId, notes }: { repoId: number; notes: NoteRow[] }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const t = useT();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() && !content.trim()) return;

    run(async () => {
      await createNote(repoId, title, content);
      setTitle("");
      setContent("");
      setExpanded(false);
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <form
        onSubmit={submit}
        className="rounded-box border border-base-300 bg-base-100 transition-colors focus-within:border-base-content/25"
      >
        <input
          className="w-full bg-transparent px-4 py-3 text-[13.5px] outline-none placeholder:text-base-content/40"
          placeholder={t("notes.titlePlaceholder")}
          value={title}
          onFocus={() => setExpanded(true)}
          onChange={(event) => setTitle(event.target.value)}
          aria-label={t("notes.titleAria")}
        />

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="border-t border-base-300 px-4 pb-3 pt-3">
                <textarea
                  className="min-h-28 w-full resize-y bg-transparent text-[13px] leading-relaxed outline-none placeholder:text-base-content/40"
                  placeholder={t("notes.bodyPlaceholder")}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  aria-label={t("notes.bodyAria")}
                />

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11.5px] text-base-content/40">
                    {t("notes.markdownHint")}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs font-normal text-base-content/60"
                      onClick={() => {
                        setExpanded(false);
                        setTitle("");
                        setContent("");
                      }}
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-xs"
                      disabled={pending || (!title.trim() && !content.trim())}
                    >
                      {pending ? (
                        <span
                          className="loading loading-spinner loading-xs"
                          aria-hidden="true"
                        />
                      ) : null}
                      {t("common.save")}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </form>

      {notes.length === 0 ? (
        <p className="rounded-box border border-dashed border-base-300 px-4 py-16 text-center text-[13px] text-base-content/45">
          {t("notes.empty")}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-box border border-base-300 bg-base-100">
          <AnimatePresence initial={false} mode="popLayout">
            {notes.map((note) => (
              <motion.li
                key={note.id}
                layout={!reduced}
                variants={reduced ? reducedFade : fadeUp}
                initial="hidden"
                animate="show"
                exit="exit"
                className="group relative border-b border-base-300 px-4 py-3.5 last:border-b-0"
              >
                {note.pinned ? (
                  <span
                    className="absolute inset-y-0 left-0 w-0.5 bg-accent"
                    aria-hidden="true"
                  />
                ) : null}

                {editingId === note.id ? (
                  <div className="flex flex-col gap-2">
                    <input
                      className="input input-sm w-full text-[13.5px]"
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      aria-label={t("notes.titleAria")}
                    />
                    <textarea
                      className="textarea textarea-sm min-h-28 w-full text-[13px] leading-relaxed"
                      value={editContent}
                      onChange={(event) => setEditContent(event.target.value)}
                      aria-label={t("notes.bodyAria")}
                    />
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs font-normal text-base-content/60"
                        onClick={() => setEditingId(null)}
                      >
                        {t("common.cancel")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-xs"
                        disabled={pending}
                        onClick={() =>
                          run(async () => {
                            await updateNote(note.id, editTitle, editContent);
                            setEditingId(null);
                          })
                        }
                      >
                        {t("common.save")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="flex items-center gap-1.5 text-[13.5px] font-medium leading-snug">
                        {note.pinned ? (
                          <Pin
                            className="size-3 shrink-0 text-accent"
                            aria-label={t("notes.pinned")}
                          />
                        ) : null}
                        {note.title}
                      </h3>

                      <div className="flex shrink-0 items-center gap-2">
                        {confirmId === note.id ? (
                          <span className="flex items-center gap-1">
                            <button
                              type="button"
                              className="btn btn-error btn-xs"
                              disabled={pending}
                              onClick={() =>
                                run(async () => {
                                  await deleteNote(note.id);
                                  setConfirmId(null);
                                })
                              }
                            >
                              {t("common.delete")}
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs font-normal text-base-content/60"
                              onClick={() => setConfirmId(null)}
                            >
                              {t("common.cancel")}
                            </button>
                          </span>
                        ) : (
                          <span className="row-actions flex items-center gap-0.5 group-focus-within:opacity-100 group-hover:opacity-100">
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs btn-square text-base-content/45"
                              title={note.pinned ? t("notes.unpin") : t("notes.pin")}
                              aria-label={
note.pinned ? t("notes.unpin") : t("notes.pin")
                              }
                              onClick={() => run(() => toggleNotePin(note.id))}
                            >
                              {note.pinned ? (
                                <PinOff className="size-3.5" aria-hidden="true" />
                              ) : (
                                <Pin className="size-3.5" aria-hidden="true" />
                              )}
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs btn-square text-base-content/45"
                              aria-label={t("notes.editAria")}
                              onClick={() => {
                                setConfirmId(null);
                                setEditingId(note.id);
                                setEditTitle(note.title);
                                setEditContent(note.content);
                              }}
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs btn-square text-base-content/45 hover:text-error"
                              aria-label={t("notes.deleteAria")}
                              onClick={() => setConfirmId(note.id)}
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          </span>
                        )}

                        <time
                          className="shrink-0 text-[11.5px] text-base-content/35"
                          title={formatDateTime(note.updated_at, locale)}
                        >
                          {formatRelative(note.updated_at, locale)}
                        </time>
                      </div>
                    </div>

                    {note.content ? (
                      <div className="markdown mt-1.5">
                        <Markdown remarkPlugins={[remarkGfm]}>{note.content}</Markdown>
                      </div>
                    ) : null}
                  </>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
