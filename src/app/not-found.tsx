import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT();

  return (
    <div className="flex flex-col items-center rounded-box border border-dashed border-base-300 px-6 py-20 text-center">
      <FileQuestion
        className="size-8 text-base-content/20"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <h1 className="mt-4 text-[17px] font-semibold tracking-tight">{t("errors.notFoundTitle")}</h1>
      <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-base-content/55">
        {t("errors.notFoundBody")}
      </p>
      <Link href="/" className="btn btn-primary btn-sm mt-6">
        {t("common.backToProjects")}
      </Link>
    </div>
  );
}
