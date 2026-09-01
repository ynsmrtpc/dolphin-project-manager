"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Archive, Check, Lock, Search, Star, Trash2 } from "lucide-react";

import { fadeUp, reducedFade } from "@/components/motion/motion-presets";
import { saveSelectedRepos, type SelectableRepo } from "@/lib/actions";
import { formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { languageColor } from "@/lib/languages";

export type RepoMeta = {
  githubRepoId: number;
  fullName: string;
  notes: number;
  todos: number;
  archived: boolean;
};

type Filter = "all" | "public" | "private" | "selected";

const FILTER_KEYS: Filter[] = ["all", "public", "private", "selected"];

function sameSet(a: Set<number>, b: Set<number>) {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

export function RepoPicker({
  repos,
  initialSelectedIds,
  meta,
}: {
  repos: SelectableRepo[];
  initialSelectedIds: number[];
  meta: RepoMeta[];
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const t = useT();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [saved, setSaved] = useState<Set<number>>(() => new Set(initialSelectedIds));
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initialSelectedIds));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [toast, setToast] = useState<string | null>(null);

  const dirty = !sameSet(selected, saved);

  const metaById = useMemo(
    () => new Map(meta.map((item) => [item.githubRepoId, item])),
    [meta],
  );

  /** Kaydedilirse verisine dokunulacak depolar. */
  const removals = useMemo(
    () =>
      [...saved]
        .filter((id) => !selected.has(id))
        .map((id) => {
          const info = metaById.get(id);
          const notes = info?.notes ?? 0;
          const todos = info?.todos ?? 0;
          return {
            id,
            fullName:
              info?.fullName ??
              repos.find((repo) => repo.github_repo_id === id)?.full_name ??
              String(id),
            notes,
            todos,
            willArchive: notes + todos > 0,
          };
        }),
    [saved, selected, metaById, repos],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(locale);
    return repos.filter((repo) => {
      if (filter === "public" && repo.is_private) return false;
      if (filter === "private" && !repo.is_private) return false;
      if (filter === "selected" && !selected.has(repo.github_repo_id)) return false;
      if (!q) return true;
      return (
        repo.full_name.toLocaleLowerCase(locale).includes(q) ||
        (repo.description ?? "").toLocaleLowerCase(locale).includes(q)
      );
    });
  }, [repos, query, filter, selected, locale]);

  const counts = useMemo(
    () => ({
      all: repos.length,
      public: repos.filter((repo) => !repo.is_private).length,
      private: repos.filter((repo) => repo.is_private).length,
      selected: selected.size,
    }),
    [repos, selected],
  );

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function attemptSave() {
    // Veriye dokunan bir cikarma varsa once onay iste.
    if (removals.length > 0) {
      dialogRef.current?.showModal();
      return;
    }
    save();
  }

  function save() {
    const payload = repos.filter((repo) => selected.has(repo.github_repo_id));

    startTransition(async () => {
      const result = await saveSelectedRepos(payload);
      setSaved(new Set(selected));
      dialogRef.current?.close();

      const parts = [t("repos.savedToast", { count: payload.length })];
      if (result.archived > 0) {
        parts.push(t("repos.archivedToast", { count: result.archived }));
      }
      setToast(parts.join(" · "));

      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 pb-20">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="input input-sm h-8 w-full bg-base-100 text-[13px] lg:max-w-sm">
          <Search className="size-3.5 opacity-45" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("repos.searchPlaceholder")}
            aria-label={t("repos.searchAria")}
          />
        </label>

        <div className="join">
          {FILTER_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`btn btn-xs join-item h-8 gap-1.5 border-base-300 text-[12.5px] font-normal ${
                filter === key
                  ? "bg-base-content/[0.07] font-medium"
                  : "bg-base-100 text-base-content/60"
              }`}
            >
              {key === "all"
                ? t("common.all")
                : key === "public"
                  ? t("common.public")
                  : key === "private"
                    ? t("common.private")
                    : t("repos.filterSelected")}
              <span className="tabular text-base-content/35">{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-0.5">
        <p className="tabular text-[12.5px] text-base-content/50">
          {t("repos.selectedCount", { selected: selected.size, total: repos.length })}
        </p>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-ghost btn-xs font-normal text-base-content/60"
            onClick={() =>
              setSelected((prev) => {
                const next = new Set(prev);
                for (const repo of visible) next.add(repo.github_repo_id);
                return next;
              })
            }
            disabled={visible.length === 0}
          >
            {t("repos.selectVisible")}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs font-normal text-base-content/60"
            onClick={() => setSelected(new Set())}
            disabled={selected.size === 0}
          >
            {t("common.clear")}
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-box border border-base-300 bg-base-100 px-4 py-16 text-center text-[13px] text-base-content/50">
          {t("repos.emptyFilter")}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-box border border-base-300 bg-base-100">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((repo) => {
              const checked = selected.has(repo.github_repo_id);
              const info = metaById.get(repo.github_repo_id);
              const stored = (info?.notes ?? 0) + (info?.todos ?? 0);

              return (
                <motion.li
                  key={repo.github_repo_id}
                  layout={!reduced}
                  variants={reduced ? reducedFade : fadeUp}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="border-b border-base-300 last:border-b-0"
                >
                  <label
                    className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                      checked ? "bg-accent/[0.08]" : "hover:bg-base-content/[0.025]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs checkbox-primary mt-0.5"
                      checked={checked}
                      onChange={() => toggle(repo.github_repo_id)}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[13.5px]">
                          <span className="text-base-content/40">{repo.owner}/</span>
                          <span className="font-medium">{repo.name}</span>
                        </span>
                        {repo.is_private ? (
                          <Lock
                            className="size-3 shrink-0 text-base-content/35"
                            aria-label={t("common.privateRepo")}
                          />
                        ) : null}

                        {info?.archived ? (
                          <span className="tabular flex items-center gap-1 rounded-selector bg-base-200 px-1.5 py-0.5 text-[10.5px] text-base-content/60">
                            <Archive className="size-2.5" aria-hidden="true" />
                            {t("repos.archivedBadge", { count: stored })}
                          </span>
                        ) : stored > 0 ? (
                          <span className="tabular rounded-selector bg-base-200 px-1.5 py-0.5 text-[10.5px] text-base-content/55">
                            {t("repos.dataBadge", {
                              notes: info?.notes ?? 0,
                              todos: info?.todos ?? 0,
                            })}
                          </span>
                        ) : null}
                      </div>

                      {repo.description ? (
                        <p className="mt-0.5 truncate text-[12px] text-base-content/50">
                          {repo.description}
                        </p>
                      ) : null}

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11.5px] text-base-content/45">
                        {repo.language ? (
                          <span className="flex items-center gap-1.5">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: languageColor(repo.language) }}
                              aria-hidden="true"
                            />
                            {repo.language}
                          </span>
                        ) : null}
                        {repo.stars > 0 ? (
                          <span className="tabular flex items-center gap-1">
                            <Star className="size-3" aria-hidden="true" />
                            {repo.stars}
                          </span>
                        ) : null}
                        <span>{formatRelative(repo.pushed_at, locale)}</span>
                      </div>
                    </div>
                  </label>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {/* Degisiklik varken beliren kaydetme cubugu. */}
      <AnimatePresence>
        {dirty ? (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4"
          >
            <div className="flex items-center gap-4 rounded-box border border-base-300 bg-base-100 py-2 pl-4 pr-2 shadow-lg">
              <p className="tabular text-[13px] text-base-content/70">
                {t("repos.unsavedBar", { count: selected.size })}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm font-normal text-base-content/60"
                  onClick={() => setSelected(new Set(saved))}
                  disabled={pending}
                >
                  {t("common.undo")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={attemptSave}
                  disabled={pending}
                >
                  {pending ? (
                    <span className="loading loading-spinner loading-xs" aria-hidden="true" />
                  ) : null}
                  {t("common.save")}
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-lg overflow-hidden border border-base-300 bg-base-100 p-0">
          <header className="border-b border-base-300 px-5 py-4">
            <h2 className="text-[15px] font-semibold">
              {t("repos.confirmTitle", { count: removals.length })}
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-base-content/55">
              {t("repos.confirmBody")}
            </p>
          </header>

          <ul className="max-h-64 overflow-y-auto">
            {removals.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 border-b border-base-300 px-5 py-2.5 last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-[12px]">
                  {item.fullName}
                </span>

                {item.willArchive ? (
                  <>
                    <span className="tabular shrink-0 text-[11.5px] text-base-content/50">
                      {t("repos.dataBadge", { notes: item.notes, todos: item.todos })}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[11.5px] text-warning">
                      <Archive className="size-3" aria-hidden="true" />
                      {t("repos.confirmArchive")}
                    </span>
                  </>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 text-[11.5px] text-base-content/40">
                    <Trash2 className="size-3" aria-hidden="true" />
                    {t("repos.confirmNoData")}
                  </span>
                )}
              </li>
            ))}
          </ul>

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
              onClick={save}
              disabled={pending}
            >
              {pending ? (
                <span className="loading loading-spinner loading-xs" aria-hidden="true" />
              ) : null}
              {t("repos.confirmAccept")}
            </button>
          </footer>
        </div>

        <form method="dialog" className="modal-backdrop">
          <button aria-label={t("common.close")}>{t("common.close")}</button>
        </form>
      </dialog>

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-5 right-5 z-50"
          >
            <p
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 rounded-box border border-base-300 bg-base-100 px-3.5 py-2 text-[13px] shadow-lg"
            >
              <Check className="size-3.5 text-success" aria-hidden="true" />
              {toast}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
