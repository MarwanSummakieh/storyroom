import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Windows installer build outputs and runtime scripts (plain CJS, not app code).
    "dist/**",
    "installer/.cache/**",
    "installer/stage/**",
    "installer/dist/**",
    "installer/launcher.js",
    "installer/stop.js",
  ]),
]);

export default eslintConfig;
