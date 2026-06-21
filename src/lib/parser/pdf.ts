import type { BookParser, ParsedBook, ParsedChapter } from "./types";

export class PdfParser implements BookParser {
  canHandle(filename: string) {
    return /\.pdf$/i.test(filename);
  }

  async parse(buffer: Buffer): Promise<ParsedBook> {
    // pdf-parse v2 为 ESM,导出本身就是函数
    const mod = await import("pdf-parse");
    const pdfParse = (mod as any).default ?? mod;
    const data = await pdfParse(buffer, { max: 0 });
    const text = data.text || "";
    const title = data.info?.Title?.trim() || guessTitle(text);

    // PDF 无可靠章节,按页或大块切分。pdf-parse 不直接给页边界,
    // 这里按换页符 \f 切(它通常保留分页符),否则按字符量切。
    let chapters: ParsedChapter[];
    if (text.includes("\f")) {
      const pages = text.split("\f");
      chapters = pages
        .map((p: string, i: number) => ({ index: i, title: `第 ${i + 1} 页`, content: p.trim() }))
        .filter((p: { content: string }) => p.content.length > 0);
    } else {
      chapters = chunkText(text);
    }

    if (!chapters.length) {
      chapters = [{ index: 0, title: "正文", content: text.trim() }];
    }

    return {
      title,
      author: data.info?.Author?.trim() || undefined,
      chapters,
    };
  }
}

function guessTitle(text: string): string {
  const firstLine = text.split("\n").find((l) => l.trim());
  return (firstLine?.trim() || "未命名").slice(0, 40);
}

function chunkText(text: string): ParsedChapter[] {
  const clean = text.replace(/\s{3,}/g, "\n\n").trim();
  const SIZE = 3000;
  const chunks: ParsedChapter[] = [];
  for (let i = 0; i < clean.length; i += SIZE) {
    chunks.push({
      index: chunks.length,
      title: `第 ${chunks.length + 1} 段`,
      content: clean.slice(i, i + SIZE),
    });
  }
  return chunks;
}
