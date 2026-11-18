import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "admin_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Token format: base64url(expiryMs).base64url(HMAC-SHA256(payload)). */
export function createSessionToken(secret: string, now: number = Date.now()): string {
  const payload = Buffer.from(String(now + SESSION_TTL_MS)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  now: number = Date.now(),
): boolean {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  if (!safeEqual(sig, sign(payload, secret))) return false;
  const expiry = Number(Buffer.from(payload, "base64url").toString());
  return Number.isFinite(expiry) && expiry > now;
}

/** Timing-safe compare; hashes first so differing lengths do not leak or throw. */
export function checkPassword(input: string, expected: string): boolean {
  const a = createHmac("sha256", "pw").update(input).digest();
  const b = createHmac("sha256", "pw").update(expected).digest();
  return timingSafeEqual(a, b);
}

export const MIN_SECRET_LENGTH = 32;

/** A session secret shorter than MIN_SECRET_LENGTH counts as not configured. */
export function isSecretValid(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.length >= MIN_SECRET_LENGTH;
}

/**
 * Best-effort in-memory limiter. On serverless each instance has its own
 * memory, so limits are per-instance and reset on cold start.
 * Memory is bounded: expired keys are dropped, the map is swept when it
 * reaches `maxKeys`, and the oldest key is evicted if it is still full.
 */
export function createRateLimiter(opts: { max: number; windowMs: number; maxKeys?: number }) {
  const maxKeys = opts.maxKeys ?? 5000;
  const hits = new Map<string, number[]>();

  function sweep(now: number) {
    for (const [k, ts] of hits) {
      if (!ts.some((t) => now - t < opts.windowMs)) hits.delete(k);
    }
  }

  return {
    /** Records a hit; returns false when blocked. */
    hit(key: string, now: number = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < opts.windowMs);
      if (recent.length >= opts.max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      if (!hits.has(key) && hits.size >= maxKeys) {
        sweep(now);
        while (hits.size >= maxKeys) {
          const oldest = hits.keys().next().value;
          if (oldest === undefined) break;
          hits.delete(oldest);
        }
      }
      hits.set(key, recent);
      return true;
    },
    reset(key: string): void {
      hits.delete(key);
    },
    size(): number {
      return hits.size;
    },
  };
}

export async function isAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!isSecretValid(secret) || !process.env.ADMIN_PASSWORD) return false;
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value, secret);
}
