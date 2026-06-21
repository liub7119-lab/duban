import EPub from "epub2";
import { parseHTML } from "linkedom";
import type { BookParser, ParsedBook, ParsedChapter } from "./types";

export class EpubParser implements BookParser {
  canHandle(filename: string) {
    return /\.epub$/i.test(filename);
  }

  async parse(buffer: Buffer): Promise<ParsedBook> {
    // createAsync 类型声明为 string,但底层支持 Buffer
    const epub = await (EPub.createAsync as unknown as (
      b: Buffer
    ) => Promise<EPubAsync>)(buffer);

    const title = epub.metadata?.title || "未命名";
    const author = epub.metadata?.creator || undefined;
    const language = epub.metadata?.language || undefined;

    // toc 有序标题,用于命名 spine item
    const tocByHref: Record<string, string> = {};
    walkToc((epub as any).toc || [], tocByHref);

    const flow = ((epub as any).flow || []) as Array<{
      id: string;
      href: string;
      title?: string;
    }>;

    const chapters: ParsedChapter[] = [];
    let coverBuffer: Buffer | undefined;

    for (const item of flow) {
      let html: string;
      try {
        html = await epub.getChapterRawAsync(item.id);
      } catch {
        continue;
      }
      const { text, isImageOnly } = extractText(html);
      if (isImageOnly || text.trim().length < 20) {
        if (!coverBuffer) {
          const img = await extractFirstImage(epub as any, html);
          if (img) coverBuffer = img;
        }
        continue;
      }
      const ti =
        tocByHref[normalizeHref(item.href)] ||
        item.title ||
        extractFirstHeading(html) ||
        `第 ${chapters.length + 1} 节`;

      chapters.push({ index: chapters.length, title: ti.slice(0, 80), content: text });
    }

    if (!chapters.length) {
      chapters.push({ index: 0, title, content: "（未能解析出章节结构）" });
    }

    return { title, author, language, coverBuffer, chapters };
  }
}

type EPubAsync = {
  metadata?: { title?: string; creator?: string; language?: string };
  getChapterRawAsync(id: string): Promise<string>;
};

function walkToc(toc: any[], out: Record<string, string>) {
  for (const node of toc) {
    if (node.title && node.href) out[normalizeHref(node.href)] = node.title;
    if (node.children?.length) walkToc(node.children, out);
  }
}

function normalizeHref(href: string): string {
  return decodeURIComponent(href.split("#")[0].split("/").pop() || href);
}

function extractText(html: string): { text: string; isImageOnly: boolean } {
  const { document } = parseHTML(html);
  document.querySelectorAll("script,style,head").forEach((n) => n.remove());
  const imgCount = document.querySelectorAll("img").length;
  const body = document.body || document.documentElement;
  const raw = body ? body.textContent || "" : "";
  const text = raw.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { text, isImageOnly: imgCount > 0 && text.length < 20 };
}

function extractFirstHeading(html: string): string | null {
  const { document } = parseHTML(html);
  for (const tag of ["h1", "h2", "h3"]) {
    const el = document.querySelector(tag);
    const t = el?.textContent?.trim();
    if (t) return t.slice(0, 80);
  }
  return null;
}

function extractFirstImage(epub: any, html: string): Promise<Buffer | undefined> {
  const { document } = parseHTML(html);
  const img = document.querySelector("img");
  if (!img) return Promise.resolve(undefined);
  const src = img.getAttribute("src") || img.getAttribute("xlink:href") || "";
  const filename = decodeURIComponent(src.split("/").pop() || src);
  // manifest 在 epub2 中是对象 {id -> item}
  const manifest = epub.manifest || {};
  const items = Array.isArray(manifest) ? manifest : Object.values(manifest);
  const manifestItem = items.find(
    (m: any) => m.href?.split("/").pop() === filename
  );
  if (!manifestItem) return Promise.resolve(undefined);
  return epub
    .getImageAsync(manifestItem.id)
    .then(([buf]: [Buffer, string]) => buf)
    .catch(() => undefined);
}
