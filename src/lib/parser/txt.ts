import type { BookParser, ParsedBook, ParsedChapter } from "./types";

// 章节标题正则:中文章回 + 英文 Chapter
const CHAPTER_RE =
  /^[　\s]*第[一二三四五六七八九十百千零〇两\d]+[章节回卷集部篇话幕折][^。.\n]{0,30}$/;
const ENG_CHAPTER_RE = /^\s*(chapter|CHAPTER|Chapter)\s+[\dIVXLCDM]+\b.*$/;

const MAX_CHUNK = 3000; // 无章节标记时,按字符切块

export class TxtParser implements BookParser {
  canHandle(filename: string) {
    return /\.txt$/i.test(filename);
  }

  async parse(buffer: Buffer): Promise<ParsedBook> {
    // 猜测编码,默认 utf-8;含 BOM 则去除
    let text = buffer.toString("utf-8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    // 简单乱码兜底:若大量替换字符,尝试 gbk
    if (text.includes("�") && /[\x80-\xff]/.test(buffer.toString("latin1"))) {
      try {
        // 动态导入 iconv(若安装);否则放弃
        const iconv = (await import("iconv-lite")).default;
        text = iconv.decode(buffer, "gbk");
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      } catch {
        // 无 iconv-lite,保持 utf-8
      }
    }

    const title = guessTitle(text);
    const chapters = splitChapters(text);
    return { title, chapters };
  }
}

function guessTitle(text: string): string {
  const firstLine = text.split("\n").find((l) => l.trim()) || "未命名";
  const t = firstLine.trim().slice(0, 40);
  return t || "未命名";
}

function splitChapters(text: string): ParsedChapter[] {
  const lines = text.split(/\r?\n/);
  const chapters: { title: string; body: string[] }[] = [];
  let current: { title: string; body: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && (CHAPTER_RE.test(trimmed) || ENG_CHAPTER_RE.test(trimmed))) {
      current = { title: trimmed.slice(0, 80), body: [] };
      chapters.push(current);
    } else if (current) {
      current.body.push(line);
    } else {
      // 章节标记前的前言
      current = { title: "引言", body: [line] };
      chapters.push(current);
    }
  }

  // 无有效章节切分则整篇切块
  if (chapters.length <= 1) {
    return chunkText(text);
  }

  return chapters
    .filter((c) => c.body.join("").trim().length > 0)
    .map((c, i) => ({
      index: i,
      title: c.title,
      content: c.body.join("\n").trim(),
    }));
}

function chunkText(text: string): ParsedChapter[] {
  const clean = text.replace(/\r?\n{3,}/g, "\n\n").trim();
  const chunks: ParsedChapter[] = [];
  for (let i = 0; i < clean.length; i += MAX_CHUNK) {
    chunks.push({
      index: chunks.length,
      title: `第 ${chunks.length + 1} 段`,
      content: clean.slice(i, i + MAX_CHUNK),
    });
  }
  return chunks.length ? chunks : [{ index: 0, title: "正文", content: clean }];
}
