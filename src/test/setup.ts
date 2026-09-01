import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

/**
 * Her test dosyasi kendi gecici veritabaniyla calisir.
 * `lib/db.ts` baglantiyi import aninda kurdugu icin bu degerlerin
 * modul yuklenmeden once ayarlanmasi sart — setupFiles tam olarak bunu yapar.
 */
const file = join(tmpdir(), `dolphin-test-${randomUUID()}.db`);

process.env.DATABASE_PATH = file;
process.env.ENCRYPTION_KEY = "test-only-encryption-key";

afterAll(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      rmSync(file + suffix, { force: true });
    } catch {
      /* Windows'ta dosya hala aciksa silinemeyebilir; sorun degil. */
    }
  }
});
