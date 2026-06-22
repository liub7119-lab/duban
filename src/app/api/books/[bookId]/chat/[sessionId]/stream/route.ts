import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, assertOwned } from "@/server/guard";
import { ai, CHAT_MODEL, AI_ENABLED } from "@/lib/ai/client";
import { buildContext, type Selection } from "@/lib/ai/context";
import { sseEvent, SSE_HEADERS } from "@/lib/ai/stream";
import { reserveQuota, recordUsage, QuotaExceededError } from "@/lib/quota/reserve";
import { estimateTokens } from "@/lib/utils";

export const runtime = "nodejs";

// 流式终止状态:用于决定落库行为与前端提示
type StreamEnd = "done" | "partial" | "error";

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

  // 自动标题:首条提问后,标题若还是 "新对话",用首条消息前 24 字生成
  await maybeAutoTitle(sessionId, message);

  // 流式请求
  const model = CHAT_MODEL();
  const openaiStream = await ai().chat.completions.create({
    model,
    messages: messages.concat([{ role: "user", content: message }]),
    stream: true,
    stream_options: { include_usage: true },
  });

  // 累积 state(outer scope 以便在 cancel handler 中读)
  const state = {
    full: "",
    usage: null as { prompt_tokens?: number; completion_tokens?: number } | null,
    end: "done" as StreamEnd,
    aborted: false,
    errMsg: "",
  };

  const bodyStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of openaiStream) {
          // 检测客户端断开(controller 关闭时,enqueue 抛错)
          if (state.aborted) break;
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            state.full += delta;
            try {
              controller.enqueue(sseEvent("delta", { text: delta }));
            } catch {
              // 客户端断开
              state.aborted = true;
              break;
            }
          }
          if (chunk.usage) {
            state.usage = {
              prompt_tokens: chunk.usage.prompt_tokens,
              completion_tokens: chunk.usage.completion_tokens,
            };
          }
        }
      } catch (e: any) {
        // 区分客户端断开 vs AI 错误
        const isAbort =
          e?.name === "AbortError" ||
          e?.code === "ABORT_ERR" ||
          e?.message?.includes("aborted");
        if (isAbort) {
          state.end = "partial";
        } else {
          state.end = "error";
          state.errMsg = e?.message || "生成失败";
        }
        if (state.aborted) state.end = "partial";
      }

      // —— 统一的落库逻辑:无论哪种终止状态,只要有 full 就落 ——
      try {
        await persistAssistantMessage({
          sessionId,
          full: state.full,
          usage: state.usage,
          end: state.end,
          userId: user.id,
          bookId,
          estTokens: totalEst,
          userMessage: message,
        });
      } catch (e: any) {
        console.error("[stream] persist failed:", e?.message);
      }

      // 通知客户端最终状态
      try {
        if (state.end === "done") {
          controller.enqueue(sseEvent("done", { ok: true }));
        } else if (state.end === "partial") {
          controller.enqueue(sseEvent("done", { ok: true, partial: true }));
        } else {
          controller.enqueue(
            sseEvent("error", { message: state.errMsg || "生成失败" })
          );
        }
      } catch {
        // 客户端断开时再次 enqueue 也会失败,忽略
      }
      try {
        controller.close();
      } catch {}
    },
    cancel() {
      // 客户端主动取消(req.signal aborted / 关闭抽屉 / 切走)
      state.aborted = true;
      state.end = "partial";
      // 此时 start() 已经退出循环,但 finally 还没跑
      // 持久化交给 start 的尾部 catch 处理(它会看到 end=partial)
    },
  });

  return new Response(bodyStream, { headers: SSE_HEADERS });
}

// 落库 assistant 消息 + 实扣 usage
async function persistAssistantMessage(opts: {
  sessionId: string;
  full: string;
  usage: { prompt_tokens?: number; completion_tokens?: number } | null;
  end: StreamEnd;
  userId: string;
  bookId: string;
  estTokens: number;
  userMessage: string;
}) {
  const { sessionId, full, usage, end, userId, bookId, estTokens, userMessage } = opts;

  // 没有任何内容生成,跳过
  if (!full) return;

  // 部分流(客户端断线/异常):标记 partial + 估算 token
  const isPartial = end !== "done";
  const tokensIn = usage?.prompt_tokens ?? 0;
  const tokensOut = usage?.completion_tokens ?? 0;

  await prisma.message.create({
    data: {
      sessionId,
      role: "assistant",
      content: isPartial ? full + "\n\n…(回答未完成)" : full,
      tokensIn,
      tokensOut,
    },
  });

  // 实扣:有真实 usage 用真实,否则用估算
  if (usage && (tokensIn > 0 || tokensOut > 0)) {
    await recordUsage({
      userId,
      bookId,
      type: "CHAT",
      estTokens,
      realTokensIn: tokensIn,
      realTokensOut: tokensOut,
    });
  }
  // 没有 usage 但有 partial → 已经在预扣时按估算扣了,不再二次记录

  // 触发自动标题(如果首条 user 消息被存档且标题还是默认)
  await maybeAutoTitle(sessionId, userMessage);
}

// 自动标题:首条 user 消息 → 取前 24 字
async function maybeAutoTitle(sessionId: string, userMessage: string) {
  try {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { title: true, messages: { orderBy: { createdAt: "asc" }, take: 2 } },
    });
    if (!session) return;
    // 已有自定义标题,不动
    if (session.title && session.title !== "新对话") return;
    // 至少有一条 user 消息才生成
    if (!session.messages.length) return;
    const title = userMessage.slice(0, 24).replace(/\s+/g, " ").trim() || "新对话";
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { title },
    });
  } catch {
    // 标题更新失败不影响主流程
  }
}
