"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDuration } from "@/lib/utils";

type Stats = {
  overview: {
    bookCount: number;
    noteCount: number;
    sessionCount: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalReadingMs: number;
  };
  sevenDays: { day: string; minutes: number }[];
  progresses: {
    bookId: string;
    title: string;
    author: string | null;
    percent: number;
    chapterIndex: number;
    readingMinutes: number;
    lastAt: string;
  }[];
};

export function StatsView({ userId }: { userId: string }) {
  const [data, setData] = useState<Stats | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <p className="text-seal">{err}</p>;
  if (!data) return <p className="text-ink-light">载入中…</p>;

  const o = data.overview;
  const maxMin = Math.max(1, ...data.sevenDays.map((d) => d.minutes));

  return (
    <div className="space-y-10">
      {/* 概览卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="藏书" value={`${o.bookCount} 卷`} sub="书架" />
        <Stat label="总阅读" value={formatDuration(o.totalReadingMs)} sub="累计" />
        <Stat
          label="AI 对话"
          value={`${o.sessionCount} 次`}
          sub={`${formatTokens(o.totalTokensIn + o.totalTokensOut)} tokens`}
        />
        <Stat label="摘录" value={`${o.noteCount} 则`} sub="读书笔记" />
      </div>

      {/* 7 日图(简单柱) */}
      <section>
        <h2 className="text-xl font-bold text-ink tracking-widest mb-4 border-b border-wood/20 pb-2">
          近 7 日阅读
        </h2>
        <div className="ink-card p-6">
          <div className="flex items-end gap-3 h-40">
            {data.sevenDays.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-bamboo/10 rounded relative" style={{ height: "100%" }}>
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-bamboo rounded-t transition-all"
                    style={{ height: `${(d.minutes / maxMin) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-ink-light">{d.day}</div>
                <div className="text-xs text-ink">{d.minutes} 分</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 每本书进度 */}
      <section>
        <h2 className="text-xl font-bold text-ink tracking-widest mb-4 border-b border-wood/20 pb-2">
          手中之卷
        </h2>
        {data.progresses.length === 0 ? (
          <p className="text-ink-light text-sm">尚无阅读记录。</p>
        ) : (
          <div className="space-y-3">
            {data.progresses.map((p) => (
              <Link
                key={p.bookId}
                href={`/book/${p.bookId}`}
                className="ink-card p-4 block hover:border-bamboo transition-colors"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="font-medium text-ink">{p.title}</h3>
                  <span className="text-sm text-bamboo-dark">{p.percent}%</span>
                </div>
                <div className="h-1.5 bg-paper-dark rounded overflow-hidden mb-2">
                  <div
                    className="h-full bg-bamboo transition-all"
                    style={{ width: `${p.percent}%` }}
                  />
                </div>
                <p className="text-xs text-ink-light">
                  {p.author || "佚名"} · 第 {p.chapterIndex + 1} 章 ·
                  已读 {p.readingMinutes} 分 · 最近 {new Date(p.lastAt).toLocaleDateString("zh-CN")}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="ink-card p-5">
      <p className="text-xs text-ink-light tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs text-ink-light/70 mt-1">{sub}</p>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
