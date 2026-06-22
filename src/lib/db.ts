// PrismaClient 单例。
// 本地/Docker(SQLite)用 @prisma/client;Vercel 部署(Postgres/Neon)用 pg-client。
// 静态导入 @prisma/client 以保留完整类型推断(本地开发体验)。
// Vercel 环境下用 require 切换到 postgres client,类型与 sqlite 完全一致(schema 同源)。

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function instantiate(): PrismaClient {
  if (process.env.VERCEL) {
    // Vercel:加载 postgres schema 生成的 client
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("../generated/pg-client");
    return new mod.PrismaClient({ log: ["error", "warn"] }) as PrismaClient;
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? instantiate();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
