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

// 默认主模型
const PRIMARY = process.env.AI_CHAT_MODEL || "/";
// 备用模型顺序(同 provider);启动时探测,挑第一个能用的
const FALLBACKS = [
  PRIMARY,
  "/",
  "/",
  "/",
  "/",
];

let resolvedModel: string | null = null;
let probing = false;
let lastProbe = 0;

// 启动 + 每次 AI 调用前都尝试解析:取第一个能用的模型
export async function CHAT_MODEL(): Promise<string> {
  // 缓存 5 分钟
  if (resolvedModel && Date.now() - lastProbe < 5 * 60_000) return resolvedModel;
  if (probing) return PRIMARY; // 避免并发探测
  probing = true;
  try {
    for (const m of FALLBACKS) {
      const ok = await probe(m);
      if (ok) {
        if (m !== resolvedModel) {
          console.log(`[ai] 使用模型: ${m}${m !== PRIMARY ? " (fallback)" : ""}`);
        }
        resolvedModel = m;
        lastProbe = Date.now();
        return m;
      }
    }
    // 全部失败
    console.warn(`[ai] 警告:所有候选模型都不可用,默认回退到 ${PRIMARY}`);
    return PRIMARY;
  } finally {
    probing = false;
  }
}

// 极简探测:发一次最小 chat 请求
async function probe(model: string): Promise<boolean> {
  if (!isEnabled()) return false;
  try {
    const r = await ai().chat.completions.create({
      model,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
      stream: false,
    } as any);
    return !!r?.choices?.[0];
  } catch {
    return false;
  }
}

export function EMBED_MODEL() {
  return process.env.AI_EMBED_MODEL || "BAAI/bge-m3";
}

export const AI_ENABLED = isEnabled();

// 启动时异步探测一次(不阻塞)
if (AI_ENABLED) {
  CHAT_MODEL().catch(() => {});
}
