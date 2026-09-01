"use client";

import { useEffect } from "react";

/**
 * Service worker'i yalnizca uretim derlemesinde kaydeder.
 * Gelistirmede kayitli bir SW, Turbopack'in urettigi chunk'lari bayatlatip
 * "module factory is not available" turu hatalara yol aciyor; bu yuzden
 * dev modunda varsa kaydi kaldiriyoruz.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) registration.unregister();
      });
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Service worker kaydedilemedi", error);
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
