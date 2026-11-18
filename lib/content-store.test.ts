import { describe, expect, it, vi } from "vitest";
import { defaultContent } from "@/lib/content";
import { loadContent, loadContentCached, saveContent, type ContentDb } from "@/lib/content-store";

function fakeDb(initial: unknown | null = null, opts: { failRead?: boolean; failWrite?: boolean } = {}) {
  let doc = initial;
  let writes = 0;
  const db: ContentDb = {
    async read() {
      if (opts.failRead) throw new Error("boom");
      return doc;
    },
    async write(d) {
      if (opts.failWrite) throw new Error("boom");
      writes++;
      doc = d;
    },
  };
  return { db, writes: () => writes };
}

const edited = () => {
  const c = structuredClone(defaultContent);
  c.site.name.first = "Edited Name";
  return c;
};

describe("loadContent", () => {
  it("empty DB -> defaults", async () => {
    const r = await loadContent(fakeDb(null).db);
    expect(r.source).toBe("defaults");
    expect(r.content).toEqual(defaultContent);
  });
  it("valid stored doc -> database", async () => {
    const r = await loadContent(fakeDb(edited()).db);
    expect(r.source).toBe("database");
    expect(r.content.site.name.first).toBe("Edited Name");
  });
  it("missing required field -> invalid (content is the defaults, issues say why)", async () => {
    const bad: Record<string, unknown> = structuredClone(edited());
    delete bad.projects;
    const r = await loadContent(fakeDb(bad).db);
    expect(r.source).toBe("invalid");
    expect(r.content).toEqual(defaultContent);
    expect(r.issues?.some((i) => i.path === "projects")).toBe(true);
    expect(r.error).toBeUndefined();
  });
  it("empty DB is 'defaults' with no issues (distinct from invalid)", async () => {
    const r = await loadContent(fakeDb(null).db);
    expect(r.source).toBe("defaults");
    expect(r.issues).toBeUndefined();
  });
  it("extra unknown field is stripped", async () => {
    const r = await loadContent(fakeDb({ ...edited(), extra: 1 }).db);
    expect(r.source).toBe("database");
    expect("extra" in r.content).toBe(false);
  });
  it("read throws -> defaults, flagged as error", async () => {
    const r = await loadContent(fakeDb(null, { failRead: true }).db);
    expect(r.source).toBe("defaults");
    expect(r.error).toBe(true);
  });
  it("empty DB is not an error", async () => {
    expect((await loadContent(fakeDb(null).db)).error).toBeUndefined();
  });
  it("null db -> defaults", async () => {
    const r = await loadContent(null);
    expect(r.source).toBe("defaults");
    expect(r.content).toEqual(defaultContent);
  });
});

describe("saveContent", () => {
  it("invalid input -> 400, nothing written", async () => {
    const f = fakeDb();
    const r = await saveContent({ nope: true }, f.db);
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(f.writes()).toBe(0);
  });
  it("write throws -> 503", async () => {
    const r = await saveContent(edited(), fakeDb(null, { failWrite: true }).db);
    expect(r).toMatchObject({ ok: false, status: 503 });
  });
  it("no db -> 503", async () => {
    const r = await saveContent(edited(), null);
    expect(r).toMatchObject({ ok: false, status: 503 });
  });
  it("valid save then load returns it, and revalidates", async () => {
    const f = fakeDb();
    let revalidated = 0;
    const r = await saveContent(edited(), f.db, () => void revalidated++);
    expect(r).toEqual({ ok: true });
    expect(revalidated).toBe(1);
    expect((await loadContent(f.db)).content.site.name.first).toBe("Edited Name");
  });
});

describe("loadContentCached (cache never stores failures)", () => {
  // Minimal fake cache: stores only on successful resolution, like unstable_cache.
  function fakeCache() {
    const store: { v?: unknown } = {};
    const wrap = async (fn: () => Promise<any>) => {
      if ("v" in store) return store.v;
      const v = await fn();
      store.v = v;
      return v;
    };
    return { store, wrap };
  }
  it("read failure -> defaults for this request, cache stays empty", async () => {
    const c = fakeCache();
    const r = await loadContentCached(fakeDb(null, { failRead: true }).db, c.wrap);
    expect(r).toEqual(defaultContent);
    expect("v" in c.store).toBe(false);
  });
  it("recovers after a failure", async () => {
    const c = fakeCache();
    await loadContentCached(fakeDb(null, { failRead: true }).db, c.wrap);
    const r = await loadContentCached(fakeDb(edited()).db, c.wrap);
    expect(r.site.name.first).toBe("Edited Name");
  });
  it("empty table -> defaults and cacheable", async () => {
    const c = fakeCache();
    const r = await loadContentCached(fakeDb(null).db, c.wrap);
    expect(r).toEqual(defaultContent);
    expect("v" in c.store).toBe(true);
  });
  it("invalid stored doc -> defaults and cacheable", async () => {
    const c = fakeCache();
    await loadContentCached(fakeDb({ bad: 1 }).db, c.wrap);
    expect("v" in c.store).toBe(true);
  });
});

describe("cachedLoad options", () => {
  it("gives the cache entry a revalidate time and the content tag", async () => {
    vi.resetModules();
    const calls: { opts: { tags?: string[]; revalidate?: number | false } }[] = [];
    vi.doMock("next/cache", () => ({
      unstable_cache: (fn: unknown, _keys: unknown, opts: { tags?: string[]; revalidate?: number | false }) => {
        calls.push({ opts });
        return fn;
      },
      revalidateTag: () => {},
    }));
    await import("@/lib/content-store");
    vi.doUnmock("next/cache");
    expect(calls).toHaveLength(1);
    expect(calls[0].opts.revalidate).toBe(300);
    expect(calls[0].opts.tags).toEqual(["content"]);
  });
});
