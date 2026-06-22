import { NextResponse } from "next/server";

// 临时调试端点:输出环境与数据库连通情况
export async function GET() {
  const info: any = {
    time: new Date().toISOString(),
    vercel: !!process.env.VERCEL,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    databaseUrlPrefix: process.env.DATABASE_URL?.slice(0, 30) + "...",
    hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    hasAiKey: !!process.env.AI_API_KEY,
    nodeEnv: process.env.NODE_ENV,
  };

  // 测试 Prisma 能否加载
  try {
    const { prisma } = await import("@/lib/db");
    info.prismaLoaded = true;
    // 测试能否查询
    const count = await (prisma as any).user.count();
    info.dbConnected = true;
    info.userCount = count;
  } catch (e: any) {
    info.prismaError = e?.message;
    info.prismaStack = e?.stack?.split("\n").slice(0, 5).join(" | ");
  }

  return NextResponse.json(info, { status: 500 });
}
