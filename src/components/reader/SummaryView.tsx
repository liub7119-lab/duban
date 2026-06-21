"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Summary = { id: string; scope: string; chapterIndex: number | null; content: string };
type Chapter = { index: number; title: string };

export function SummaryView({
  bookId,
  bookSummary,
  chapters,
  aiEnabled,
}: {
  bookId: string;
  bookSummary: Summary | null;
  chapters: Chapter[];
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [bookContent, setBookContent] = useState(bookSummary?.content || "");
  const [bookLoading, setBookLoading] = useState(false);
  const [bookErr, setBookErr] = useState("");

  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const [chapterContent, setChapterContent] = useState("");
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterErr, setChapterErr] = useState("");

  async function genBook() {
    setBookLoading(true);
    setBookErr("");
    const res = await fetch(`/api/books/${bookId}/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "BOOK" }),
    });
    const data = await res.json();
    setBookLoading(false);
    if (data.ok) {
      setBookContent(data.content);
      router.refresh();
    } else {
      setBookErr(data.error || "生成失败");
    }
  }

  async function genChapter(idx: number) {
    setActiveChapter(idx);
    setChapterLoading(true);
    setChapterErr("");
    setChapterContent("");
    const res = await fetch(`/api/books/${bookId}/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "CHAPTER", chapterIndex: idx }),
    });
    const data = await res.json();
    setChapterLoading(false);
    if (data.ok) {
      setChapterContent(data.content);
      router.refresh();
    } else {
      setChapterErr(data.error || "生成失败");
    }
  }

  if (!aiEnabled) {
    return (
      <div className="ink-card p-8 text-center">
        <p className="text-seal mb-2">AI 功能未配置</p>
        <p className="text-ink-light text-sm">管理员需在 .env 中设置 AI_API_KEY 后即可使用智能总结。</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* 全书总结 */}
      <section>
        <div className="flex items-end justify-between mb-4 border-b border-wood/20 pb-2">
          <h2 className="text-xl font-bold text-ink tracking-widest">全书要旨</h2>
          <button
            onClick={genBook}
            disabled={bookLoading}
            className="text-sm text-bamboo-dark hover:text-bamboo disabled:opacity-50"
          >
            {bookLoading ? "凝思中…" : bookContent ? "↻ 重新生成" : "✦ 生成总结"}
          </button>
        </div>
        {bookErr && <p className="text-seal text-sm mb-2">{bookErr}</p>}
        {bookContent ? (
          <article className="ink-card p-6 reader-text">{bookContent}</article>
        ) : (
          <p className="text-ink-light/70 text-sm py-6">尚无总结。点上方按钮生成。</p>
        )}
      </section>

      {/* 章节总结 */}
      <section>
        <h2 className="text-xl font-bold text-ink tracking-widest mb-4 border-b border-wood/20 pb-2">
          章节速览
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
          {chapters.map((c) => (
            <button
              key={c.index}
              onClick={() => genChapter(c.index)}
              className={`text-left px-3 py-2 rounded text-sm transition-colors ${
                activeChapter === c.index
                  ? "bg-bamboo text-paper"
                  : "bg-paper-dark text-ink-light hover:bg-bamboo/20"
              }`}
            >
              <span className="text-ink-light/50 mr-1">{c.index + 1}.</span>
              {c.title}
            </button>
          ))}
        </div>
        {chapterErr && <p className="text-seal text-sm mb-2">{chapterErr}</p>}
        {chapterLoading && (
          <p className="text-ink-light text-sm py-4">凝思中…</p>
        )}
        {chapterContent && !chapterLoading && (
          <article className="ink-card p-6 reader-text">{chapterContent}</article>
        )}
      </section>
    </div>
  );
}
