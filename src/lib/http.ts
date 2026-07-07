import { NextResponse } from "next/server";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Consistent route error handling: only surface 401 for auth failures; everything
// else is logged server-side and returned as a generic 500 (no internal leakage).
export function handleRouteError(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  if (message === "Authentication required") return error("Authentication required", 401);
  console.error("Route error:", e);
  return error("Something went wrong", 500);
}

export function isEmail(value: unknown): value is string {
  return typeof value === "string" && /.+@.+\..+/.test(value);
}
