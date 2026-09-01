"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { useT } from "@/lib/i18n/client";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center rounded-box border border-base-300 bg-base-100 px-6 py-16 text-center">
      <AlertTriangle
        className="size-8 text-warning"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <h1 className="mt-4 text-[17px] font-semibold tracking-tight">
        {t("errors.pageTitle")}
      </h1>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-base-content/55">
        {t("errors.pageBody")}
      </p>

      {error.digest ? (
        <p className="mt-3 font-mono text-[11px] text-base-content/35">
          {t("errors.digest", { digest: error.digest })}
        </p>
      ) : null}

      <div className="mt-6 flex items-center gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={reset}>
          <RotateCcw className="size-3.5" aria-hidden="true" />
          {t("common.retry")}
        </button>
        <Link href="/" className="btn btn-ghost btn-sm font-normal">
          {t("common.backToProjects")}
        </Link>
      </div>
    </div>
  );
}
