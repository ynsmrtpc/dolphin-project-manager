import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { decryptSecret } from "@/lib/crypto";
import { db, type UserRow } from "@/lib/db";

export const SESSION_COOKIE = "dolphin_session";
const SESSION_DAYS = 30;

export function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  db.prepare(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
  ).run(token, userId, expiresAt.toISOString());

  return { token, expiresAt };
}

export function deleteSession(token: string) {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

export async function getCurrentUser(): Promise<UserRow | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT u.id, u.github_id, u.login, u.name, u.avatar_url, u.access_token, s.expires_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token = ?`,
    )
    .get(token) as (UserRow & { expires_at: string }) | undefined;

  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    deleteSession(token);
    return null;
  }

  // Anahtar degistiyse token cozulemez; oturumu gecersiz sayiyoruz.
  const accessToken = decryptSecret(row.access_token);
  if (accessToken === null) {
    deleteSession(token);
    return null;
  }

  return {
    id: row.id,
    github_id: row.github_id,
    login: row.login,
    name: row.name,
    avatar_url: row.avatar_url,
    access_token: accessToken,
  };
}

export async function requireUser(): Promise<UserRow> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
