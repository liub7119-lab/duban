import { prisma } from "@/lib/db";
import { estimateTokens } from "@/lib/utils";

export type Selection = {
  chapterIndex: number;
  start: number;
  end: number;
  quote: string;
};

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

// L1 上下文:系统提示 + 书 + 当前章节(截断)+ 选中段落 + 最近 K 轮历史
const MAX_CHAPTER_TOKENS = 4000;
const HISTORY_TURNS = 6;

const SYSTEM_PROMPT = (title: string, author?: string | null) =>
  `你是「读伴」,一位温和博学的读书伴侣,正在陪读者一起读《${title}》${
    author ? `(作者:${author})` : ""
  }。
请根据读者提供的上下文回答问题,或就选中的段落进行讲解、赏析、延展。
要求:
- 用简体中文回答,语气温和,贴合书籍语境。
- 若问题超出已提供的内容范围,可基于常识作答,但要说明这不是原文内容。
- 回答简洁有度,可适当引用原文关键句。
- 不要编造书中不存在的人物或情节。`;

export async function buildContext(opts: {
  bookId: string;
  chapterIndex: number;
  selection?: Selection;
  history?: ChatMessage[];
}): Promise<{ messages: ChatMessage[]; estTokens: number }> {
  const book = await prisma.book.findUnique({
    where: { id: opts.bookId },
    select: { title: true, author: true, chapters: { select: { index: true, content: true } } },
  });
  if (!book) throw new Error("BOOK_NOT_FOUND");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT(book.title, book.author) },
  ];

  // 当前章节(截断到 MAX_CHAPTER_TOKENS 估算字符)
  const chapter = book.chapters.find((c) => c.index === opts.chapterIndex);
  if (chapter) {
    const maxChars = MAX_CHAPTER_TOKENS; // 估算近似
    const sliced =
      chapter.content.length > maxChars
        ? chapter.content.slice(0, maxChars) + "\n…(本章后续内容略)"
        : chapter.content;
    messages.push({
      role: "system",
      content: `【当前阅读章节】\n${sliced}`,
    });
  }

  // 选中段落
  if (opts.selection?.quote) {
    messages.push({
      role: "system",
      content: `【读者选中的段落】\n"${opts.selection.quote}"`,
    });
  }

  // 历史(最近 K 轮 = 2K 条)
  const history = (opts.history || []).slice(-HISTORY_TURNS * 2);
  messages.push(...history);

  const estTokens = messages.reduce((s, m) => s + estimateTokens(m.content), 0);
  return { messages, estTokens };
}
