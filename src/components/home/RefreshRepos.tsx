"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { refreshRepoMeta } from "@/lib/actions";
import { formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

export function RefreshRepos({ syncedAt }: { syncedAt: string | null }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <span className="flex items-center gap-2">
      <span className="hidden text-[11.5px] text-base-content/40 sm:inline">
        {message ??
          (syncedAt
            ? t("home.syncedAt", { time: formatRelative(syncedAt, locale) })
            : t("home.neverSynced"))}
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-square text-base-content/50"
        disabled={pending}
        title={t("home.refreshTitle")}
        aria-label={t("home.refreshAria")}
        onClick={() =>
          startTransition(async () => {
            const result = await refreshRepoMeta();
            setMessage(result.message);
            router.refresh();
          })
        }
      >
        <RefreshCw
          className={`size-4 ${pending ? "animate-spin" : ""}`}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </button>
    </span>
  );
}
