"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  CircleDot,
  FolderGit2,
  GitPullRequest,
  Lock,
  NotebookPen,
  Search,
} from "lucide-react";

import type { SearchResults } from "@/app/api/search/route";
import { useT } from "@/lib/i18n/client";

type Item = {
  key: string;
  href: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  trailing?: React.ReactNode;
  /** GitHub gibi uygulama disi hedefler yeni sekmede acilir. */
  external?: boolean;
};

const EMPTY: SearchResults = { projects: [], notes: [], todos: [], issues: [] };

export function CommandPalette() {
  const router = useRouter();
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  /* Ctrl/Cmd + K her yerden acar. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* `open` state'ini native dialog ile esitle (DOM bir dis sistem). */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      inputRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  /* Yazarken gecikmeli arama. */
  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("failed");
          return (await response.json()) as SearchResults;
        })
        .then((data) => {
          setResults(data);
          setActive(0);
          setLoading(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setResults(EMPTY);
          setLoading(false);
        });
    }, 140);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, query]);

  const groups: { title: string; items: Item[] }[] = [
    {
title: t("search.groupProjects"),
      items: results.projects.map((project) => ({
        key: `p-${project.id}`,
        href: `/projects/${project.id}`,
        label: project.name,
        hint: project.fullName,
        icon: FolderGit2,
        trailing: project.isPrivate ? (
          <Lock className="size-3 text-base-content/35" aria-hidden={true} />
        ) : null,
      })),
    },
    {
title: t("search.groupNotes"),
      items: results.notes.map((note) => ({
        key: `n-${note.id}`,
        href: `/projects/${note.repoId}?tab=notes`,
        label: note.title,
        hint: note.snippet || note.repoName,
        icon: NotebookPen,
      })),
    },
    {
title: t("search.groupIssues"),
      items: results.issues.map((issue) => ({
        key: `i-${issue.key}`,
        href: issue.htmlUrl,
        external: true,
        label: issue.title,
        hint: `${issue.repoName} · #${issue.number}`,
        icon: issue.isPull ? GitPullRequest : CircleDot,
        trailing: (
          <span className="text-[10.5px] text-base-content/35">
            {issue.state === "open" ? t("search.stateOpen") : t("search.stateClosed")}
          </span>
        ),
      })),
    },
    {
title: t("search.groupTodos"),
      items: results.todos.map((todo) => ({
        key: `t-${todo.id}`,
        href: `/projects/${todo.repoId}?tab=todos`,
        label: todo.title,
        hint: todo.repoName,
        icon: CheckSquare,
      })),
    },
  ].filter((group) => group.items.length > 0);

  const flat = groups.flatMap((group) => group.items);
  const activeIndex = flat.length === 0 ? -1 : Math.min(active, flat.length - 1);

  const go = useCallback(
    (item: Item) => {
      setOpen(false);
      if (item.external) window.open(item.href, "_blank", "noopener,noreferrer");
      else router.push(item.href);
    },
    [router],
  );

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => (flat.length === 0 ? 0 : (value + 1) % flat.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) =>
        flat.length === 0 ? 0 : (value - 1 + flat.length) % flat.length,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = flat[activeIndex];
      if (item) go(item);
    }
  }

  let cursor = -1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-2 rounded-field border border-base-300 bg-base-100 pl-2.5 pr-1.5 text-[13px] text-base-content/45 transition-colors hover:border-base-content/25 hover:text-base-content/70"
        aria-label={t("search.open")}
      >
        <Search className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">{t("common.search")}</span>
        <kbd className="kbd kbd-xs hidden sm:inline-flex">Ctrl K</kbd>
      </button>

      <dialog
        ref={dialogRef}
        className="modal modal-top sm:modal-middle"
        onClose={() => {
          setOpen(false);
          setQuery("");
          setActive(0);
        }}
      >
        <div className="modal-box max-w-xl overflow-hidden border border-base-300 bg-base-100 p-0">
          <div className="flex items-center gap-2.5 border-b border-base-300 px-4">
            <Search className="size-4 shrink-0 opacity-45" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder={t("search.placeholder")}
aria-label={t("common.search")}
              className="h-12 w-full bg-transparent text-[14px] outline-none placeholder:text-base-content/40"
            />
            {loading ? (
              <span
                className="loading loading-spinner loading-xs opacity-45"
                aria-hidden="true"
              />
            ) : null}
          </div>

          <div className="max-h-[60vh] overflow-y-auto py-2">
            {flat.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-base-content/45">
                {query ? t("search.empty") : t("search.idle")}
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.title} className="mb-1">
                  <p className="eyebrow px-4 py-1.5">{group.title}</p>
                  <ul>
                    {group.items.map((item) => {
                      cursor += 1;
                      const isActive = cursor === activeIndex;

                      return (
                        <li key={item.key}>
                          <button
                            type="button"
                            onClick={() => go(item)}
                            onMouseMove={() => setActive(flat.indexOf(item))}
                            aria-current={isActive ? "true" : undefined}
                            className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                              isActive ? "bg-base-content/[0.06]" : ""
                            }`}
                          >
                            <item.icon
                              className="size-3.5 shrink-0 text-base-content/40"
                              aria-hidden={true}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px]">
                                {item.label}
                              </span>
                              {item.hint ? (
                                <span className="block truncate text-[11.5px] text-base-content/40">
                                  {item.hint}
                                </span>
                              ) : null}
                            </span>
                            {item.trailing}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-base-300 px-4 py-2 text-[11px] text-base-content/40">
            <span className="flex items-center gap-1">
              <kbd className="kbd kbd-xs">↑</kbd>
              <kbd className="kbd kbd-xs">↓</kbd> {t("search.hintMove")}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="kbd kbd-xs">↵</kbd> {t("search.hintOpen")}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="kbd kbd-xs">esc</kbd> {t("search.hintClose")}
            </span>
          </div>
        </div>

        <form method="dialog" className="modal-backdrop">
          <button aria-label="Kapat">kapat</button>
        </form>
      </dialog>
    </>
  );
}
