// 存储抽象层:根据部署环境自动分发到本地文件系统 或 Vercel Blob。
// 调用方无需关心具体实现,统一用这些函数。
//
// - 本地/Docker/自托管 �� storage-local.ts(本地 fs)
// - Vercel 部署         → storage-blob.ts(Vercel Blob,需配 BLOB_READ_WRITE_TOKEN)

export type * from "./storage-local";

// 用动态条件 re-export
// Next.js / Turbopack 支持这种"运行时分发",
// 但为了让 tree-shaking 与静态分析友好,我们用显式判断的 wrapper。

import * as local from "./storage-local";
import * as blob from "./storage-blob";

const IS_VERCEL = !!process.env.VERCEL;
const impl = IS_VERCEL ? blob : local;

export const saveUpload = impl.saveUpload;
export const readUpload = impl.readUpload;
export const saveCover = impl.saveCover;
export const readBytes = impl.readBytes;
export const resolveUploadPath = impl.resolveUploadPath;
