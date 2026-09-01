"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CircleDot,
  GitMerge,
  GitPullRequest,
  MessageSquare,
  RefreshCw,
} from "lucide-react";

import { StaggerGroup, StaggerItem } from "@/components/motion/Reveal";
import { refreshIssues } from "@/lib/actions";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import type { IssueItem } from "@/lib/issues";

type State = "open" | "closed";

function stateHref(repoId: number, state: State) {
  const params = new URLSearchParams({ tab: "issues" });
  if (state === "closed") params.set("state", "closed");
  return `/projects/${repoId}?${params.toString()}`;
}

export function IssuesPanel({
  repoId,
  issues,
  state,
  syncedAt,
  warning,
}: {
  repoId: number;
  issues: IssueItem[];
  state: State;
  syncedAt: string | null;
  warning: string | null;
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const pulls = issues.filter((item) => item.isPull);
  const plain = issues.filter((item) => !item.isPull);

  function refresh() {
    startTransition(async () => {
      const result = await refreshIssues(repoId);
      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="join">
          {(["open", "closed"] as const).map((value) => (
            <Link
              key={value}
              href={stateHref(repoId, value)}
              scroll={false}
              aria-current={state === value ? "page" : undefined}
              className={`btn btn-xs join-item h-8 border-base-300 text-[12.5px] font-normal ${
                state === value
                  ? "bg-base-content/[0.07] font-medium"
                  : "bg-base-100 text-base-content/60"
              }`}
            >
              {value === "open" ? t("issues.stateOpen") : t("issues.stateClosed")}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11.5px] text-base-content/40">
            {message ??
              (syncedAt
                ? t("issues.syncedAt", { time: formatRelative(syncedAt, locale) })
                : t("issues.neverSynced"))}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-xs font-normal text-base-content/60"
            onClick={refresh}
            disabled={pending}
title={t("issues.refreshTitle")}
          >
            <RefreshCw
              className={`size-3.5 ${pending ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {t("common.refresh")}
          </button>
        </div>
      </div>

      {warning ? (
        <p role="status" className="text-[12.5px] text-warning">
          {warning}
        </p>
      ) : null}

      {issues.length === 0 ? (
        <p className="rounded-box border border-dashed border-base-300 px-4 py-16 text-center text-[13px] text-base-content/45">
          {state === "open"
            ? t("issues.emptyOpen")
            : t("issues.emptyClosed")}
        </p>
      ) : (
        <>
          {pulls.length > 0 ? <Section title={t("issues.sectionPulls")} items={pulls} t={t} locale={locale} /> : null}
          {plain.length > 0 ? <Section title={t("issues.sectionIssues")} items={plain} t={t} locale={locale} /> : null}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  t,
  locale,
}: {
  title: string;
  items: IssueItem[];
  t: Translate;
  locale: Locale;
}) {
  return (
    <section>
      <p className="eyebrow mb-2 px-0.5">
        {title} · <span className="tabular">{items.length}</span>
      </p>

      <StaggerGroup className="overflow-hidden rounded-box border border-base-300 bg-base-100">
        {items.map((item) => (
          <StaggerItem
            key={item.number}
            className="group border-b border-base-300 last:border-b-0"
          >
            <a
              href={item.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="flex gap-3 px-4 py-3 transition-colors hover:bg-base-content/[0.03]"
            >
              <StateIcon item={item} t={t} />

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="line-clamp-2 text-[13.5px] font-medium leading-snug">
                    {item.title}
                  </span>
                  <span className="tabular shrink-0 font-mono text-[11.5px] text-base-content/35">
                    #{item.number}
                  </span>
                </span>

                {item.labels.length > 0 ? (
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {item.labels.slice(0, 6).map((label) => (
                      <span
                        key={label.name}
                        className="flex items-center gap-1 rounded-selector bg-base-200 px-1.5 py-0.5 text-[10.5px] text-base-content/65"
                      >
                        <span
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: `#${label.color}` }}
                          aria-hidden="true"
                        />
                        {label.name}
                      </span>
                    ))}
                  </span>
                ) : null}

                <span className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-base-content/45">
                  <span className="text-base-content/60">
                    {item.author ?? t("common.unknown")}
                  </span>
                  <span aria-hidden="true">·</span>
                  <time title={formatDateTime(item.updatedAt, locale)}>
                    {t("issues.updated", {
                      time: formatRelative(item.updatedAt, locale),
                    })}
                  </time>
                  {item.comments > 0 ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="tabular flex items-center gap-1">
                        <MessageSquare className="size-3" aria-hidden="true" />
                        {item.comments}
                      </span>
                    </>
                  ) : null}
                </span>
              </span>

              <ArrowUpRight
                className="mt-0.5 size-3.5 shrink-0 text-base-content/20 transition-colors group-hover:text-base-content/50"
                aria-hidden="true"
              />
            </a>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}

function StateIcon({ item, t }: { item: IssueItem; t: Translate }) {
  if (item.isPull) {
    if (item.isMerged) {
      return (
        <GitMerge
          className="mt-0.5 size-4 shrink-0 text-secondary"
          strokeWidth={1.75}
          aria-label={t("issues.merged")}
        />
      );
    }
    return (
      <GitPullRequest
        className={`mt-0.5 size-4 shrink-0 ${
          item.state === "open"
            ? item.isDraft
              ? "text-base-content/40"
              : "text-success"
            : "text-error"
        }`}
        strokeWidth={1.75}
        aria-label={
          item.state === "open"
            ? item.isDraft
              ? t("issues.draftPull")
              : t("issues.openPull")
            : t("issues.closedPull")
        }
      />
    );
  }

  return (
    <CircleDot
      className={`mt-0.5 size-4 shrink-0 ${
        item.state === "open" ? "text-success" : "text-secondary"
      }`}
      strokeWidth={1.75}
      aria-label={item.state === "open" ? t("issues.openIssue") : t("issues.closedIssue")}
    />
  );
}
