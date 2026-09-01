import type { UserRow } from "@/lib/db";

/** Istemciye gonderilen guvenli kullanici alanlari (access_token asla gecmez). */
export type SessionUser = {
  login: string;
  name: string | null;
  avatarUrl: string | null;
};

export function toSessionUser(user: UserRow): SessionUser {
  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
  };
}
