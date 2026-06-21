import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/guard";
import { todayKey } from "@/lib/utils";

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const [bookCount, noteCount, sessionCount, usageAgg, progressSum] = await Promise.all([
    prisma.book.count({ where: { userId: user.id } }),
    prisma.note.count({ where: { userId: user.id } }),
    prisma.chatSession.count({ where: { userId: user.id } }),
    prisma.usageRecord.aggregate({
      where: { userId: user.id },
      _sum: { tokensIn: true, tokensOut: true },
    }),
    prisma.readingProgress.aggregate({
      where: { userId: user.id },
      _sum: { readingMs: true },
    }),
  ]);

  // 近 7 天每日阅读时长
  const days: { day: string; minutes: number }[] = [];
  const recent = await prisma.readingDay.findMany({
    where: {
      userId: user.id,
      day: { in: Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return todayKey(d);
      }) },
    },
  });
  const byDay = new Map(recent.map((r) => [r.day, r.ms]));
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = todayKey(d);
    const ms = byDay.get(k) || 0;
    days.push({ day: k.slice(5), minutes: Math.round(ms / 60000) });
  }

  const progresses = await prisma.readingProgress.findMany({
    where: { userId: user.id },
    include: { book: { select: { id: true, title: true, author: true, totalChars: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    overview: {
      bookCount,
      noteCount,
      sessionCount,
      totalTokensIn: usageAgg._sum.tokensIn || 0,
      totalTokensOut: usageAgg._sum.tokensOut || 0,
      totalReadingMs: progressSum._sum.readingMs || 0,
    },
    sevenDays: days,
    progresses: progresses.map((p) => ({
      bookId: p.bookId,
      title: p.book.title,
      author: p.book.author,
      percent: Math.round(p.percent * 100),
      chapterIndex: p.chapterIndex,
      readingMinutes: Math.round(p.readingMs / 60000),
      lastAt: p.updatedAt,
    })),
  });
}
