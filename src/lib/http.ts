import { NextResponse } from "next/server";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function isEmail(value: unknown): value is string {
  return typeof value === "string" && /.+@.+\..+/.test(value);
}
