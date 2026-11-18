// Static export build (npm run build:static).
//
// `output: "export"` cannot contain route handlers or the admin pages (they need a server), so this
// builds a COPY of the project without app/(admin) and app/api and copies the resulting out/ back.
// Nothing in the real tree is moved or deleted, so a failed build can never leave it half-changed.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Inside the project so node_modules resolves from the parent folder (Turbopack refuses symlinks and
// files outside its root; next.config.ts points turbopack.root at the project via STATIC_ROOT).
const work = join(root, ".static-build");
const skip = new Set(["node_modules", ".next", ".git", "out", ".superpowers", "multiplayer-server", ".static-build"]);
let status = 1;

try {
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  for (const name of readdirSync(root)) {
    if (!skip.has(name)) cpSync(join(root, name), join(work, name), { recursive: true });
  }
  rmSync(join(work, "app", "(admin)"), { recursive: true, force: true });
  rmSync(join(work, "app", "api"), { recursive: true, force: true });

  const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
  const res = spawnSync(process.execPath, [nextBin, "build"], {
    cwd: work,
    stdio: "inherit",
    env: { ...process.env, STATIC_EXPORT: "1", STATIC_ROOT: root },
  });
  status = res.status ?? 1;

  if (status === 0) {
    if (!existsSync(join(work, "out"))) throw new Error("build succeeded but produced no out/");
    rmSync(join(root, "out"), { recursive: true, force: true });
    cpSync(join(work, "out"), join(root, "out"), { recursive: true });
    console.log("Static site written to out/ (admin and API excluded).");
  }
} catch (err) {
  console.error(err);
  status = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
process.exit(status);
