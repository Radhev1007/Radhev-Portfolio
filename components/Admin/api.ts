/**
 * Client-side calls to the admin API (app/api/admin/*). Every call is same-origin (the CSRF guard in
 * lib/admin/csrf.ts rejects anything else) and every result is a plain union, never a throw, so the
 * editor can show a message for each case. A 401 is its own kind so the caller can return to the login form.
 */
import type { ContentData } from "@/lib/content";

export type Issue = { path: string; message: string };

export type ApiResult<T = unknown> =
  | ({ kind: "ok" } & T)
  | { kind: "unauthorized" }
  | { kind: "invalid"; issues: Issue[] }
  | { kind: "error"; status: number; message: string };

export type LoadedContent = {
  content: ContentData;
  /** "invalid": a stored document fails validation; the content shown is the built-in content (see `issues`). */
  source: "database" | "defaults" | "invalid";
  issues?: Issue[];
  /** The database is configured but could not be read: the content shown is the built-in defaults. */
  error?: boolean;
};

/** Reads a JSON body if there is one; a proxy's HTML error page (e.g. a platform 413) yields null. */
async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await res.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function messageFrom(body: Record<string, unknown> | null, fallback: string): string {
  const m = body?.message ?? body?.error;
  return typeof m === "string" && m.trim() ? m : fallback;
}

async function call(input: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(input, { credentials: "same-origin", cache: "no-store", ...init });
  } catch {
    return null;
  }
}

const OFFLINE = { kind: "error", status: 0, message: "Could not reach the server. Check your connection and try again." } as const;

export async function login(password: string): Promise<ApiResult> {
  const res = await call("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res) return OFFLINE;
  if (res.ok) return { kind: "ok" };
  const body = await readJson(res);
  switch (res.status) {
    case 401:
      return { kind: "error", status: 401, message: "That password is not correct." };
    case 429:
      return { kind: "error", status: 429, message: "Too many attempts. Wait 15 minutes, then try again." };
    case 503:
      return {
        kind: "error",
        status: 503,
        message: "The admin is not set up on the server (ADMIN_PASSWORD and ADMIN_SESSION_SECRET are needed).",
      };
    default:
      return { kind: "error", status: res.status, message: messageFrom(body, `Sign-in failed (status ${res.status}).`) };
  }
}

export async function logout(): Promise<boolean> {
  const res = await call("/api/admin/logout", { method: "POST" });
  return Boolean(res?.ok);
}

export async function loadContent(): Promise<ApiResult<LoadedContent & { configured: boolean }>> {
  const res = await call("/api/admin/content", { method: "GET" });
  if (!res) return OFFLINE;
  if (res.status === 401) return { kind: "unauthorized" };
  const body = await readJson(res);
  if (!res.ok || !body || typeof body.content !== "object") {
    return { kind: "error", status: res.status, message: messageFrom(body, `Could not load the content (status ${res.status}).`) };
  }
  return {
    kind: "ok",
    content: body.content as ContentData,
    source: body.source === "database" || body.source === "invalid" ? body.source : "defaults",
    issues: body.source === "invalid" && Array.isArray(body.issues) ? (body.issues as Issue[]) : undefined,
    error: body.error === true,
    configured: body.configured === true,
  };
}

/** Shared handling for the two writes (save, reset): 200, 400 with issues, or a message. */
async function write(input: string, init: RequestInit): Promise<ApiResult> {
  const res = await call(input, init);
  if (!res) return OFFLINE;
  if (res.ok) return { kind: "ok" };
  if (res.status === 401) return { kind: "unauthorized" };
  const body = await readJson(res);
  if (res.status === 400 && Array.isArray(body?.issues)) {
    const issues = (body.issues as unknown[]).flatMap((i) => {
      const o = i as Partial<Issue> | null;
      return o && typeof o.path === "string" && typeof o.message === "string" ? [{ path: o.path, message: o.message }] : [];
    });
    return { kind: "invalid", issues };
  }
  if (res.status === 413) {
    return { kind: "error", status: 413, message: "The content is too large to save (the limit is 1 MB)." };
  }
  return { kind: "error", status: res.status, message: messageFrom(body, `Saving failed (status ${res.status}).`) };
}

export function saveContent(content: ContentData): Promise<ApiResult> {
  return write("/api/admin/content", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
  });
}

export function resetContent(): Promise<ApiResult> {
  return write("/api/admin/content/reset", { method: "POST" });
}

export async function uploadImage(file: Blob, name: string): Promise<ApiResult<{ url: string }>> {
  const form = new FormData();
  form.append("file", file, name);
  const res = await call("/api/admin/upload", { method: "POST", body: form });
  if (!res) return OFFLINE;
  if (res.status === 401) return { kind: "unauthorized" };
  const body = await readJson(res);
  if (res.ok && typeof body?.url === "string") return { kind: "ok", url: body.url };
  if (res.status === 413) {
    return {
      kind: "error",
      status: 413,
      message: "The image is too large for the server to accept. Try a smaller image (under 4 MB).",
    };
  }
  if (!body) {
    return {
      kind: "error",
      status: res.status,
      message: `The upload failed: the server sent an unexpected response (status ${res.status}). Try a smaller image or try again.`,
    };
  }
  return { kind: "error", status: res.status, message: messageFrom(body, `The upload failed (status ${res.status}).`) };
}
