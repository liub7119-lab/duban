import { put, get } from "@vercel/blob";

// Vercel Blob 云存储实现(Vercel 部署用,private store)
// 接口与 storage-local.ts 完全一致;存返回 URL,读接受 URL。
// private blob 不能直接 fetch,需用 get() 带 token 读取流。

function isUrl(p: string): boolean {
  return /^https?:\/\//.test(p);
}

async function readBlobBuffer(locator: string): Promise<Buffer> {
  const result = await get(locator, { access: "private" });
  if (!result || !result.stream) throw new Error(`Blob 不存在:${locator}`);
  // result.stream 是 ReadableStream,转 Buffer
  const reader = result.stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function saveUpload(
  userId: string,
  ext: string,
  data: Uint8Array
): Promise<string> {
  const filename = `uploads/${userId}/${crypto.randomUUID()}.${ext}`;
  const blob = await put(filename, Buffer.from(data), {
    access: "private",
    addRandomSuffix: false,
  });
  return blob.url;
}

export async function readUpload(locator: string): Promise<Buffer> {
  if (isUrl(locator)) return readBlobBuffer(locator);
  throw new Error("Vercel Blob 模式下不支持相对路径读取");
}

export async function saveCover(
  userId: string,
  bookId: string,
  buffer: Buffer
): Promise<string> {
  const filename = `covers/${userId}/${bookId}.jpg`;
  const blob = await put(filename, buffer, {
    access: "private",
    addRandomSuffix: false,
  });
  return blob.url;
}

export async function readBytes(locator: string): Promise<Buffer> {
  if (isUrl(locator)) return readBlobBuffer(locator);
  throw new Error("Vercel Blob 模式下不支持相对路径读取");
}

export function resolveUploadPath(_locator: string): string {
  return _locator;
}
