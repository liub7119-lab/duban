import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, assertOwned } from "@/server/guard";
import { readBytes } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { bookId } = await params;
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { userId: true, coverPath: true },
  });
  if (!book) return NextResponse.json({ error: "未找到" }, { status: 404 });
  assertOwned(user.id, book.userId);
  if (!book.coverPath) return new Response(null, { status: 404 });

  try {
    const buf = await readBytes(book.coverPath);
    return new Response(buf as any, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
