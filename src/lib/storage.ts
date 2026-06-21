import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// 存储抽象:本地文件系统实现。生产可换 S3/R2(实现同接口即可)。
// 用字面量根,避免 Turbopack 动态路径分析告警;环境变量优先。
const ROOT =
  process.env.STORAGE_DIR || path.join(process.cwd(), "data");

export async function saveUpload(
  userId: string,
  ext: string,
  data: Uint8Array
): Promise<string> {
  const dir = path.join(ROOT, "uploads", userId);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  const full = path.join(dir, filename);
  await fs.writeFile(full, data);
  // 返回相对标识(供后续读取)
  return path.join("uploads", userId, filename);
}

export async function readUpload(relPath: string): Promise<Buffer> {
  return fs.readFile(path.join(ROOT, relPath));
}

export async function saveCover(
  userId: string,
  bookId: string,
  buffer: Buffer
): Promise<string> {
  const dir = path.join(ROOT, "covers", userId);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${bookId}.jpg`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return path.join("covers", userId, filename);
}

export async function readBytes(relPath: string): Promise<Buffer> {
  return fs.readFile(path.join(ROOT, relPath));
}

export function resolveUploadPath(relPath: string): string {
  return path.join(ROOT, relPath);
}
