import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { SESSION_COOKIE, deleteSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function signOut(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) deleteSession(token);

  const response = NextResponse.redirect(`${env.appUrl}/login`, 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export const GET = signOut;
export const POST = signOut;
