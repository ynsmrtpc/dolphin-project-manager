"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitBranch } from "lucide-react";

import { useT } from "@/lib/i18n/client";

export function BranchSelect({
  repoId,
  branches,
  current,
}: {
  repoId: number;
  branches: string[];
  current: string;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, startTransition] = useTransition();
  const options = branches.includes(current) ? branches : [current, ...branches];

  return (
    <div className="flex max-w-3xl items-center gap-2">
      <label className="flex h-8 items-center gap-2 rounded-field border border-base-300 bg-base-100 pl-2.5 pr-1 text-[13px]">
        <GitBranch
          className="size-3.5 text-base-content/45"
          strokeWidth={1.75}
          aria-hidden="true"
        />

        <select
          className="h-full min-w-40 cursor-pointer border-none bg-transparent pr-1 font-mono text-[12px] outline-none"
          aria-label={t("commits.branchAria")}
          value={current}
          disabled={pending}
          onChange={(event) => {
            const branch = event.target.value;
            startTransition(() => {
              router.push(
                `/projects/${repoId}?tab=history&branch=${encodeURIComponent(branch)}`,
                { scroll: false },
              );
            });
          }}
        >
          {options.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      {pending ? (
        <span className="loading loading-spinner loading-xs" aria-label={t("common.loading")} />
      ) : (
        <span className="tabular text-[11.5px] text-base-content/40">
          {t("commits.branchCount", { count: options.length })}
        </span>
      )}
    </div>
  );
}
