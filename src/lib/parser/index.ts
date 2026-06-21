import type { BookParser, ParsedBook } from "./types";
import { getExt } from "./types";
import { TxtParser } from "./txt";
import { EpubParser } from "./epub";
import { PdfParser } from "./pdf";

const PARSERS: BookParser[] = [new EpubParser(), new PdfParser(), new TxtParser()];

export async function parseBook(
  filename: string,
  mime: string,
  buffer: Buffer
): Promise<ParsedBook> {
  const parser = PARSERS.find((p) => p.canHandle(filename, mime));
  if (!parser) {
    throw new Error(`暂不支持的格式:.${getExt(filename)}`);
  }
  return parser.parse(buffer);
}

export type { ParsedBook, ParsedChapter } from "./types";
