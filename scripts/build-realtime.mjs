// Bundles the Hocuspocus realtime server into a single self-contained CJS file
// (dist/realtime.cjs) for the native Windows build. No node_modules needed at
// runtime.
import { build } from "esbuild";

await build({
  entryPoints: ["server/realtime.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "dist/realtime.cjs",
  // The native build always uses the JSON store; keep Prisma + pg out.
  alias: { "@/lib/store-prisma": "./installer/stubs/store-prisma-stub.ts" },
  // Some bundled ESM deps call createRequire(import.meta.url), which is
  // undefined once compiled to CJS — substitute the CJS equivalent.
  banner: {
    js: "const __importMetaUrl = require('node:url').pathToFileURL(__filename).href;",
  },
  define: { "import.meta.url": "__importMetaUrl" },
});
