"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Dil tercihini cereze yazar; sunucu bir sonraki istekte bunu okur. */
export async function setLocale(value: string) {
  if (!isLocale(value)) return;

  (await cookies()).set(LOCALE_COOKIE, value, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
}
