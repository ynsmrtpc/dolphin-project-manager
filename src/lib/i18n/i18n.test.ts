import { describe, expect, it } from "vitest";

import { LOCALES, isLocale, localeFromAcceptLanguage } from "@/lib/i18n/config";
import { en } from "@/lib/i18n/messages/en";
import { tr } from "@/lib/i18n/messages/tr";
import { createTranslate, type MessageTree } from "@/lib/i18n/translate";

const trTree = tr as unknown as MessageTree;
const enTree = en as unknown as MessageTree;

/** Ic ice sozlugu "a.b.c" anahtarlarina duzler. */
function flatten(tree: MessageTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const isPlural =
      typeof value === "object" && value !== null && "one" in value && "other" in value;

    return typeof value === "object" && value !== null && !isPlural
      ? flatten(value as MessageTree, path)
      : [path];
  });
}

describe("sozlukler", () => {
  it("iki dil de ayni anahtarlari tasiyor", () => {
    const trKeys = flatten(trTree).sort();
    const enKeys = flatten(enTree).sort();

    expect(enKeys).toEqual(trKeys);
  });

  it("hicbir ceviri bos degil", () => {
    for (const [name, tree] of [
      ["tr", trTree],
      ["en", enTree],
    ] as const) {
      const translate = createTranslate(tree, tree, name);
      for (const key of flatten(tree)) {
        expect(translate(key).trim(), `${name} / ${key}`).not.toBe("");
      }
    }
  });

  it("Ingilizce ceviriler Turkce metinden farkli", () => {
    // Ayni kalmasi beklenen birkac teknik terim disinda ceviri yapilmis olmali.
    const identical = flatten(trTree).filter((key) => {
      const a = createTranslate(trTree, trTree, "tr")(key);
      const b = createTranslate(enTree, enTree, "en")(key);
      return a === b;
    });

    expect(identical.sort()).toEqual([
      "common.github",
      "common.private",
      "common.public",
      "time.empty",
      "todos.priorityNormal",
    ].sort());
  });
});

describe("createTranslate", () => {
  const messages: MessageTree = {
    greeting: "Merhaba {name}",
    items: { one: "{count} öğe", other: "{count} öğe" },
    nested: { deep: "derin" },
  };

  it("parametreleri yerine koyar", () => {
    const t = createTranslate(messages, messages, "tr");
    expect(t("greeting", { name: "Yunus" })).toBe("Merhaba Yunus");
  });

  it("eksik anahtarda anahtarin kendisini doner", () => {
    const t = createTranslate(messages, messages, "tr");
    expect(t("yok.olan")).toBe("yok.olan");
  });

  it("anahtar eksikse yedek sozluge duser", () => {
    const t = createTranslate({}, messages, "en");
    expect(t("nested.deep")).toBe("derin");
  });

  it("Ingilizce'de tekil/cogul secer", () => {
    const plural: MessageTree = { n: { one: "{count} item", other: "{count} items" } };
    const t = createTranslate(plural, plural, "en");

    expect(t("n", { count: 1 })).toBe("1 item");
    expect(t("n", { count: 3 })).toBe("3 items");
  });

  it("Turkce'de her zaman tek bicim kullanir", () => {
    const plural: MessageTree = { n: { one: "{count} öğe", other: "{count} öğe" } };
    const t = createTranslate(plural, plural, "tr");

    expect(t("n", { count: 1 })).toBe("1 öğe");
    expect(t("n", { count: 5 })).toBe("5 öğe");
  });
});

describe("localeFromAcceptLanguage", () => {
  it("tarayici dilini secer", () => {
    expect(localeFromAcceptLanguage("tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7")).toBe("tr");
    expect(localeFromAcceptLanguage("en-GB,en;q=0.9")).toBe("en");
  });

  it("kalite degerine gore siralar", () => {
    // Ingilizce once yazilmis ama Turkce'nin q degeri daha yuksek.
    expect(localeFromAcceptLanguage("en;q=0.5,tr;q=0.9")).toBe("tr");
  });

  it("desteklenmeyen dilleri atlar, destekleneni bulur", () => {
    expect(localeFromAcceptLanguage("de-DE,de;q=0.9,fr;q=0.8,en;q=0.7")).toBe("en");
  });

  it("hicbiri desteklenmiyorsa null doner", () => {
    expect(localeFromAcceptLanguage("de-DE,fr;q=0.8")).toBeNull();
  });

  it("bos veya bozuk basliklarda null doner", () => {
    expect(localeFromAcceptLanguage(null)).toBeNull();
    expect(localeFromAcceptLanguage(undefined)).toBeNull();
    expect(localeFromAcceptLanguage("")).toBeNull();
    expect(localeFromAcceptLanguage("tr;q=0")).toBeNull();
  });
});

describe("isLocale", () => {
  it("desteklenen dilleri tanir", () => {
    for (const locale of LOCALES) expect(isLocale(locale)).toBe(true);
  });

  it("bilinmeyen degerleri reddeder", () => {
    expect(isLocale("de")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});
