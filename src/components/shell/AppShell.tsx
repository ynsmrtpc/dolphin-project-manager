"use client";

import Link from "next/link";
import { FolderGit2, LogOut } from "lucide-react";

import { CommandPalette } from "@/components/shell/CommandPalette";
import { DolphinMark } from "@/components/shell/DolphinMark";
import { GithubMark } from "@/components/shell/GithubMark";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { useT } from "@/lib/i18n/client";
import type { SessionUser } from "@/lib/user";

/** <details> tabanli menu, baglantiya tiklandiginda kendiliginden kapanmaz. */
function closeMenu(event: React.MouseEvent<HTMLElement>) {
  event.currentTarget.closest("details")?.removeAttribute("open");
}

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const t = useT();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="btn btn-primary btn-sm sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50"
      >
        {t("shell.skipToContent")}
      </a>

      <header className="sticky top-0 z-30 border-b border-base-300 bg-base-200/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[76rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <DolphinMark className="size-[26px] rounded-[6px]" />
            <span className="text-[15px] font-semibold tracking-tight">Dolphin</span>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <CommandPalette />
            <span className="mx-1 h-4 w-px bg-base-300" aria-hidden="true" />
            <ThemeToggle />

            <a
              href={`https://github.com/${user.login}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-sm btn-square text-base-content/55"
              aria-label={t("shell.openGithubProfile")}
            >
              <GithubMark className="size-4" />
            </a>

            <details className="dropdown dropdown-end">
              <summary className="btn btn-ghost btn-sm gap-2 pl-1 pr-2 font-normal">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user.avatarUrl ?? "https://picsum.photos/56/56"}
                  alt=""
                  width={24}
                  height={24}
                  className="size-6 rounded-full ring-1 ring-base-300"
                />
                <span className="hidden text-[13px] sm:inline">{user.login}</span>
              </summary>

              <div className="dropdown-content z-50 mt-2 w-60 overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-lg">
                <div className="border-b border-base-300 px-3.5 py-3">
                  <p className="truncate text-[13px] font-medium">
                    {user.name ?? user.login}
                  </p>
                  <p className="truncate font-mono text-[11.5px] text-base-content/45">
                    {user.login}
                  </p>
                </div>
                <Link
                  href="/repos"
                  onClick={closeMenu}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-base-content/70 transition-colors hover:bg-base-content/[0.04] hover:text-base-content"
                >
                  <FolderGit2 className="size-3.5" aria-hidden="true" />
                  {t("shell.repoSelection")}
                </Link>
                <a
                  href="/api/auth/logout"
                  className="flex items-center gap-2.5 border-t border-base-300 px-3.5 py-2.5 text-[13px] text-base-content/70 transition-colors hover:bg-base-content/[0.04] hover:text-error"
                >
                  <LogOut className="size-3.5" aria-hidden="true" />
                  {t("shell.signOut")}
                </a>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto w-full max-w-[76rem] flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
      >
        {children}
      </main>

      <footer className="border-t border-base-300">
        <div className="mx-auto flex w-full max-w-[76rem] items-center justify-between gap-3 px-4 py-5 text-[11.5px] text-base-content/35 sm:px-6 lg:px-8">
          <span className="font-medium text-base-content/45">Dolphin</span>

          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <span className="font-mono">{user.login}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
