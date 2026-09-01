"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { useT } from "@/lib/i18n/client";

const LIGHT = "dolphin-light";
const DARK = "dolphin-dark";

/** Aktif tema <html data-theme> uzerinde tutulur; degisimi observer bildirir. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const t = useT();
  const theme = useSyncExternalStore(
    subscribe,
    () => document.documentElement.getAttribute("data-theme") ?? LIGHT,
    () => LIGHT,
  );

  const isDark = theme === DARK;

  function apply(next: boolean) {
    const value = next ? DARK : LIGHT;
    document.documentElement.setAttribute("data-theme", value);
    try {
      localStorage.setItem("dolphin-theme", value);
    } catch {
      /* localStorage kapaliysa tema yalnizca bu oturumda gecerli olur. */
    }
  }

  return (
    <label className="flex items-center gap-1.5 px-1" title={t("theme.label")}>
      <Sun
        className={`size-3.5 transition-colors ${isDark ? "text-base-content/25" : "text-base-content/70"}`}
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <input
        type="checkbox"
        className="toggle toggle-xs"
        checked={isDark}
        onChange={(event) => apply(event.target.checked)}
        aria-label={isDark ? t("theme.toLight") : t("theme.toDark")}
      />
      <Moon
        className={`size-3.5 transition-colors ${isDark ? "text-base-content/70" : "text-base-content/25"}`}
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </label>
  );
}
