import { describe, expect, it } from "vitest";

import { GithubError, githubErrorMessage } from "@/lib/github";

const FALLBACK = "Bağlantını kontrol et.";

/** Testte sozluk yerine anahtari geri veren sahte bir ceviri kullaniyoruz. */
const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

describe("githubErrorMessage", () => {
  it("GithubError olmayanlarda yedek mesaji doner", () => {
    expect(githubErrorMessage(t, new Error("boom"), FALLBACK)).toBe(FALLBACK);
    expect(githubErrorMessage(t, null, FALLBACK)).toBe(FALLBACK);
  });

  it("kota dolduysa kota anahtarini doner", () => {
    const error = new GithubError(403, "forbidden", { rateLimited: true });
    expect(githubErrorMessage(t, error, FALLBACK)).toBe("errors.rateLimited");
  });

  it("sifirlanma zamani varsa saati parametre olarak gecirir", () => {
    const error = new GithubError(429, "too many", {
      rateLimited: true,
      resetAt: new Date("2026-09-01T12:30:00.000Z"),
    });

    const message = githubErrorMessage(t, error, FALLBACK);
    expect(message).toContain("errors.rateLimitedAt");
    expect(message).toMatch(/\d{2}:\d{2}/);
  });

  it("kota disi 403'te yedek mesaj korunur", () => {
    expect(githubErrorMessage(t, new GithubError(403, "forbidden"), FALLBACK)).toBe(
      FALLBACK,
    );
  });

  it("401'de oturum anahtarini doner", () => {
    expect(githubErrorMessage(t, new GithubError(401, "unauthorized"), FALLBACK)).toBe(
      "errors.unauthorized",
    );
  });
});
