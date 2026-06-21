import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, assertOwned } from "@/server/guard";
import { AI_ENABLED } from "@/lib/ai/client";
import { QuotaExceededError } from "@/lib/quota/reserve";

// GET:拉取已有总结
export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { bookId } = await params;
  const book = await prisma.book.findUnique({ where: { id: bookId }, select: { userId: true } });
  if (!book) return NextResponse.json({ error: "未找到" }, { status: 404 });
  assertOwned(user.id, book.userId);

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "BOOK";
  const chapterIndex = searchParams.get("chapter");

  if (scope === "CHAPTER" && chapterIndex !== null) {
    const idx = Number(chapterIndex);
    const s = await prisma.summary.findFirst({
      where: { bookId, scope: "CHAPTER", chapterIndex: idx },
    });
    return NextResponse.json({ summary: s });
  }
  const s = await prisma.summary.findFirst({
    where: { bookId, scope: "BOOK", chapterIndex: null },
  });
  return NextResponse.json({ summary: s, aiEnabled: AI_ENABLED });
}

// POST:触发生成
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
  const scope = body.scope === "CHAPTER" ? "CHAPTER" : "BOOK";
  const chapterIndex = typeof body.chapterIndex === "number" ? body.chapterIndex : null;

  if (!AI_ENABLED) {
    return NextResponse.json({ error: "AI 功能未配置" }, { status: 503 });
  }

  try {
    const { generateBookSummary, generateChapterSummary } = await import(
      "@/lib/ai/summarize"
    );
    const content =
      scope === "CHAPTER" && chapterIndex !== null
        ? await generateChapterSummary(bookId, chapterIndex, user.id)
        : await generateBookSummary(bookId, user.id);
    return NextResponse.json({ ok: true, content });
  } catch (e: any) {
    if (e instanceof QuotaExceededError) {
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
    return NextResponse.json({ error: e?.message || "生成失败" }, { status: 500 });
  }
}
