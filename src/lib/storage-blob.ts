import { put } from "@vercel/blob";

// Vercel Blob 云存储实现(Vercel 部署用)
// 接口与 storage-local.ts 完全一致;存返回 URL,读接受 URL。
//
// 需要 Vercel 项目里:
//   1. Storage → Create Database → Blob
//   2. 自动注入环境变量 BLOB_READ_WRITE_TOKEN

function isUrl(p: string): boolean {
  return /^https?:\/\//.test(p);
}

export async function saveUpload(
  userId: string,
  ext: string,
  data: Uint8Array
): Promise<string> {
  const filename = `uploads/${userId}/${crypto.randomUUID()}.${ext}`;
  const blob = await put(filename, Buffer.from(data), {
    access: "public",
    addRandomSuffix: false,
  });
  return blob.url;
}

export async function readUpload(locator: string): Promise<Buffer> {
  // locator 可能是 URL(blob)或相对路径(迁移残留,无 Blob 版本时返回空)
  if (isUrl(locator)) {
    const r = await fetch(locator);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error("Vercel Blob 模式下不支持相对路径读取");
}

export async function saveCover(
  userId: string,
  bookId: string,
  buffer: Buffer
): Promise<string> {
  const filename = `covers/${userId}/${bookId}.jpg`;
  const blob = await put(filename, buffer, {
    access: "public",
    addRandomSuffix: false,
  });
  return blob.url;
}

export async function readBytes(locator: string): Promise<Buffer> {
  if (isUrl(locator)) {
    const r = await fetch(locator);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error("Vercel Blob 模式下不支持相对路径读取");
}

export function resolveUploadPath(_locator: string): string {
  // Blob 模式下没有本地路径;此函数仅供日志/调试,返回原值
  return _locator;
}
