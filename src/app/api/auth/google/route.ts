import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3012"}/login?error=google_not_configured`
    );
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3012";
  const state = randomUUID();
  const store = await cookies();
  store.set("oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
