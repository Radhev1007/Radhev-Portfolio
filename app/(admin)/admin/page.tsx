import { connection } from "next/server";
import { AdminApp } from "@/components/Admin/AdminApp";
import { NotConfigured } from "@/components/Admin/NotConfigured";
import { isAdmin, isSecretValid } from "@/lib/admin/auth";
import { getContentWithSource, neonDb } from "@/lib/content-store";

/**
 * /admin. Rendered per request (it depends on the session cookie and on runtime env vars):
 * - admin env vars missing -> a "not set up" notice instead of a login form that could only fail;
 * - signed out -> the login form;
 * - signed in -> the editor, loaded with the current content (uncached, with its source).
 * Only booleans about configuration reach the client, never the values.
 */
export default async function AdminPage() {
  await connection();
  const authConfigured = Boolean(process.env.ADMIN_PASSWORD) && isSecretValid(process.env.ADMIN_SESSION_SECRET);
  if (!authConfigured) return <NotConfigured />;

  const dbConfigured = neonDb() !== null;
  const imagesConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const initial = (await isAdmin()) ? await getContentWithSource() : null;
  return <AdminApp initial={initial} dbConfigured={dbConfigured} imagesConfigured={imagesConfigured} />;
}
