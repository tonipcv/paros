import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPages = ["/chat", "/characters", "/studio", "/keys", "/billing", "/settings", "/usage", "/onboarding"];

function withPrivacyHeaders(res: NextResponse, pathname: string) {
  // Never let inference/API responses be cached by intermediaries.
  if (pathname.startsWith("/api/")) {
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  }
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  return res;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession =
    request.cookies.has("nebula_session") || request.cookies.has("__Host-nebula_session");

  if (protectedPages.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }
  return withPrivacyHeaders(NextResponse.next(), pathname);
}

export const config = {
  matcher: [
    "/chat/:path*",
    "/characters/:path*",
    "/studio/:path*",
    "/keys/:path*",
    "/billing/:path*",
    "/settings/:path*",
    "/usage/:path*",
    "/onboarding/:path*",
    "/api/:path*",
  ],
};
