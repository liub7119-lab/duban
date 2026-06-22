import { ai, CHAT_MODEL } from "@/lib/ai/client";
import { prisma } from "@/lib/db";
import { estimateTokens } from "@/lib/utils";
import { reserveQuota, recordUsage, QuotaExceededError } from "@/lib/quota/reserve";

const CHUNK_SIZE = 6000; // 字符

// 分块(按章切完后,大章再按字符切)
function splitIntoChunks(chapters: { title: string; content: string }[]): { title: string; content: string }[] {
  const out: { title: string; content: string }[] = [];
  for (const ch of chapters) {
    if (ch.content.length <= CHUNK_SIZE) {
      out.push(ch);
    } else {
      for (let i = 0; i < ch.content.length; i += CHUNK_SIZE) {
        out.push({
          title: ch.title,
          content: ch.content.slice(i, i + CHUNK_SIZE),
        });
      }
    }
  }
  return out;
}

async function summarizeChunk(text: string, scope: "BOOK" | "CHAPTER"): Promise<string> {
  const prompt =
    scope === "BOOK"
      ? `请为以下内容写一段整体摘要(200~400 字),保留关键情节、人物、主要观点。`
      : `请为以下章节写一段摘要(150~300 字),交代该章主要事件与意图。`;
  const r = await ai().chat.completions.create({
    model: await CHAT_MODEL(),
    messages: [
      { role: "system", content: "你是读伴,擅长撰写条理清晰的摘要,使用简体中文。" },
      { role: "user", content: `${prompt}\n\n---\n${text}` },
    ],
  });
  return r.choices[0]?.message?.content?.trim() || "";
}

export async function generateBookSummary(bookId: string, userId: string): Promise<string> {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { title: true, author: true, userId: true, chapters: { orderBy: { index: "asc" } } },
  });
  if (!book) throw new Error("BOOK_NOT_FOUND");
  if (book.userId !== userId) throw new Error("FORBIDDEN");

  const chunks = splitIntoChunks(book.chapters);
  if (chunks.length === 0) return "（无内容）";

  // 配额估算
  const totalChars = chunks.reduce((s, c) => s + c.content.length, 0);
  const estTokens = estimateTokens(chunks.map((c) => c.content).join("\n")) + 2048;
  try {
    await reserveQuota(userId, estTokens);
  } catch (e) {
    if (e instanceof QuotaExceededError) throw e;
    throw e;
  }

  // 逐块摘要
  const partials: string[] = [];
  let totalIn = 0, totalOut = 0;
  for (const c of chunks) {
    const out = await summarizeChunk(c.content, "BOOK");
    if (out) partials.push(`《${c.title}》:${out}`);
  }

  // 合并成全书摘要
  let final: string;
  if (partials.length === 1) {
    final = partials[0];
  } else {
    const merged = await ai().chat.completions.create({
      model: await CHAT_MODEL(),
      messages: [
        { role: "system", content: "你是读伴,综合若干段章节摘要,生成全书摘要(300~600 字),要条理清晰、抓住主线。使用简体中文。" },
        { role: "user", content: partials.join("\n\n") },
      ],
    });
    final = merged.choices[0]?.message?.content?.trim() || partials.join("\n\n");
  }

  await recordUsage({
    userId,
    bookId,
    type: "SUMMARY",
    estTokens,
  });

  // 落库(避开 chapterIndex=null 的 upsert 唯一键问题)
  const existing = await prisma.summary.findFirst({
    where: { bookId, scope: "BOOK", chapterIndex: null },
  });
  if (existing) {
    await prisma.summary.update({ where: { id: existing.id }, data: { content: final } });
  } else {
    await prisma.summary.create({
      data: { bookId, scope: "BOOK", chapterIndex: null, content: final },
    });
  }

  return final;
}

export async function generateChapterSummary(
  bookId: string,
  chapterIndex: number,
  userId: string
): Promise<string> {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { userId: true, chapters: { where: { index: chapterIndex }, take: 1 } },
  });
  if (!book) throw new Error("BOOK_NOT_FOUND");
  if (book.userId !== userId) throw new Error("FORBIDDEN");
  const ch = book.chapters[0];
  if (!ch) throw new Error("CHAPTER_NOT_FOUND");

  const text = ch.content.slice(0, CHUNK_SIZE * 2);
  const estTokens = estimateTokens(text) + 1024;
  await reserveQuota(userId, estTokens);
  const out = await summarizeChunk(text, "CHAPTER");
  await recordUsage({ userId, bookId, type: "SUMMARY", estTokens });

  await prisma.summary.upsert({
    where: {
      bookId_scope_chapterIndex: {
        bookId,
        scope: "CHAPTER",
        chapterIndex,
      },
    },
    create: { bookId, scope: "CHAPTER", chapterIndex, content: out },
    update: { content: out },
  });
  return out;
}
