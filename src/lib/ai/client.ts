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

export const CHAT_MODEL = () => process.env.AI_CHAT_MODEL || "gpt-4o-mini";
export const EMBED_MODEL = () => process.env.AI_EMBED_MODEL || "text-embedding-3-small";
export const AI_ENABLED = isEnabled();
