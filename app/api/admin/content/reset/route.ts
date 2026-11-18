import { isAdmin } from "@/lib/admin/auth";
import { csrfRejection } from "@/lib/admin/csrf";
import { defaultContent } from "@/lib/content";
import { neonDb, saveContent } from "@/lib/content-store";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

export async function POST(request: Request) {
  if (!(await isAdmin())) return json({ error: "Unauthorized" }, 401);
  const rejected = csrfRejection(request);
  if (rejected) return rejected;
  const result = await saveContent(defaultContent, neonDb());
  if (result.ok) return json({ ok: true });
  return json(result.issues ? { issues: result.issues } : { message: result.message }, result.status);
}
