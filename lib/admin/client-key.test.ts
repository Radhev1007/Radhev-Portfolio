import { describe, expect, it } from "vitest";
import { clientKey } from "@/lib/admin/client-key";

const h = (o: Record<string, string>) => new Headers(o);

describe("clientKey", () => {
  it("prefers x-vercel-forwarded-for over everything", () => {
    expect(
      clientKey(h({ "x-vercel-forwarded-for": "1.1.1.1", "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" })),
    ).toBe("1.1.1.1");
  });
  it("then x-real-ip", () => {
    expect(clientKey(h({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" }))).toBe("2.2.2.2");
  });
  it("then the last x-forwarded-for hop", () => {
    expect(clientKey(h({ "x-forwarded-for": "3.3.3.3, 4.4.4.4" }))).toBe("4.4.4.4");
  });
  it("ignores client-supplied leading XFF entries (spoof)", () => {
    const a = clientKey(h({ "x-forwarded-for": "6.6.6.6, 9.9.9.9" }));
    const b = clientKey(h({ "x-forwarded-for": "7.7.7.7, 9.9.9.9" }));
    expect(a).toBe("9.9.9.9");
    expect(b).toBe("9.9.9.9");
    expect(clientKey(h({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });
  it("falls back to unknown", () => {
    expect(clientKey(h({}))).toBe("unknown");
    expect(clientKey(h({ "x-forwarded-for": " , " }))).toBe("unknown");
  });
});
