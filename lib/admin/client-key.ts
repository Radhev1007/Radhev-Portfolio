/**
 * Rate-limit key for a request. Prefers headers set by the trusted edge
 * (x-vercel-forwarded-for, x-real-ip), then the LAST x-forwarded-for hop
 * (the one appended by our own proxy; earlier entries are client-supplied).
 */
export function clientKey(headers: Headers): string {
  const vercel = headers.get("x-vercel-forwarded-for")?.trim();
  if (vercel) return vercel;
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const hops = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  if (hops && hops.length) return hops[hops.length - 1];
  return "unknown";
}
