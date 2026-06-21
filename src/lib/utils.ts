// 通用工具

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// 粗略估算 token(中文按字符,英文按 4 字符/token)
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // 简化:平均 1 个中文字 ≈ 1 token,1 个英文词 ≈ 1.3 字符
  const cjk = (text.match(/[一-鿿぀-ヿ]/g) || []).length;
  const other = text.length - cjk;
  return Math.ceil(cjk + other / 3.5);
}

// UTC 当天日期键
export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// 下一个 UTC 0 点
export function nextResetUTC(d = new Date()): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

export function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h} 时 ${m % 60} 分`;
  return `${m} 分`;
}
