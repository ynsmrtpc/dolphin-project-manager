import { beforeEach, describe, expect, it, vi } from "vitest";

/** Istek basina degisen cerez/baslik degerleri. */
const request = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  acceptLanguage: null as string | null,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "dolphin-locale" && request.cookie
        ? { name, value: request.cookie }
        : undefined,
  }),
  headers: async () => ({
    get: (name: string) =>
      name.toLowerCase() === "accept-language" ? request.acceptLanguage : null,
  }),
}));

const { getLocale, getMessages, getT } = await import("@/lib/i18n/server");

beforeEach(() => {
  request.cookie = undefined;
  request.acceptLanguage = null;
});

describe("getLocale", () => {
  it("kullanıcının seçimi her şeyin önünde gelir", async () => {
    request.cookie = "en";
    request.acceptLanguage = "tr-TR,tr;q=0.9";

    expect(await getLocale()).toBe("en");
  });

  it("seçim yoksa tarayıcı diline bakar", async () => {
    request.acceptLanguage = "tr-TR,tr;q=0.9,en;q=0.8";
    expect(await getLocale()).toBe("tr");
  });

  it("tarayıcı dili desteklenmiyorsa İngilizce'ye düşer", async () => {
    request.acceptLanguage = "de-DE,de;q=0.9,fr;q=0.8";
    expect(await getLocale()).toBe("en");
  });

  it("hiçbir ipucu yoksa İngilizce döner", async () => {
    expect(await getLocale()).toBe("en");
  });

  it("geçersiz çerez değerini yok sayar", async () => {
    request.cookie = "de";
    request.acceptLanguage = "tr";

    expect(await getLocale()).toBe("tr");
  });
});

describe("getT", () => {
  it("seçili dilde çeviri döndürür", async () => {
    request.cookie = "tr";
    const t = await getT();
    expect(t("common.save")).toBe("Kaydet");

    request.cookie = "en";
    const en = await getT();
    expect(en("common.save")).toBe("Save");
  });

  it("parametreleri yerine koyar", async () => {
    request.cookie = "en";
    const t = await getT();
    expect(t("todos.showMore", { count: 12 })).toContain("12");
  });
});

describe("getMessages", () => {
  it("her dil için sözlüğü döndürür", () => {
    expect(getMessages("tr").common).toBeDefined();
    expect(getMessages("en").common).toBeDefined();
  });
});
