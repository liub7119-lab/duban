import { prisma } from "@/lib/db";
import { todayKey, nextResetUTC } from "@/lib/utils";

const MAX_TOKENS = Number(process.env.QUOTA_MAX_TOKENS_PER_DAY || "200000");
const MAX_MSGS = Number(process.env.QUOTA_MAX_MESSAGES_PER_DAY || "100");

export class QuotaExceededError extends Error {
  constructor(
    message: string,
    public detail: { tokensUsed: number; msgsUsed: number; maxTokens: number; maxMsgs: number }
  ) {
    super(message);
  }
}

// 确保当天配额行存在(过期则重置)
async function ensureToday(userId: string) {
  const today = todayKey();
  const existing = await prisma.userQuota.findUnique({ where: { userId } });

  if (!existing) {
    await prisma.userQuota.create({
      data: { userId, day: today, resetAt: nextResetUTC() },
    });
    return;
  }

  if (existing.day !== today || existing.resetAt <= new Date()) {
    await prisma.userQuota.update({
      where: { userId },
      data: { day: today, tokensUsed: 0, msgsUsed: 0, resetAt: nextResetUTC() },
    });
  }
}

// 预扣:发起 AI 调用前。用事务保证原子,SQLite 下 $transaction 自动升 IMMEDIATE。
export async function reserveQuota(userId: string, estTokens: number) {
  await ensureToday(userId);
  const today = todayKey();

  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.userQuota.findUniqueOrThrow({ where: { userId } });
    if (row.tokensUsed + estTokens > MAX_TOKENS) {
      throw new QuotaExceededError("今日 token 额度已用尽", {
        tokensUsed: row.tokensUsed, msgsUsed: row.msgsUsed, maxTokens: MAX_TOKENS, maxMsgs: MAX_MSGS,
      });
    }
    if (row.msgsUsed + 1 > MAX_MSGS) {
      throw new QuotaExceededError("今日提问次数已用尽", {
        tokensUsed: row.tokensUsed, msgsUsed: row.msgsUsed, maxTokens: MAX_TOKENS, maxMsgs: MAX_MSGS,
      });
    }
    const updated = await tx.userQuota.update({
      where: { userId },
      data: { tokensUsed: { increment: estTokens }, msgsUsed: { increment: 1 } },
    });
    return updated;
  });
  return result;
}

// 实扣修正:用真实 usage 调整差额,并记一行审计
export async function recordUsage(opts: {
  userId: string;
  bookId?: string;
  type: "CHAT" | "SUMMARY" | "EMBED";
  estTokens: number; // 预扣量(用于修正)
  realTokensIn?: number;
  realTokensOut?: number;
}) {
  const realIn = opts.realTokensIn ?? 0;
  const realOut = opts.realTokensOut ?? 0;
  const real = realIn + realOut;
  const diff = real - opts.estTokens; // 正:实际多于预扣需补;负:退还

  await prisma.$transaction([
    prisma.usageRecord.create({
      data: {
        userId: opts.userId,
        bookId: opts.bookId,
        type: opts.type,
        tokensIn: realIn,
        tokensOut: realOut,
        day: todayKey(),
      },
    }),
    // msgsUsed 在预扣已 +1,这里只修正 token 差额
    prisma.userQuota.update({
      where: { userId: opts.userId },
      data: { tokensUsed: { increment: diff } },
    }),
  ]);
}
