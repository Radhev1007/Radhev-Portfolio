import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultContent } from "@/lib/content";
import type { ContentDb } from "@/lib/content-store";

const state = vi.hoisted(() => ({
  admin: true,
  db: null as unknown,
}));

vi.mock("@/lib/admin/auth", () => ({ isAdmin: async () => state.admin }));
vi.mock("@/lib/content-store", async (orig) => ({
  ...(await orig<typeof import("@/lib/content-store")>()),
  neonDb: () => state.db,
}));

const revalidateTag = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidateTag, unstable_cache: (fn: unknown) => fn }));

import { GET, PUT } from "./route";
import { POST as RESET } from "./reset/route";

let lastDoc: unknown = null;
function makeDb(opts: { failWrite?: boolean; failRead?: boolean; initial?: unknown } = {}) {
  let doc: unknown = opts.initial ?? null;
  lastDoc = null;
  const db: ContentDb = {
    async read() {
      if (opts.failRead) throw new Error("boom");
      return doc;
    },
    async write(d) {
      if (opts.failWrite) throw new Error("boom");
      doc = d;
      lastDoc = d;
    },
  };
  return db;
}

const put = (body: unknown, raw?: string, headers: Record<string, string> = {}) =>
  PUT(
    new Request("http://x/api/admin/content", {
      method: "PUT",
      body: raw ?? JSON.stringify(body),
      headers: { "content-type": "application/json", ...headers },
    }),
  );
const reset = (headers: Record<string, string> = {}) =>
  RESET(new Request("http://x/api/admin/content/reset", { method: "POST", headers }));

beforeEach(() => {
  state.admin = true;
  state.db = makeDb();
  revalidateTag.mockClear();
});

describe("auth", () => {
  it("401 on GET/PUT/reset when not admin, before reading the body", async () => {
    state.admin = false;
    const get = await GET();
    expect(get.status).toBe(401);
    const badBody = await put(null, "{not json");
    expect(badBody.status).toBe(401);
    expect((await reset()).status).toBe(401);
    expect(get.headers.get("cache-control")).toBe("no-store");
  });
});

describe("GET", () => {
  it("db read failure -> 200 with error flag and defaults", async () => {
    state.db = makeDb({ failRead: true });
    const res = await GET();
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j.error).toBe(true);
    expect(j.source).toBe("defaults");
    expect(j.content).toEqual(defaultContent);
  });
  it("returns defaults + configured true with a db", async () => {
    const res = await GET();
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j.source).toBe("defaults");
    expect(j.configured).toBe(true);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("a stored doc that fails validation -> source invalid, defaults content, issues", async () => {
    state.db = makeDb({ initial: { ...structuredClone(defaultContent), experience: [] } });
    const res = await GET();
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j.source).toBe("invalid");
    expect(j.error).toBeUndefined();
    expect(j.content).toEqual(defaultContent);
    expect(j.issues.some((i: { path: string }) => i.path === "experience")).toBe(true);
  });
  it("configured false without a db", async () => {
    state.db = null;
    const j = await (await GET()).json();
    expect(j.configured).toBe(false);
    expect(j.source).toBe("defaults");
  });
});

describe("PUT", () => {
  it("duplicate slug -> 400 with issues path", async () => {
    const c = structuredClone(defaultContent);
    c.projects[1].slug = c.projects[0].slug;
    const res = await put(c);
    const j = await res.json();
    expect(res.status).toBe(400);
    expect(j.issues[0].path).toMatch(/slug/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(revalidateTag).not.toHaveBeenCalled();
  });
  it("cross-origin PUT with admin session -> 403, writes nothing", async () => {
    const res = await put(defaultContent, undefined, { origin: "http://evil.test", "sec-fetch-site": "cross-site" });
    expect(res.status).toBe(403);
    expect(lastDoc).toBeNull();
    expect(revalidateTag).not.toHaveBeenCalled();
  });
  it("non-JSON content-type -> 415", async () => {
    const res = await PUT(
      new Request("http://x/api/admin/content", {
        method: "PUT",
        body: JSON.stringify(defaultContent),
        headers: { "content-type": "text/plain" },
      }),
    );
    expect(res.status).toBe(415);
    expect(lastDoc).toBeNull();
  });
  it("declared content-length over cap -> 413 early", async () => {
    const res = await put(null, "{}", { "content-length": String(1024 * 1024 + 1) });
    expect(res.status).toBe(413);
  });
  it("valid -> 200 and GET shows it", async () => {
    const c = structuredClone(defaultContent);
    c.site.name.first = "Edited Name";
    expect((await put(c)).status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledTimes(1);
    const j = await (await GET()).json();
    expect(j.source).toBe("database");
    expect(j.content.site.name.first).toBe("Edited Name");
  });
  it("db write failure -> 503", async () => {
    state.db = makeDb({ failWrite: true });
    const res = await put(defaultContent);
    expect(res.status).toBe(503);
    expect((await res.json()).message).toBeTruthy();
    expect(revalidateTag).not.toHaveBeenCalled();
  });
  it("no db -> 503", async () => {
    state.db = null;
    expect((await put(defaultContent)).status).toBe(503);
  });
  it("invalid JSON -> 400", async () => {
    expect((await put(null, "{nope")).status).toBe(400);
  });
  it("oversized body -> 413", async () => {
    expect((await put(null, " ".repeat(1024 * 1024 + 1))).status).toBe(413);
  });
});

describe("reset", () => {
  it("writes defaults", async () => {
    expect((await reset()).status).toBe(200);
    expect(lastDoc).toEqual(defaultContent);
    expect(revalidateTag).toHaveBeenCalledTimes(1);
    expect((await (await GET()).json()).source).toBe("database");
  });
  it("503 without db", async () => {
    state.db = null;
    expect((await reset()).status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
  it("cross-origin reset -> 403, writes nothing", async () => {
    expect((await reset({ origin: "http://evil.test" })).status).toBe(403);
    expect(lastDoc).toBeNull();
  });
});
