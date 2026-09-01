import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  // Testler disk uzerinde anahtar dosyasi uretmesin.
  process.env.ENCRYPTION_KEY = "test-anahtari-yalnizca-testler-icin";
});

const { decryptSecret, encryptSecret, isEncrypted } = await import("@/lib/crypto");

describe("token sifreleme", () => {
  it("sifreleyip geri cozer", () => {
    const token = "gho_abcdefghijklmnopqrstuvwxyz0123456789";
    const stored = encryptSecret(token);

    expect(stored).not.toContain(token);
    expect(isEncrypted(stored)).toBe(true);
    expect(decryptSecret(stored)).toBe(token);
  });

  it("her sifrelemede farkli cikti uretir (rastgele IV)", () => {
    const token = "aynı-değer";
    expect(encryptSecret(token)).not.toBe(encryptSecret(token));
  });

  it("Turkce karakterleri bozmaz", () => {
    const value = "şğüöçİI-değer";
    expect(decryptSecret(encryptSecret(value))).toBe(value);
  });

  it("eski duz metin degerleri oldugu gibi doner", () => {
    const legacy = "gho_duzmetintoken";
    expect(isEncrypted(legacy)).toBe(false);
    expect(decryptSecret(legacy)).toBe(legacy);
  });

  it("bozulmus veride null doner", () => {
    const stored = encryptSecret("bir-şey");
    const parts = stored.split(".");
    const tampered = [parts[0], parts[1], parts[2], "AAAA"].join(".");

    expect(decryptSecret(tampered)).toBeNull();
    expect(decryptSecret("v1.eksik")).toBeNull();
  });
});
