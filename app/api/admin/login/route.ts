import { NextResponse } from "next/server";
import { csrfRejection } from "@/lib/admin/csrf";
import { clientKey } from "@/lib/admin/client-key";
import {
  ADMIN_COOKIE,
  SESSION_TTL_MS,
  checkPassword,
  createRateLimiter,
  createSessionToken,
  isSecretValid,
} from "@/lib/admin/auth";

// 5 attempts per IP per 15 minutes (best-effort, per server instance).
const limiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

const MAX_BODY_BYTES = 1024;

export async function POST(request: Request) {
  const rejected = csrfRejection(request);
  if (rejected) return rejected;
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!password || !isSecretValid(secret)) {
    return NextResponse.json({ error: "Admin not configured" }, { status: 503 });
  }

  const ip = clientKey(request.headers);
  if (!limiter.hit(ip)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let input: unknown;
  try {
    input = JSON.parse(raw)?.password;
  } catch {
    input = undefined;
  }
  if (typeof input !== "string" || !checkPassword(input, password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  limiter.reset(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return res;
}
