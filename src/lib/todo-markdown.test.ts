import { describe, expect, it } from "vitest";

import { parseTodoMarkdown } from "@/lib/todo-markdown";

describe("parseTodoMarkdown", () => {
  it("kutucuklu maddeleri tamamlanma durumuyla okur", () => {
    const result = parseTodoMarkdown(
      ["- [x] Biten iş", "- [ ] Bitmeyen iş", "* [X] Büyük X de sayılır"].join("\n"),
    );

    expect(result).toEqual([
      { title: "Biten iş", done: true, priority: "normal" },
      { title: "Bitmeyen iş", done: false, priority: "normal" },
      { title: "Büyük X de sayılır", done: true, priority: "normal" },
    ]);
  });

  it("kutucuk varsa düz maddeleri yok sayar", () => {
    const result = parseTodoMarkdown(
      ["## Başlık", "- [ ] Gerçek görev", "- sadece bir açıklama satırı"].join("\n"),
    );

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Gerçek görev");
  });

  it("hiç kutucuk yoksa düz maddelere düşer", () => {
    const result = parseTodoMarkdown(["- ilk", "* ikinci", "+ üçüncü"].join("\n"));

    expect(result.map((item) => item.title)).toEqual(["ilk", "ikinci", "üçüncü"]);
    expect(result.every((item) => !item.done)).toBe(true);
  });

  it("markdown süsünü temizler", () => {
    const result = parseTodoMarkdown(
      [
        "- [ ] `kod` içeren madde",
        "- [ ] **kalın** madde",
        "- [ ] [bağlantılı](https://example.com) madde",
      ].join("\n"),
    );

    expect(result.map((item) => item.title)).toEqual([
      "kod içeren madde",
      "kalın madde",
      "bağlantılı madde",
    ]);
  });

  it("önceliği metinden çıkarır ve işareti başlıkta bırakmaz", () => {
    const result = parseTodoMarkdown(
      [
        "- [ ] Acil olan iş !",
        "- [ ] Sıradan iş",
        "- [ ] Beklesin (low)",
        "- [ ] URGENT deploy",
      ].join("\n"),
    );

    expect(result).toEqual([
      { title: "Acil olan iş", done: false, priority: "high" },
      { title: "Sıradan iş", done: false, priority: "normal" },
      { title: "Beklesin", done: false, priority: "low" },
      { title: "URGENT deploy", done: false, priority: "high" },
    ]);
  });

  it("madde içermeyen metinde boş dizi döner", () => {
    expect(parseTodoMarkdown("# Sadece başlık\n\nDüz paragraf.")).toEqual([]);
    expect(parseTodoMarkdown("")).toEqual([]);
  });

  it("çok uzun başlıkları kırpar", () => {
    const long = "a".repeat(500);
    const [item] = parseTodoMarkdown(`- [ ] ${long}`);

    expect(item.title).toHaveLength(300);
  });
});
