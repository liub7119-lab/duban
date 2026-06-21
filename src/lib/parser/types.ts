// 统一解析结果
export type ParsedChapter = {
  index: number;
  title: string;
  content: string;
};

export type ParsedBook = {
  title: string;
  author?: string;
  language?: string;
  coverBuffer?: Buffer; // 封面图(epub)
  chapters: ParsedChapter[];
};

export interface BookParser {
  // 返回是否能处理此文件
  canHandle(filename: string, mime: string): boolean;
  parse(buffer: Buffer): Promise<ParsedBook>;
}

export function getExt(filename: string): string {
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}
