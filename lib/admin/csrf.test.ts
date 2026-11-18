import { describe, expect, it } from "vitest";
import { csrfRejection, isSameOriginRequest } from "@/lib/admin/csrf";

const req = (h: Record<string, string>, method = "PUT") => ({
  method,
  url: "http://site.test/api/admin/content",
  headers: new Headers(h),
});

describe("isSameOriginRequest", () => {
  it("allows same-origin", () => {
    expect(isSameOriginRequest(req({ "sec-fetch-site": "same-origin", origin: "http://site.test" }))).toBe(true);
    expect(isSameOriginRequest(req({ "sec-fetch-site": "none" }))).toBe(true);
  });
  it("rejects cross-site Sec-Fetch-Site", () => {
    expect(isSameOriginRequest(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOriginRequest(req({ "sec-fetch-site": "same-site" }))).toBe(false);
  });
  it("rejects mismatched Origin", () => {
    expect(isSameOriginRequest(req({ origin: "http://evil.test" }))).toBe(false);
    expect(isSameOriginRequest(req({ origin: "null" }))).toBe(false);
  });
  it("allows when both headers are absent", () => {
    expect(isSameOriginRequest(req({}))).toBe(true);
  });
});

describe("csrfRejection", () => {
  it("415 on wrong content-type when JSON required", () => {
    expect(csrfRejection(req({ "content-type": "text/plain" }), { requireJson: true })?.status).toBe(415);
    expect(csrfRejection(req({}), { requireJson: true })?.status).toBe(415);
  });
  it("accepts json with charset", () => {
    expect(csrfRejection(req({ "content-type": "application/json; charset=utf-8" }), { requireJson: true })).toBeNull();
  });
  it("403 on cross-origin", () => {
    expect(csrfRejection(req({ origin: "http://evil.test" }))?.status).toBe(403);
  });
});
