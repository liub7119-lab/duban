import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, assertOwned } from "@/server/guard";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bookId: string; sessionId: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { bookId, sessionId } = await params;
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: { book: { select: { userId: true } } },
  });
  if (!session) return NextResponse.json({ error: "未找到" }, { status: 404 });
  assertOwned(user.id, session.userId);
  assertOwned(user.id, session.book.userId);

  const messages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    session: { id: session.id, chapterIndex: session.chapterIndex, title: session.title },
    messages,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ bookId: string; sessionId: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { sessionId } = await params;
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session) return NextResponse.json({ error: "未找到" }, { status: 404 });
  assertOwned(user.id, session.userId);
  await prisma.chatSession.delete({ where: { id: sessionId } });
  return NextResponse.json({ ok: true });
}
