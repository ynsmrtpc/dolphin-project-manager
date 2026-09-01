import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";

import { AppShell } from "@/components/shell/AppShell";
import { ServiceWorkerRegistrar } from "@/components/shell/ServiceWorkerRegistrar";
import { LocaleProvider } from "@/lib/i18n/client";
import { getLocale, getMessages, getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";
import { toSessionUser } from "@/lib/user";

import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();

  return {
    applicationName: "Dolphin",
    title: { default: "Dolphin — Project Management", template: "%s · Dolphin" },
    description: t("home.description"),
    appleWebApp: {
      capable: true,
      title: "Dolphin",
      statusBarStyle: "black-translucent",
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0e" },
  ],
};

/* Tema ilk boyamadan once uygulanir; boylece acilista yanip sonme olmaz. */
const themeScript = `(function(){try{var t=localStorage.getItem("dolphin-theme");if(t!=="dolphin-light"&&t!=="dolphin-dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dolphin-dark":"dolphin-light";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const locale = await getLocale();
  const messages = getMessages(locale);

  return (
    <html
      lang={locale}
      data-theme="dolphin-light"
      className={`${inter.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-base-200 font-sans text-base-content antialiased">
        <Script id="dolphin-theme" strategy="beforeInteractive">
          {themeScript}
        </Script>

        <LocaleProvider locale={locale} messages={messages}>
          {user ? <AppShell user={toSessionUser(user)}>{children}</AppShell> : children}
          <ServiceWorkerRegistrar />
        </LocaleProvider>
      </body>
    </html>
  );
}
