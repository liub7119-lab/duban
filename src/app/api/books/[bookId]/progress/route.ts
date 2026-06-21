import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, assertOwned } from "@/server/guard";

// 上报/读取进度
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { bookId } = await params;
  const p = await prisma.readingProgress.findUnique({
    where: { userId_bookId: { userId: user.id, bookId } },
  });
  return NextResponse.json({ progress: p });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { bookId } = await params;
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { userId: true, chapters: { select: { index: true, charCount: true } } },
  });
  if (!book) return NextResponse.json({ error: "未找到" }, { status: 404 });
  assertOwned(user.id, book.userId);

  const body = await req.json().catch(() => ({}));
  const chapterIndex = Number(body.chapterIndex ?? 0);
  const scrollRatio = Number(body.scrollRatio ?? 0);
  const deltaMs = Number(body.deltaMs ?? 0);

  // 计算全书百分比
  const totalChars = book.chapters.reduce((s, c) => s + c.charCount, 0);
  const before = book.chapters
    .filter((c) => c.index < chapterIndex)
    .reduce((s, c) => s + c.charCount, 0);
  const curChapter = book.chapters.find((c) => c.index === chapterIndex);
  const within = (curChapter?.charCount || 0) * scrollRatio;
  const percent = totalChars > 0 ? Math.min(1, (before + within) / totalChars) : 0;

  await prisma.readingProgress.upsert({
    where: { userId_bookId: { userId: user.id, bookId } },
    create: { userId: user.id, bookId, chapterIndex, scrollRatio, percent, readingMs: deltaMs },
    update: {
      chapterIndex,
      scrollRatio,
      percent,
      readingMs: { increment: deltaMs },
    },
  });

  return NextResponse.json({ ok: true });
}
