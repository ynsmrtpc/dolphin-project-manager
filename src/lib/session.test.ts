import { beforeEach, describe, expect, it, vi } from "vitest";

import { count, reset, seedUser } from "@/test/support";

/** Cerez kavanozunu testler arasi degistirebilelim diye disariya aliyoruz. */
const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "dolphin_session" && jar.token
        ? { name, value: jar.token }
        : undefined,
  }),
  headers: async () => new Headers(),
}));

vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("REDIRECT");
  },
}));

const { db } = await import("@/lib/db");
const { encryptSecret } = await import("@/lib/crypto");
const { createSession, deleteSession, getCurrentUser, requireUser } = await import(
  "@/lib/session"
);

beforeEach(() => {
  reset(db);
  jar.token = undefined;
});

describe("createSession", () => {
  it("tahmin edilemez bir anahtar üretir ve kaydeder", () => {
    const user = seedUser(db);
    const { token, expiresAt } = createSession(user.id);

    expect(token).toHaveLength(64);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(count(db, "sessions", `token = '${token}'`)).toBe(1);
  });

  it("her çağrıda farklı anahtar verir", () => {
    const user = seedUser(db);
    expect(createSession(user.id).token).not.toBe(createSession(user.id).token);
  });
});

describe("getCurrentUser", () => {
  it("çerez yoksa null döner", async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it("bilinmeyen anahtarda null döner", async () => {
    jar.token = "olmayan-anahtar";
    expect(await getCurrentUser()).toBeNull();
  });

  it("geçerli oturumda kullanıcıyı döner", async () => {
    const user = seedUser(db, { login: "tester" });
    jar.token = createSession(user.id).token;

    const current = await getCurrentUser();

    expect(current?.id).toBe(user.id);
    expect(current?.login).toBe("tester");
  });

  it("şifreli token'ı çözerek döner", async () => {
    const raw = "gho_gercek_token";
    const user = seedUser(db, { token: encryptSecret(raw) });
    jar.token = createSession(user.id).token;

    const current = await getCurrentUser();

    expect(current?.access_token).toBe(raw);
  });

  it("süresi dolmuş oturumu reddeder ve siler", async () => {
    const user = seedUser(db);
    const token = "suresi-dolmus";
    db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`).run(
      token,
      user.id,
      new Date(Date.now() - 1000).toISOString(),
    );
    jar.token = token;

    expect(await getCurrentUser()).toBeNull();
    // Bayat kayit temizlenmeli.
    expect(count(db, "sessions", `token = '${token}'`)).toBe(0);
  });

  /**
   * ENCRYPTION_KEY degisirse eski token'lar cozulemez.
   * Bu durumda oturum sessizce gecersiz sayilmali, uygulama patlamamali.
   */
  it("çözülemeyen token'da oturumu geçersiz sayar ve siler", async () => {
    const user = seedUser(db, { token: "v1.YWJj.ZGVm.Z2hp" });
    const token = createSession(user.id).token;
    jar.token = token;

    expect(await getCurrentUser()).toBeNull();
    expect(count(db, "sessions", `token = '${token}'`)).toBe(0);
  });
});

describe("deleteSession", () => {
  it("oturumu kaldırır", async () => {
    const user = seedUser(db);
    const { token } = createSession(user.id);
    jar.token = token;

    deleteSession(token);

    expect(count(db, "sessions")).toBe(0);
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("requireUser", () => {
  it("oturum varsa kullanıcıyı döner", async () => {
    const user = seedUser(db);
    jar.token = createSession(user.id).token;

    expect((await requireUser()).id).toBe(user.id);
  });

  it("oturum yoksa girişe yönlendirir", async () => {
    await expect(requireUser()).rejects.toThrow("REDIRECT");
  });
});

describe("kullanıcı silinince", () => {
  it("oturumları da silinir", () => {
    const user = seedUser(db);
    createSession(user.id);
    expect(count(db, "sessions")).toBe(1);

    db.prepare(`DELETE FROM users WHERE id = ?`).run(user.id);
    expect(count(db, "sessions")).toBe(0);
  });
});
