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
  const notes = await prisma.note.findMany({
    where: { bookId, userId: user.id },
    orderBy: [{ chapterIndex: "asc" }, { startChar: "asc" }],
  });
  return NextResponse.json({ notes });
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
  const { chapterIndex, startChar, endChar, quote, note, color } = body as {
    chapterIndex: number;
    startChar: number;
    endChar: number;
    quote: string;
    note?: string;
    color?: string;
  };
  if (typeof chapterIndex !== "number" || !quote) {
    return NextResponse.json({ error: "参数缺失" }, { status: 400 });
  }
  const created = await prisma.note.create({
    data: { userId: user.id, bookId, chapterIndex, startChar, endChar, quote, note, color },
  });
  return NextResponse.json({ note: created });
}

export async function DELETE(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const noteId = searchParams.get("id");
  if (!noteId) return NextResponse.json({ error: "缺 id" }, { status: 400 });
  const n = await prisma.note.findUnique({ where: { id: noteId } });
  if (!n || n.userId !== user.id)
    return NextResponse.json({ error: "无权操作" }, { status: 403 });
  await prisma.note.delete({ where: { id: noteId } });
  return NextResponse.json({ ok: true });
}
