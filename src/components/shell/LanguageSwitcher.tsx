"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";

import { useLocale, useT } from "@/lib/i18n/client";
import { setLocale } from "@/lib/i18n/actions";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";

/** Altbilgide duran kompakt dil secici. */
export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();
  const t = useT();
  const [pending, startTransition] = useTransition();

  function pick(next: Locale) {
    if (next === locale) return;

    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Languages
        className="size-3.5 text-base-content/30"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <div className="flex items-center" role="group" aria-label={t("shell.language")}>
        {LOCALES.map((item, index) => (
          <span key={item} className="flex items-center">
            {index > 0 ? (
              <span className="text-base-content/20" aria-hidden="true">
                /
              </span>
            ) : null}
            <button
              type="button"
              disabled={pending}
              aria-pressed={locale === item}
              onClick={() => pick(item)}
              title={LOCALE_LABELS[item]}
              className={`px-1.5 py-0.5 text-[11.5px] transition-colors ${
                locale === item
                  ? "font-medium text-base-content/70"
                  : "text-base-content/35 hover:text-base-content/60"
              }`}
            >
              {item.toUpperCase()}
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
