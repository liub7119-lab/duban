import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, assertOwned } from "@/server/guard";

// 取单章正文
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bookId: string; idx: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { bookId, idx } = await params;
  const index = Number(idx);
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { userId: true, status: true, errorMsg: true },
  });
  if (!book) return NextResponse.json({ error: "未找到" }, { status: 404 });
  assertOwned(user.id, book.userId);

  if (book.status === "PROCESSING") {
    return NextResponse.json({ status: "PROCESSING" });
  }
  if (book.status === "FAILED") {
    return NextResponse.json({ status: "FAILED", error: book.errorMsg });
  }

  const chapter = await prisma.chapter.findUnique({
    where: { bookId_index: { bookId, index } },
  });
  if (!chapter) return NextResponse.json({ error: "章节不存在" }, { status: 404 });

  const notes = await prisma.note.findMany({
    where: { bookId, chapterIndex: index, userId: user.id },
    orderBy: { startChar: "asc" },
  });

  return NextResponse.json({ status: "READY", chapter, notes });
}
