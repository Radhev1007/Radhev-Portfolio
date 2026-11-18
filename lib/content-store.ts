import "server-only";
import { defaultContent, type ContentData } from "@/lib/content";
import { unstable_cache } from "next/cache";
import { parseContent } from "@/lib/content-schema";

/**
 * Content store: one JSON document in Postgres (Neon), validated on the way in
 * and on the way out. Everything above `getContent` is free of Next imports so
 * it can be unit-tested with a fake ContentDb; `next/cache` and the Neon driver
 * are loaded lazily, only when actually used.
 */

export const CONTENT_TAG = "content";

export type ContentDb = {
  read(): Promise<unknown | null>;
  write(doc: unknown): Promise<void>;
};

export type ContentIssue = { path: string; message: string };

/**
 * "database": a valid stored doc. "defaults": nothing stored (or no store). "invalid": a doc is stored but
 * fails validation; `content` is the built-in content (what the public site shows) and `issues` says why.
 */
export type LoadSource = "database" | "defaults" | "invalid";

export type LoadResult = { content: ContentData; source: LoadSource; issues?: ContentIssue[]; error?: boolean };

export type SaveResult =
  | { ok: true }
  | {
      ok: false;
      status: 400 | 503;
      message: string;
      issues?: { path: string; message: string }[];
    };

const isStatic = () => process.env.STATIC_EXPORT === "1";

const MISSING_TABLE = "42P01";
const isMissingTable = (e: unknown) => (e as { code?: string } | null)?.code === MISSING_TABLE;

/** Neon-backed store, or null when there is no DATABASE_URL (or in static export). */
export function neonDb(): ContentDb | null {
  const url = process.env.DATABASE_URL;
  if (!url || isStatic()) return null;

  let client: Promise<import("@neondatabase/serverless").NeonQueryFunction<false, false>> | null = null;
  const sql = () =>
    (client ??= import("@neondatabase/serverless").then(({ neon }) => neon(url))).catch((e) => {
      client = null;
      throw e;
    });
  const createTable = async (q: Awaited<ReturnType<typeof sql>>) => {
    await q`CREATE TABLE IF NOT EXISTS content (
      id int PRIMARY KEY,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
  };
  const upsert = (q: Awaited<ReturnType<typeof sql>>, doc: unknown) =>
    q`INSERT INTO content (id, data, updated_at)
      VALUES (1, ${JSON.stringify(doc)}::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;

  return {
    // SELECT first: a missing table (first ever read) is "empty", not an error,
    // and needs no CREATE privilege.
    async read() {
      const q = await sql();
      try {
        const rows = (await q`SELECT data FROM content WHERE id = 1`) as { data: unknown }[];
        return rows.length ? rows[0].data : null;
      } catch (e) {
        if (isMissingTable(e)) return null;
        throw e;
      }
    },
    // Only create the table when the write finds it missing.
    async write(doc) {
      const q = await sql();
      try {
        await upsert(q, doc);
      } catch (e) {
        if (!isMissingTable(e)) throw e;
        await createTable(q);
        await upsert(q, doc);
      }
    },
  };
}

/**
 * Throws if the store cannot be read (driver/network error). An empty store or
 * an invalid stored doc is NOT an error: it resolves to the defaults (source "invalid", with the issues).
 */
export async function loadContentStrict(db: ContentDb | null): Promise<Omit<LoadResult, "error">> {
  if (!db) return { content: defaultContent, source: "defaults" };
  const raw = await db.read();
  if (raw == null) return { content: defaultContent, source: "defaults" };
  const parsed = parseContent(raw);
  return parsed.ok
    ? { content: parsed.data, source: "database" }
    : { content: defaultContent, source: "invalid", issues: parsed.issues };
}

/** Never throws. `error: true` means the store was unreachable (not merely empty). */
export async function loadContent(db: ContentDb | null): Promise<LoadResult> {
  try {
    return await loadContentStrict(db);
  } catch {
    return { content: defaultContent, source: "defaults", error: true };
  }
}

/**
 * Cache-aware read. `wrap` is the cache (unstable_cache in production). The
 * strict loader throws on read failure so the cache never stores a fallback;
 * the catch sits OUTSIDE the cache and only affects this request.
 */
export async function loadContentCached(
  db: ContentDb | null,
  wrap: (fn: () => Promise<ContentData>) => Promise<ContentData> = (fn) => fn(),
): Promise<ContentData> {
  try {
    return await wrap(async () => (await loadContentStrict(db)).content);
  } catch {
    return defaultContent;
  }
}

async function revalidateContent(): Promise<void> {
  const { revalidateTag } = await import("next/cache");
  // expire: 0 -> the next request blocks on fresh data, so an admin save is visible immediately.
  revalidateTag(CONTENT_TAG, { expire: 0 });
}

/**
 * Validate, write, then revalidate. `db === undefined` means "use Neon";
 * `null` means no store is configured. `revalidate` is injectable for tests.
 */
export async function saveContent(
  content: unknown,
  db?: ContentDb | null,
  revalidate: () => void | Promise<void> = revalidateContent,
): Promise<SaveResult> {
  const parsed = parseContent(content);
  if (!parsed.ok) {
    return { ok: false, status: 400, message: "Content failed validation", issues: parsed.issues };
  }
  const store = db === undefined ? neonDb() : db;
  if (!store) return { ok: false, status: 503, message: "No database is configured" };
  try {
    await store.write(parsed.data);
  } catch {
    return { ok: false, status: 503, message: "Could not write to the database" };
  }
  try {
    await revalidate();
  } catch {
    // The data is saved; a failed revalidation only delays visibility.
  }
  return { ok: true };
}

const cachedLoad = unstable_cache(async () => (await loadContentStrict(neonDb())).content, ["site-content"], {
  tags: [CONTENT_TAG],
  // A page's prerender inherits this entry's tags and revalidate time. Without an expiry, a DB failure at
  // build time (or on the first render after a save) would bake the fallback defaults into the page until
  // the next save. Failures are never stored in the data cache (the strict loader throws), but the page
  // that rendered them is; this makes every page re-render, and so self-heal, within 5 minutes.
  revalidate: 300,
});

/**
 * Server-only, cached under CONTENT_TAG. `unstable_cache` is used because this
 * repo does not enable cacheComponents (so `use cache` is unavailable) and it
 * keeps public pages static until `revalidateTag(CONTENT_TAG)` fires. Read
 * failures throw inside the cache (so nothing is stored) and fall back to the
 * defaults outside it.
 */
export async function getContent(): Promise<ContentData> {
  if (isStatic() || !process.env.DATABASE_URL) return defaultContent;
  return loadContentCached(neonDb(), () => cachedLoad());
}

/** Uncached, for the admin API: includes the source and whether the DB was unreachable. */
export async function getContentWithSource(): Promise<LoadResult> {
  return loadContent(neonDb());
}
