import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, assertOwned } from "@/server/guard";
import { ai, CHAT_MODEL, AI_ENABLED } from "@/lib/ai/client";
import { buildContext, type Selection } from "@/lib/ai/context";
import { sseEvent, SSE_HEADERS } from "@/lib/ai/stream";
import { reserveQuota, recordUsage, QuotaExceededError } from "@/lib/quota/reserve";
import { estimateTokens } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookId: string; sessionId: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { bookId, sessionId } = await params;

  if (!AI_ENABLED) {
    return NextResponse.json(
      { error: "AI 功能未配置:管理员需在环境变量中设置 AI_API_KEY" },
      { status: 503 }
    );
  }

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: { book: { select: { userId: true } } },
  });
  if (!session) return NextResponse.json({ error: "未找到会话" }, { status: 404 });
  assertOwned(user.id, session.userId);
  assertOwned(user.id, session.book.userId);

  const body = await req.json().catch(() => ({}));
  const message: string = String(body.message || "").trim();
  const selection: Selection | undefined = body.selection;
  const chapterIndex =
    typeof body.chapterIndex === "number" ? body.chapterIndex : session.chapterIndex ?? 0;

  if (!message) return NextResponse.json({ error: "消息不能为空" }, { status: 400 });

  // 取历史(最近若干条,排除将要写入的本次)
  const dbHistory = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 12,
  });
  const history = dbHistory
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // 构建上下文
  const { messages, estTokens } = await buildContext({
    bookId,
    chapterIndex,
    selection,
    history,
  });

  // 配额预扣
  const totalEst = estTokens + estimateTokens(message) + 512;
  try {
    await reserveQuota(user.id, totalEst);
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
    throw e;
  }

  // 落库 user 消息
  await prisma.message.create({
    data: {
      sessionId,
      role: "user",
      content: message,
      selection: selection ? JSON.stringify(selection) : null,
    },
  });

  // 流式请求
  const stream = await ai().chat.completions.create({
    model: CHAT_MODEL(),
    messages: messages.concat([{ role: "user", content: message }]),
    stream: true,
    stream_options: { include_usage: true },
  });

  const bodyStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      let usage: { prompt_tokens?: number; completion_tokens?: number } | null = null;
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            full += delta;
            controller.enqueue(sseEvent("delta", { text: delta }));
          }
          if (chunk.usage) {
            usage = {
              prompt_tokens: chunk.usage.prompt_tokens,
              completion_tokens: chunk.usage.completion_tokens,
            };
          }
        }

        // 落库 assistant 消息
        await prisma.message.create({
          data: {
            sessionId,
            role: "assistant",
            content: full,
            tokensIn: usage?.prompt_tokens || 0,
            tokensOut: usage?.completion_tokens || 0,
          },
        });

        // 实扣
        await recordUsage({
          userId: user.id,
          bookId,
          type: "CHAT",
          estTokens: totalEst,
          realTokensIn: usage?.prompt_tokens,
          realTokensOut: usage?.completion_tokens,
        });

        controller.enqueue(sseEvent("done", { ok: true }));
      } catch (e: any) {
        controller.enqueue(sseEvent("error", { message: e?.message || "生成失败" }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(bodyStream, { headers: SSE_HEADERS });
}
