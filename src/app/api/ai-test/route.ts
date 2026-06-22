import { NextResponse } from "next/server";
import { ai, AI_ENABLED, CHAT_MODEL } from "@/lib/ai/client";

// 临时调试端点:从 Vercel 服务器测试 AI 连通性
export async function GET() {
  const info: any = {
    aiEnabled: AI_ENABLED,
    hasApiKey: !!process.env.AI_API_KEY,
    apiKeyPrefix: process.env.AI_API_KEY?.slice(0, 6) + "...",
    baseUrl: process.env.AI_BASE_URL,
    chatModelEnv: process.env.AI_CHAT_MODEL,
    chatModelResolved: CHAT_MODEL(),
  };

  if (!AI_ENABLED) {
    info.error = "AI_API_KEY 未配置";
    return NextResponse.json(info, { status: 200 });
  }

  try {
    const model = CHAT_MODEL();
    const r = await ai().chat.completions.create({
      model,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 5,
    });
    info.aiOk = true;
    info.response = r.choices[0]?.message?.content;
  } catch (e: any) {
    info.aiOk = false;
    info.aiError = e?.message;
    info.aiStatus = e?.status;
    if (e?.cause?.code) info.causeCode = e.cause.code;
    if (e?.cause?.message) info.causeMsg = e.cause.message;
  }

  return NextResponse.json(info, { status: 200 });
}
