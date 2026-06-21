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
  const book = await prisma.book.findUnique({ where: { id: bookId }, select: { userId: true } });
  if (!book) return NextResponse.json({ error: "未找到" }, { status: 404 });
  assertOwned(user.id, book.userId);

  const sessions = await prisma.chatSession.findMany({
    where: { bookId, userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, chapterIndex: true, createdAt: true,
      _count: { select: { messages: true } },
    },
  });
  return NextResponse.json({ sessions });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { bookId } = await params;
  const book = await prisma.book.findUnique({ where: { id: bookId }, select: { userId: true } });
  if (!book) return NextResponse.json({ error: "未找到" }, { status: 404 });
  assertOwned(user.id, book.userId);

  const body = await req.json().catch(() => ({}));
  const session = await prisma.chatSession.create({
    data: {
      userId: user.id,
      bookId,
      chapterIndex: typeof body.chapterIndex === "number" ? body.chapterIndex : null,
      title: body.title || "新对话",
    },
  });
  return NextResponse.json({ session });
}
