import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("offline.title") };
}

export default async function OfflinePage() {
  const t = await getT();

  return (
    <div className="flex flex-col items-center rounded-box border border-dashed border-base-300 px-6 py-20 text-center">
      <WifiOff
        className="size-8 text-base-content/25"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <h1 className="mt-4 text-[17px] font-semibold tracking-tight">{t("offline.heading")}</h1>
      <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-base-content/55">
        {t("offline.body")}
      </p>
      {/*
        Bilerek <Link> degil: buradan cikis tam sayfa yenileme olmali.
        Istemci tarafi gecis, onbellekten gelen bu sayfada calismaz.
      */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="btn btn-primary btn-sm mt-6">
        {t("common.retry")}
      </a>
    </div>
  );
}
