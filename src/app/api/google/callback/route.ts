import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findOrCreateOAuthUser } from "@/lib/account";
import { createSession, setSessionCookie } from "@/lib/auth";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3012";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const savedState = store.get("oauth_state")?.value;

  if (!code || !state || state !== savedState) {
    console.error("google_oauth_state_mismatch", {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      hasSavedState: Boolean(savedState),
    });
    return NextResponse.redirect(`${appUrl}/login?error=oauth_failed`);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: `${appUrl}/api/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      throw new Error(`token_exchange_failed: ${tokens.error || "?"} ${tokens.error_description || ""}`);
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();
    if (!profile.email) throw new Error("No email in profile");
    if (profile.verified_email === false) throw new Error("Email not verified");

    const user = await findOrCreateOAuthUser({ name: profile.name || "", email: profile.email });
    const token = await createSession(user.id);
    await setSessionCookie(token);
    store.delete("oauth_state");
    return NextResponse.redirect(`${appUrl}/chat`);
  } catch (e) {
    console.error("google_oauth_failed", e instanceof Error ? e.message : e);
    return NextResponse.redirect(`${appUrl}/login?error=oauth_failed`);
  }
}
