import { isAdmin } from "@/lib/admin/auth";
import { csrfRejection } from "@/lib/admin/csrf";
import { loadContent, neonDb, saveContent } from "@/lib/content-store";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 1024 * 1024;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

export async function GET() {
  if (!(await isAdmin())) return json({ error: "Unauthorized" }, 401);
  const db = neonDb();
  const result = await loadContent(db);
  return json({ ...result, configured: db !== null });
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) return json({ error: "Unauthorized" }, 401);
  const rejected = csrfRejection(request, { requireJson: true });
  if (rejected) return rejected;

  // NaN / missing content-length is "unknown": the real byte count is checked below.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json({ message: "Payload too large" }, 413);
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return json({ message: "Payload too large" }, 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ message: "Invalid JSON" }, 400);
  }

  const result = await saveContent(body, neonDb());
  if (result.ok) return json({ ok: true });
  return json(result.issues ? { issues: result.issues } : { message: result.message }, result.status);
}
