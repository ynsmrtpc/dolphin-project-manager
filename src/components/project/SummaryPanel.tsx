"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookText,
  ChevronDown,
  Download,
  Pencil,
  Trash2,
} from "lucide-react";

import { importReadmeSummary, updateSummary } from "@/lib/actions";
import { formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

export function SummaryPanel({
  repoId,
  summary,
  source,
  updatedAt,
}: {
  repoId: number;
  summary: string | null;
  source: string | null;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const t = useT();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary ?? "");
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  function importReadme() {
    startTransition(async () => {
      const result = await importReadmeSummary(repoId);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) {
        setEditing(false);
        setExpanded(false);
      }
      router.refresh();
    });
  }

  function save() {
    startTransition(async () => {
      await updateSummary(repoId, draft);
      setEditing(false);
      setMessage({ ok: true, text: t("summary.saved") });
      router.refresh();
    });
  }

  const hasSummary = Boolean(summary && summary.trim());

  return (
    <section className="rounded-box border border-base-300 bg-base-100">
      <header className="flex flex-wrap items-center gap-2 border-b border-base-300 px-4 py-2.5">
        <BookText
          className="size-3.5 text-base-content/45"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <h2 className="text-[13px] font-medium">{t("summary.title")}</h2>

        {source ? (
          <span className="text-[11.5px] text-base-content/40">
            {source === "manual" ? t("summary.manual") : source}
            {updatedAt ? ` · ${formatRelative(updatedAt, locale)}` : ""}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="btn btn-ghost btn-xs font-normal text-base-content/60"
            onClick={importReadme}
            disabled={pending}
title={t("summary.importReadmeTitle")}
          >
            {pending ? (
              <span className="loading loading-spinner loading-xs" aria-hidden="true" />
            ) : (
              <Download className="size-3.5" aria-hidden="true" />
            )}
            {t("summary.importReadme")}
          </button>

          {editing ? null : (
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square text-base-content/45"
              onClick={() => {
                setDraft(summary ?? "");
                setEditing(true);
              }}
aria-label={t("summary.editAria")}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </button>
          )}

          {hasSummary && !editing ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square text-base-content/45 hover:text-error"
              onClick={() =>
                startTransition(async () => {
                  await updateSummary(repoId, "");
                  setDraft("");
                  router.refresh();
                })
              }
              disabled={pending}
aria-label={t("summary.clearAria")}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </header>

      <AnimatePresence>
        {message ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="status"
            aria-live="polite"
            className={`border-b border-base-300 px-4 py-2 text-[12.5px] ${
              message.ok ? "text-success" : "text-warning"
            }`}
          >
            {message.text}
          </motion.p>
        ) : null}
      </AnimatePresence>

      {editing ? (
        <div className="p-4">
          <textarea
            className="textarea textarea-sm min-h-48 w-full font-mono text-[12.5px] leading-relaxed"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
placeholder={t("summary.placeholder")}
aria-label={t("summary.inputAria")}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11.5px] text-base-content/40">
              {t("summary.markdownHint")}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn btn-ghost btn-xs font-normal text-base-content/60"
                onClick={() => {
                  setEditing(false);
                  setDraft(summary ?? "");
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={save}
                disabled={pending}
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      ) : !hasSummary ? (
        <p className="px-4 py-8 text-center text-[12.5px] text-base-content/45">
          {t("summary.empty")}
        </p>
      ) : (
        <div className="relative">
          <div
            className={`markdown px-4 py-4 ${
              expanded ? "" : "max-h-72 overflow-hidden"
            }`}
          >
            <Markdown remarkPlugins={[remarkGfm]}>{summary}</Markdown>
          </div>

          {!expanded ? (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-base-100 to-transparent"
              aria-hidden="true"
            />
          ) : null}

          <div className="flex justify-center border-t border-base-300">
            <button
              type="button"
              className="btn btn-ghost btn-xs w-full gap-1.5 font-normal text-base-content/55"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              {expanded ? t("summary.collapse") : t("summary.expand")}
              <motion.span
                animate={reduced ? undefined : { rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.18 }}
                className="inline-flex"
              >
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </motion.span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
