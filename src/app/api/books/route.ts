import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/guard";
import { saveUpload, saveCover } from "@/lib/storage";
import { parseBook } from "@/lib/parser";
import { getExt } from "@/lib/parser/types";

const MAX_MB = Number(process.env.MAX_UPLOAD_MB || "30");

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const books = await prisma.book.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      author: true,
      format: true,
      status: true,
      coverPath: true,
      totalChars: true,
      createdAt: true,
      _count: { select: { chapters: true } },
    },
  });
  return NextResponse.json({ books });
}

export async function POST(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "未提供文件" }, { status: 400 });
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `文件超过 ${MAX_MB}MB 上限` }, { status: 413 });
  }

  const ext = getExt(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const sourcePath = await saveUpload(user.id, ext, new Uint8Array(buffer));

  // 先建一条 PROCESSING 记录
  const book = await prisma.book.create({
    data: {
      userId: user.id,
      title: file.name.replace(/\.[^.]+$/, ""),
      sourcePath,
      format: ext.toUpperCase(),
      status: "PROCESSING",
    },
  });

  // 同步解析(MVP;大文件后续改后台 worker)
  try {
    const parsed = await parseBook(file.name, file.type, buffer);

    let coverPath: string | undefined;
    if (parsed.coverBuffer) {
      coverPath = await saveCover(user.id, book.id, parsed.coverBuffer);
    }

    const totalChars = parsed.chapters.reduce((s, c) => s + c.content.length, 0);

    await prisma.book.update({
      where: { id: book.id },
      data: {
        title: parsed.title.slice(0, 200),
        author: parsed.author,
        language: parsed.language,
        coverPath,
        totalChars,
        status: "READY",
        chapters: {
          createMany: {
            data: parsed.chapters.map((c) => ({
              index: c.index,
              title: c.title,
              content: c.content,
              charCount: c.content.length,
            })),
          },
        },
        progress: {
          create: { userId: user.id },
        },
      },
    });

    return NextResponse.json({ id: book.id, status: "READY" });
  } catch (err: any) {
    await prisma.book.update({
      where: { id: book.id },
      data: { status: "FAILED", errorMsg: String(err?.message || err).slice(0, 500) },
    });
    return NextResponse.json(
      { error: `解析失败:${err?.message || "未知错误"}` },
      { status: 422 }
    );
  }
}
