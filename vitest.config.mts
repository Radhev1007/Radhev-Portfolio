import { defineConfig } from "vitest/config";

export default defineConfig({
  // `server-only` is resolved by Next's bundler at build time (it throws when imported from a client bundle);
  // plain vitest has no such module, so tests alias it to an empty stub.
  resolve: { alias: { "@": import.meta.dirname, "server-only": `${import.meta.dirname}/lib/test-stubs/server-only.ts` } },
  test: { environment: "node", include: ["lib/**/*.test.ts", "app/api/**/*.test.ts"] },
});
