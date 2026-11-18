import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin/auth";
import { csrfRejection } from "@/lib/admin/csrf";

export async function POST(request: Request) {
  const rejected = csrfRejection(request);
  if (rejected) return rejected;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
