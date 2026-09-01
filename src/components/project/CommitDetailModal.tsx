"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, FileDiff, X } from "lucide-react";

import { formatDateTime, formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

type CommitFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string | null;
  truncated: boolean;
  blob_url: string | null;
};

export type CommitDetail = {
  sha: string;
  html_url: string;
  message: string;
  author: {
    name: string | null;
    email: string | null;
    date: string | null;
    login: string | null;
    avatar_url: string | null;
  };
  committerLogin: string | null;
  parents: { sha: string; html_url: string }[];
  stats: { additions: number; deletions: number; total: number };
  files: CommitFile[];
  fileCount: number;
};

const STATUS_TONE: Record<string, string> = {
  added: "text-success",
  removed: "text-error",
  renamed: "text-info",
};

export function CommitDetailModal({
  repoId,
  sha,
  onClose,
}: {
  repoId: number;
  sha: string | null;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<CommitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!sha) {
      if (dialog.open) dialog.close();
      return;
    }

    if (!dialog.open) dialog.showModal();

    const controller = new AbortController();

    fetch(`/api/projects/${repoId}/commits/${sha}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as CommitDetail;
      })
      .then(setDetail)
      .catch((cause) => {
        if (controller.signal.aborted) return;
        console.error(cause);
setError(t("commitDetail.loadError"));
      });

    return () => controller.abort();
  }, [repoId, sha, t]);

  const [subject, ...rest] = (detail?.message ?? "").split("\n");
  const body = rest.join("\n").trim();

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box max-w-3xl overflow-hidden border border-base-300 bg-base-100 p-0">
        <header className="flex items-start justify-between gap-3 border-b border-base-300 px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-[11.5px] text-base-content/45">
              {sha?.slice(0, 12)}
            </p>
            <h2 className="mt-1 text-[15px] font-semibold leading-snug">
              {detail ? subject : t("commitDetail.title")}
            </h2>
          </div>

          <form method="dialog">
            <button
              className="btn btn-ghost btn-xs btn-square text-base-content/45"
aria-label={t("common.close")}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </form>
        </header>

        <div className="max-h-[70vh] overflow-y-auto">
          {error ? (
            <p className="px-5 py-12 text-center text-[13px] text-error">{error}</p>
          ) : !detail ? (
            <div className="flex flex-col gap-3 px-5 py-6">
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-3 w-1/3" />
              <div className="skeleton h-24 w-full" />
            </div>
          ) : (
            <>
              <div className="border-b border-base-300 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2.5 text-[12.5px]">
                  {detail.author.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={detail.author.avatar_url}
                      alt=""
                      width={20}
                      height={20}
                      className="size-5 rounded-full ring-1 ring-base-300"
                    />
                  ) : null}
                  <span className="font-medium">
                    {detail.author.login ?? detail.author.name ?? t("common.unknown")}
                  </span>
                  <span className="text-base-content/30" aria-hidden="true">
                    ·
                  </span>
                  <time
                    className="text-base-content/50"
                    title={formatDateTime(detail.author.date, locale)}
                  >
                    {formatRelative(detail.author.date, locale)}
                  </time>
                  {detail.committerLogin &&
                  detail.committerLogin !== detail.author.login ? (
                    <span className="text-base-content/45">
                      {t("commitDetail.committedBy", { login: detail.committerLogin })}
                    </span>
                  ) : null}
                </div>

                {body ? (
                  <pre className="mt-3 whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-base-content/60">
                    {body}
                  </pre>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
                  <span className="tabular flex items-center gap-1.5 text-base-content/55">
                    <FileDiff className="size-3.5" aria-hidden="true" />
                    {t("commitDetail.fileCount", { count: detail.fileCount })}
                  </span>
                  <span className="tabular text-success">
                    +{detail.stats.additions}
                  </span>
                  <span className="tabular text-error">-{detail.stats.deletions}</span>

                  {detail.parents.length > 0 ? (
                    <span className="flex items-center gap-1.5 text-base-content/45">
                      {t("commitDetail.parents")}
                      {detail.parents.map((parent) => (
                        <a
                          key={parent.sha}
                          href={parent.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono hover:text-base-content"
                        >
                          {parent.sha.slice(0, 7)}
                        </a>
                      ))}
                    </span>
                  ) : null}

                  <a
                    href={detail.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto flex items-center gap-1 text-base-content/55 hover:text-base-content"
                  >
                    {t("common.github")}
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                  </a>
                </div>
              </div>

              {detail.files.length === 0 ? (
                <p className="px-5 py-10 text-center text-[13px] text-base-content/45">
                  {t("commitDetail.noFiles")}
                </p>
              ) : (
                <ul>
                  {detail.files.map((file) => {
                    const expanded = openFile === file.filename;

                    return (
                      <li key={file.filename} className="border-b border-base-300 last:border-b-0">
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-base-content/[0.03]"
                          onClick={() =>
                            setOpenFile(expanded ? null : file.filename)
                          }
                          aria-expanded={expanded}
                        >
                          <span className="min-w-0 flex-1 truncate font-mono text-[12px]">
                            {file.filename}
                          </span>
                          <span
                            className={`shrink-0 text-[11px] ${STATUS_TONE[file.status] ?? "text-base-content/40"}`}
                          >
                            {t(`commitDetail.status.${file.status}`) === `commitDetail.status.${file.status}`
                              ? file.status
                              : t(`commitDetail.status.${file.status}`)}
                          </span>
                          <span className="tabular shrink-0 text-[11.5px] text-success">
                            +{file.additions}
                          </span>
                          <span className="tabular shrink-0 text-[11.5px] text-error">
                            -{file.deletions}
                          </span>
                        </button>

                        {expanded ? (
                          file.patch ? (
                            <div className="overflow-x-auto border-t border-base-300 bg-base-200">
                              <pre className="min-w-full py-2 font-mono text-[11.5px] leading-[1.6]">
                                {file.patch.split("\n").map((line, index) => (
                                  <span
                                    key={index}
                                    className={`block px-5 ${
                                      line.startsWith("+") && !line.startsWith("+++")
                                        ? "bg-success/10 text-success"
                                        : line.startsWith("-") && !line.startsWith("---")
                                          ? "bg-error/10 text-error"
                                          : line.startsWith("@@")
                                            ? "text-info"
                                            : "text-base-content/60"
                                    }`}
                                  >
                                    {line || " "}
                                  </span>
                                ))}
                              </pre>
                              {file.truncated ? (
                                <p className="px-5 py-2 text-[11.5px] text-base-content/45">
                                  {t("commitDetail.patchTruncated")}{" "}
                                  {file.blob_url ? (
                                    <a
                                      href={file.blob_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="underline"
                                    >
                                      {t("commitDetail.seeOnGithub")}
                                    </a>
                                  ) : (
t("commitDetail.fullOnGithub")
                                  )}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="border-t border-base-300 bg-base-200 px-5 py-3 text-[12px] text-base-content/45">
                              {t("commitDetail.noTextDiff")}
                            </p>
                          )
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      <form method="dialog" className="modal-backdrop">
<button aria-label={t("common.close")}>{t("common.close")}</button>
      </form>
    </dialog>
  );
}
