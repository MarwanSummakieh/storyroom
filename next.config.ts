import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build (used by Docker and the Windows installer).
  output: "standalone",
  // Keep Prisma + the native pg driver out of the bundle; load them at runtime.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
};

export default nextConfig;
