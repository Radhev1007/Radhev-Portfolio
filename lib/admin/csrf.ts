/**
 * Pure CSRF guard for cookie-authenticated state changes (defence in depth on
 * top of SameSite=Lax). Requests with neither Sec-Fetch-Site nor Origin
 * (curl, server-side) are allowed.
 */
export function isSameOriginRequest(req: { method: string; headers: Headers; url: string }): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.get("origin");
  if (origin !== null) {
    try {
      if (origin !== new URL(req.url).origin) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function isJsonRequest(headers: Headers): boolean {
  const type = headers.get("content-type") ?? "";
  return type.split(";")[0].trim().toLowerCase() === "application/json";
}

/** A Response to return when the request must be rejected, else null. */
export function csrfRejection(
  req: { method: string; headers: Headers; url: string },
  opts: { requireJson?: boolean } = {},
): Response | null {
  const noStore = { "Cache-Control": "no-store" };
  if (!isSameOriginRequest(req)) {
    return Response.json({ error: "Cross-origin request rejected" }, { status: 403, headers: noStore });
  }
  if (opts.requireJson && !isJsonRequest(req.headers)) {
    return Response.json({ error: "Content-Type must be application/json" }, { status: 415, headers: noStore });
  }
  return null;
}
