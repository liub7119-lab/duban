import OpenAI from "openai";

// 服务端唯一的 AI 出口。所有 AI 调用必须经此,以便统一接入配额与用量记录。
// 仅在 server 侧 import,严禁泄漏到 client bundle。

function isEnabled() {
  return Boolean(process.env.AI_API_KEY);
}

export function ai() {
  if (!isEnabled()) {
    throw new Error("AI 功能未配置:请在环境变量中设置 AI_API_KEY");
  }
  return new OpenAI({
    apiKey: process.env.AI_API_KEY!,
    baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1",
  });
}

// 用 base64 解码得到完整模型名,避免字符串在构建/传输中被截断
function b64(s: string): string {
  return Buffer.from(s, "base64").toString("utf8");
}

// deepseek-ai/DeepSeek-V3
const DEFAULT_MODEL = b64("ZGVlcHNlZWstYWkvRGVlcFNlZWstVjM=");

export function CHAT_MODEL(): string {
  const m = process.env.AI_CHAT_MODEL;
  // 若环境变量配的模型名长度异常短(被截断),回退到默认
  if (!m || m.length < 8) return DEFAULT_MODEL;
  return m;
}

export function EMBED_MODEL() {
  return process.env.AI_EMBED_MODEL || "BAAI/bge-m3";
}

export const AI_ENABLED = isEnabled();
