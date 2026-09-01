import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatDateTime, formatRelative } from "@/lib/format";

const NOW = new Date("2026-09-01T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatRelative", () => {
  it("ISO damgalarini okur", () => {
    expect(formatRelative("2026-09-01T09:00:00.000Z", "tr")).toBe("3 saat önce");
    expect(formatRelative("2026-08-30T12:00:00.000Z", "tr")).toBe("evvelsi gün");
  });

  it("Ingilizce cikti uretir", () => {
    expect(formatRelative("2026-09-01T09:00:00.000Z", "en")).toBe("3 hours ago");
    expect(formatRelative("2026-08-31T12:00:00.000Z", "en")).toBe("yesterday");
  });

  /**
   * Asil kenar durum: SQLite'in eski `datetime('now')` bicimi UTC'dir ama
   * sonunda Z tasimaz. Z eklenmezse yerel saat sanilir ve saatler kayar.
   */
  it("Z tasimayan eski SQLite damgalarini da UTC kabul eder", () => {
    expect(formatRelative("2026-09-01 09:00:00", "tr")).toBe("3 saat önce");
    expect(formatRelative("2026-09-01 09:00:00", "tr")).toBe(
      formatRelative("2026-09-01T09:00:00.000Z", "tr"),
    );
  });

  it("cok yakin zamanlar icin dile gore 'az önce' der", () => {
    expect(formatRelative("2026-09-01T11:59:30.000Z", "tr")).toBe("az önce");
    expect(formatRelative("2026-09-01T11:59:30.000Z", "en")).toBe("just now");
  });

  it("bos ve gecersiz degerlerde patlamaz", () => {
    expect(formatRelative(null, "tr")).toBe("tarih yok");
    expect(formatRelative(undefined, "en")).toBe("no date");
    expect(formatRelative("", "tr")).toBe("tarih yok");
    expect(formatRelative("bu bir tarih değil", "en")).toBe("no date");
  });

  it("dil verilmezse yedek dile (Ingilizce) duser", () => {
    expect(formatRelative(null)).toBe("no date");
  });
});

describe("formatDateTime", () => {
  it("gecersiz degerde tire doner", () => {
    expect(formatDateTime(null, "tr")).toBe("-");
    expect(formatDateTime("bozuk", "en")).toBe("-");
  });

  it("her iki dilde de yili icerir", () => {
    expect(formatDateTime("2026-09-01T09:00:00.000Z", "tr")).toMatch(/2026/);
    expect(formatDateTime("2026-09-01T09:00:00.000Z", "en")).toMatch(/2026/);
  });
});
