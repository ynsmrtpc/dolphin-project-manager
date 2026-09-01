import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { env, isGithubConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isGithubConfigured()) {
    return NextResponse.redirect(`${env.appUrl}/login?error=not_configured`);
  }

  const state = randomBytes(16).toString("hex");

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", env.githubClientId);
  authorizeUrl.searchParams.set("redirect_uri", `${env.appUrl}/api/auth/callback`);
  // `repo` private repolari da listeleyebilmek icin gerekli.
  authorizeUrl.searchParams.set("scope", "repo read:user read:org");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl.toString());
  response.cookies.set("dolphin_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
    secure: env.appUrl.startsWith("https://"),
  });

  return response;
}
