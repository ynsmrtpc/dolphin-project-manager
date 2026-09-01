import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, Check } from "lucide-react";

import { Reveal } from "@/components/motion/Reveal";
import { DolphinMark } from "@/components/shell/DolphinMark";
import { GithubMark } from "@/components/shell/GithubMark";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { env, isGithubConfigured } from "@/lib/env";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

const ERROR_KEYS = ["not_configured", "state", "token", "profile"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("login.title") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const t = await getT();
  const { error } = await searchParams;
  const configured = isGithubConfigured();

  const errorKey = ERROR_KEYS.find((key) => key === error);
  const errorText = error
    ? t(errorKey ? `login.errors.${errorKey}` : "login.errors.generic")
    : null;

  const points = [
    t("login.points.first"),
    t("login.points.second"),
    t("login.points.third"),
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between px-5 sm:px-8">
        <span className="flex items-center gap-2.5">
          <DolphinMark className="size-[26px] rounded-[6px]" />
          <span className="text-[15px] font-semibold tracking-tight">Dolphin</span>
        </span>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <Reveal className="w-full max-w-[23rem]">
          <div className="rounded-box border border-base-300 bg-base-100 p-7">
            <h1 className="text-[19px] font-semibold tracking-tight">
              {t("login.heading")}
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-base-content/55">
              {t("login.description")}
            </p>

            {errorText ? (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2 rounded-field border border-error/30 bg-error/[0.07] px-3 py-2.5 text-[12.5px] leading-relaxed text-error"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>{errorText}</span>
              </div>
            ) : null}

            <a
              href="/api/auth/login"
              className={`btn btn-primary btn-block mt-6${configured ? "" : " btn-disabled"}`}
              {...(configured
                ? {}
                : { tabIndex: -1, role: "button", "aria-disabled": true })}
            >
              <GithubMark className="size-4" />
              {t("login.button")}
            </a>

            <p className="mt-3 text-center text-[11.5px] text-base-content/40">
              {t("login.scopeNote", { scope: "repo" })}
            </p>

            <ul className="mt-6 flex flex-col gap-2.5 border-t border-base-300 pt-5">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <Check
                    className="mt-0.5 size-3.5 shrink-0 text-primary"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                  <span className="text-[12.5px] leading-relaxed text-base-content/60">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {!configured ? (
            <div
              role="alert"
              className="mt-4 rounded-box border border-warning/30 bg-warning/[0.07] px-4 py-3"
            >
              <p className="text-[12.5px] font-medium text-warning">
                {t("login.setupTitle")}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-base-content/60">
                {t("login.setupBody", {
                  callback: `${env.appUrl}/api/auth/callback`,
                  envFile: ".env",
                })}
              </p>
            </div>
          ) : null}
        </Reveal>
      </main>

      <footer className="flex items-center justify-center gap-4 px-5 py-6 text-[11.5px] text-base-content/30 sm:px-8">
        <span>Dolphin</span>
        <LanguageSwitcher />
      </footer>
    </div>
  );
}
