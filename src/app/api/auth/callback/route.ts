import { NextResponse, type NextRequest } from "next/server";

import { encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env, isGithubConfigured } from "@/lib/env";
import { SESSION_COOKIE, createSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type TokenResponse = {
  access_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GithubUser = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
};

export async function GET(request: NextRequest) {
  if (!isGithubConfigured()) {
    return NextResponse.redirect(`${env.appUrl}/login?error=not_configured`);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("dolphin_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${env.appUrl}/login?error=state`);
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.githubClientId,
      client_secret: env.githubClientSecret,
      code,
      redirect_uri: `${env.appUrl}/api/auth/callback`,
    }),
    cache: "no-store",
  });

  const token = (await tokenRes.json()) as TokenResponse;
  if (!tokenRes.ok || !token.access_token) {
    return NextResponse.redirect(`${env.appUrl}/login?error=token`);
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token.access_token}`,
      "User-Agent": "dolphin-project-manager",
    },
    cache: "no-store",
  });

  if (!userRes.ok) {
    return NextResponse.redirect(`${env.appUrl}/login?error=profile`);
  }

  const profile = (await userRes.json()) as GithubUser;

  db.prepare(
    `INSERT INTO users (github_id, login, name, avatar_url, access_token)
     VALUES (@github_id, @login, @name, @avatar_url, @access_token)
     ON CONFLICT(github_id) DO UPDATE SET
       login        = excluded.login,
       name         = excluded.name,
       avatar_url   = excluded.avatar_url,
       access_token = excluded.access_token,
       updated_at   = datetime('now')`,
  ).run({
    github_id: profile.id,
    login: profile.login,
    name: profile.name,
    avatar_url: profile.avatar_url,
    access_token: encryptSecret(token.access_token),
  });

  const user = db
    .prepare(`SELECT id FROM users WHERE github_id = ?`)
    .get(profile.id) as { id: number };

  const hasRepos = db
    .prepare(`SELECT COUNT(*) AS count FROM repos WHERE user_id = ?`)
    .get(user.id) as { count: number };

  const { token: sessionToken, expiresAt } = createSession(user.id);

  const response = NextResponse.redirect(
    `${env.appUrl}${hasRepos.count > 0 ? "/" : "/repos"}`,
  );
  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    secure: env.appUrl.startsWith("https://"),
  });
  response.cookies.delete("dolphin_oauth_state");

  return response;
}
