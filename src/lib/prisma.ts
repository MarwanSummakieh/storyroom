import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

let prisma: PrismaClient | null = null;

export function getPrisma() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required before using the Prisma repository.");
  }

  prisma ??= new PrismaClient({
    adapter: new PrismaPg(connectionString),
  });

  return prisma;
}
