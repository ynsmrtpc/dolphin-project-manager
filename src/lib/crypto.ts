import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { env } from "@/lib/env";

const PREFIX = "v1";
const ALGORITHM = "aes-256-gcm";

let cachedKey: Buffer | null = null;

/**
 * Anahtar sirasiyla su kaynaklardan gelir:
 *   1. ENCRYPTION_KEY ortam degiskeni (tercih edilen — anahtar veriden ayri durur)
 *   2. Veritabaninin yanindaki `.encryption-key` dosyasi (ilk calistirmada uretilir)
 *
 * Ikinci secenek, .db dosyasinin yedege/paylasima sizmasina karsi korur;
 * uygulama klasorunun tamamina erisimi olan birine karsi korumaz.
 */
function loadKey(): Buffer {
  if (cachedKey) return cachedKey;

  const fromEnv = process.env.ENCRYPTION_KEY?.trim();
  if (fromEnv) {
    // Uzunluktan bagimsiz olarak 32 baytlik bir anahtara indirger.
    cachedKey = createHash("sha256").update(fromEnv).digest();
    return cachedKey;
  }

  const keyPath = resolve(
    /* turbopackIgnore: true */ process.cwd(),
    dirname(env.databasePath),
    ".encryption-key",
  );

  if (existsSync(keyPath)) {
    cachedKey = Buffer.from(readFileSync(keyPath, "utf8").trim(), "hex");
    if (cachedKey.length === 32) return cachedKey;
  }

  const generated = randomBytes(32);
  mkdirSync(dirname(keyPath), { recursive: true });
  writeFileSync(keyPath, generated.toString("hex"), { encoding: "utf8" });
  try {
    chmodSync(keyPath, 0o600);
  } catch {
    /* Windows'ta anlamsiz; hata vermesi onemli degil. */
  }

  cachedKey = generated;
  return cachedKey;
}

/** Sifreli degerleri duz metinden ayirt eder. */
export function isEncrypted(value: string) {
  return value.startsWith(`${PREFIX}.`);
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, loadKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

/**
 * Sifreli degeri cozer. Sifrelenmemis (eski) degerler oldugu gibi doner,
 * boylece mevcut veritabanlari calismaya devam eder.
 * Anahtar degistiyse cozulemez ve null doner — cagiran taraf bunu
 * "oturum gecersiz" olarak ele almalidir.
 */
export function decryptSecret(stored: string): string | null {
  if (!isEncrypted(stored)) return stored;

  const [, ivPart, tagPart, dataPart] = stored.split(".");
  if (!ivPart || !tagPart || !dataPart) return null;

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      loadKey(),
      Buffer.from(ivPart, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
