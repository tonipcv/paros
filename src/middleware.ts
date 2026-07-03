import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPages = ["/chat", "/characters", "/studio", "/keys", "/billing", "/settings", "/usage", "/onboarding"];

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
  return NextResponse.next();
}

export const config = {
  matcher: ["/chat/:path*", "/characters/:path*", "/studio/:path*", "/keys/:path*", "/billing/:path*", "/settings/:path*", "/usage/:path*", "/onboarding/:path*"],
};
