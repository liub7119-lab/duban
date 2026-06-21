import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, assertOwned } from "@/server/guard";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { bookId } = await params;
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      chapters: { orderBy: { index: "asc" }, select: { id: true, index: true, title: true, charCount: true } },
      progress: { where: { userId: user.id } },
    },
  });
  if (!book) return NextResponse.json({ error: "未找到" }, { status: 404 });
  assertOwned(user.id, book.userId);
  return NextResponse.json({ book });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { bookId } = await params;
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) return NextResponse.json({ error: "未找到" }, { status: 404 });
  assertOwned(user.id, book.userId);
  await prisma.book.delete({ where: { id: bookId } });
  return NextResponse.json({ ok: true });
}
