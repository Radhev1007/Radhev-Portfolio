import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  checkPassword,
  createRateLimiter,
  createSessionToken,
  isAdmin,
  isSecretValid,
  verifySessionToken,
} from "@/lib/admin/auth";

const SECRET = "test-secret";
const DAY = 24 * 60 * 60 * 1000;

describe("session token", () => {
  it("round-trips", () => {
    const t = createSessionToken(SECRET, 1000);
    expect(verifySessionToken(t, SECRET, 2000)).toBe(true);
  });
  it("rejects expired", () => {
    const t = createSessionToken(SECRET, 1000);
    expect(verifySessionToken(t, SECRET, 1000 + 7 * DAY + 1)).toBe(false);
  });
  it("rejects tampered payload", () => {
    const t = createSessionToken(SECRET, 1000);
    const [, sig] = t.split(".");
    const forged = Buffer.from(String(1000 + 100 * DAY)).toString("base64url");
    expect(verifySessionToken(`${forged}.${sig}`, SECRET, 2000)).toBe(false);
  });
  it("rejects wrong secret", () => {
    const t = createSessionToken(SECRET, 1000);
    expect(verifySessionToken(t, "other", 2000)).toBe(false);
  });
  it("rejects undefined and garbage", () => {
    expect(verifySessionToken(undefined, SECRET)).toBe(false);
    expect(verifySessionToken("garbage", SECRET)).toBe(false);
    expect(verifySessionToken("", SECRET)).toBe(false);
  });
});

describe("checkPassword", () => {
  it("matches and mismatches", () => {
    expect(checkPassword("abc", "abc")).toBe(true);
    expect(checkPassword("abd", "abc")).toBe(false);
  });
  it("handles different lengths without throwing", () => {
    expect(checkPassword("a", "abcdef")).toBe(false);
    expect(checkPassword("", "abc")).toBe(false);
  });
});

describe("rate limiter", () => {
  it("allows 5 hits, blocks 6th, allows after window", () => {
    const l = createRateLimiter({ max: 5, windowMs: 1000 });
    for (let i = 0; i < 5; i++) expect(l.hit("ip", 0)).toBe(true);
    expect(l.hit("ip", 10)).toBe(false);
    expect(l.hit("other", 10)).toBe(true);
    expect(l.hit("ip", 1001)).toBe(true);
  });
});

describe("limiter bounds", () => {
  it("removes expired keys when swept", () => {
    const l = createRateLimiter({ max: 5, windowMs: 1000, maxKeys: 3 });
    l.hit("a", 0);
    l.hit("b", 0);
    l.hit("c", 0);
    expect(l.size()).toBe(3);
    l.hit("d", 5000); // full: sweep drops expired a,b,c
    expect(l.size()).toBe(1);
  });
  it("stays bounded with many distinct keys", () => {
    const l = createRateLimiter({ max: 5, windowMs: 60_000, maxKeys: 100 });
    for (let i = 0; i < 10_000; i++) l.hit(`ip-${i}`, i);
    expect(l.size()).toBeLessThanOrEqual(100);
  });
  it("reset removes the key", () => {
    const l = createRateLimiter({ max: 5, windowMs: 1000 });
    l.hit("a", 0);
    l.reset("a");
    expect(l.size()).toBe(0);
  });
});

describe("token edge cases", () => {
  const b64 = (s: string) => Buffer.from(s).toString("base64url");
  const signed = (payload: string) =>
    `${payload}.${createHmac("sha256", SECRET).update(payload).digest("base64url")}`;
  it("rejects extra dots and empty payload", () => {
    const t = createSessionToken(SECRET, 1000);
    expect(verifySessionToken(`${t}.x`, SECRET, 2000)).toBe(false);
    expect(verifySessionToken(`.${t.split(".")[1]}`, SECRET, 2000)).toBe(false);
    expect(verifySessionToken(signed(""), SECRET, 2000)).toBe(false);
  });
  it("rejects a correctly signed non-numeric payload", () => {
    expect(verifySessionToken(signed(b64("not-a-number")), SECRET, 2000)).toBe(false);
  });
});

describe("secret length", () => {
  it("requires at least 32 chars", () => {
    expect(isSecretValid("x".repeat(31))).toBe(false);
    expect(isSecretValid("x".repeat(32))).toBe(true);
    expect(isSecretValid(undefined)).toBe(false);
  });
  it("isAdmin is false with a short secret", async () => {
    process.env.ADMIN_PASSWORD = "pw";
    process.env.ADMIN_SESSION_SECRET = "short";
    expect(await isAdmin()).toBe(false);
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_SESSION_SECRET;
  });
});
