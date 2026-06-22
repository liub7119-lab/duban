"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useSelectionPopover, SelectionPopover } from "./SelectionPopover";
import { ChatPanel } from "./ChatPanel";

type ChapterMeta = { index: number; title: string; charCount: number };
type ChapterData = { index: number; title: string; content: string };

export function Reader({
  bookId,
  title,
  author,
  chapters,
  initialChapterIndex,
}: {
  bookId: string;
  title: string;
  author: string | null;
  chapters: ChapterMeta[];
  initialChapterIndex: number;
}) {
  const [chapterIdx, setChapterIdx] = useState(initialChapterIndex);
  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(2.1);
  const [vertical, setVertical] = useState(false);

  // 选区 & 聊天
  const [chatOpen, setChatOpen] = useState(false);
  const [initialAsk, setInitialAsk] = useState<string | null>(null);
  const { sel, clear: clearSel } = useSelectionPopover("[data-chapter-content]");

  const contentRef = useRef<HTMLDivElement>(null);
  const lastReport = useRef(Date.now());

  async function askAI(text: string) {
    setInitialAsk(text);
    setChatOpen(true);
    clearSel();
  }

  async function makeNote(text: string) {
    try {
      await fetch(`/api/books/${bookId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterIndex: chapterIdx,
          startChar: 0,
          endChar: text.length,
          quote: text,
        }),
      });
      clearSel();
      // 简易反馈
      const note = document.createElement("div");
      note.textContent = "已摘录 ✦";
      note.className = "fixed top-20 left-1/2 -translate-x-1/2 bg-seal text-paper px-4 py-1.5 rounded text-sm z-50 shadow-lg";
      document.body.appendChild(note);
      setTimeout(() => note.remove(), 1500);
    } catch {}
  }

  // 从 localStorage 恢复阅读偏好
  useEffect(() => {
    const saved = localStorage.getItem(`reader:pref`);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.fontSize) setFontSize(p.fontSize);
        if (p.lineHeight) setLineHeight(p.lineHeight);
        if (typeof p.vertical === "boolean") setVertical(p.vertical);
      } catch {}
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(
      `reader:pref`,
      JSON.stringify({ fontSize, lineHeight, vertical })
    );
  }, [fontSize, lineHeight, vertical]);

  // 拉取章节内容
  const loadChapter = useCallback(
    async (idx: number, restoreRatio = 0) => {
      setLoading(true);
      const res = await fetch(`/api/books/${bookId}/chapters/${idx}`);
      const data = await res.json();
      if (data.status === "READY" && data.chapter) {
        setChapter({ index: data.chapter.index, title: data.chapter.title, content: data.chapter.content });
        // 恢复滚动位置
        requestAnimationFrame(() => {
          if (contentRef.current && restoreRatio > 0) {
            const el = contentRef.current;
            el.scrollTop = el.scrollHeight * restoreRatio;
          } else {
            contentRef.current?.scrollTo({ top: 0 });
          }
        });
      }
      setLoading(false);
    },
    [bookId]
  );

  useEffect(() => {
    loadChapter(chapterIdx);
  }, [chapterIdx, loadChapter]);

  // 上报进度(节流 + 离开时上报)
  const reportProgress = useCallback(
    async (deltaMs: number) => {
      const ratio = scrollRatio();
      fetch(`/api/books/${bookId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterIndex: chapterIdx, scrollRatio: ratio, deltaMs }),
      }).catch(() => {});
    },
    [bookId, chapterIdx]
  );

  function scrollRatio(): number {
    const el = contentRef.current;
    if (!el) return 0;
    const max = el.scrollHeight - el.clientHeight;
    return max > 0 ? Math.min(1, el.scrollTop / max) : 0;
  }

  // 心跳:每 15s 上报阅读时长
  useEffect(() => {
    const interval = setInterval(() => {
      reportProgress(15000);
      lastReport.current = Date.now();
    }, 15000);
    const onHide = () => reportProgress(Date.now() - (lastReport.current || Date.now()));
    window.addEventListener("beforeunload", onHide);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", onHide);
    };
  }, [reportProgress]);

  function goChapter(idx: number) {
    if (idx < 0 || idx >= chapters.length) return;
    reportProgress(0);
    setChapterIdx(idx);
    setTocOpen(false);
  }

  const hasNext = chapterIdx < chapters.length - 1;
  const hasPrev = chapterIdx > 0;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* 顶部工具栏 */}
      <div className="border-b border-wood/20 bg-paper/70 backdrop-blur-sm px-3 sm:px-6 h-12 flex items-center justify-between text-sm shrink-0">
        <button
          onClick={() => setTocOpen(true)}
          className="flex items-center gap-1.5 text-ink-light hover:text-ink"
        >
          <span className="text-lg">≡</span> <span className="hidden sm:inline">目录</span>
        </button>
        <span className="text-ink-light truncate mx-2 sm:mx-4 flex-1 text-center text-xs sm:text-sm">
          <span className="hidden sm:inline">{title} · </span>第 {chapterIdx + 1}/{chapters.length} 章
        </span>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => setChatOpen(true)}
            className="text-bamboo-dark hover:text-bamboo font-medium"
          >
            💬 <span className="hidden sm:inline">边读边聊</span>
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-ink-light hover:text-ink"
          >
            ⚙ <span className="hidden sm:inline">设置</span>
          </button>
        </div>
      </div>

      {/* 正文区 */}
      <div
        ref={contentRef}
        className="flex-1 overflow-auto"
      >
        <div
          className="mx-auto max-w-2xl px-4 sm:px-8 py-8 sm:py-12"
          style={
            vertical
              ? { writingMode: "vertical-rl" as const, maxHeight: "none" }
              : undefined
          }
        >
          {loading || !chapter ? (
            <p className="text-center text-ink-light py-20">展卷中…</p>
          ) : (
            <>
              <h2 className="text-xl sm:text-2xl font-bold text-center text-ink mb-6 sm:mb-8 tracking-widest">
                {chapter.title}
              </h2>
              <article
                className="reader-text whitespace-pre-wrap break-words"
                style={{ fontSize: `${fontSize}px`, lineHeight }}
                data-chapter-content
              >
                {chapter.content}
              </article>
              {/* 翻页 */}
              <div className="flex items-center justify-between mt-12 mb-8 pt-6 border-t border-wood/20">
                <button
                  onClick={() => goChapter(chapterIdx - 1)}
                  disabled={!hasPrev}
                  className="px-4 py-2 rounded text-sm text-ink-light hover:text-ink disabled:opacity-30"
                >
                  ← 上一章
                </button>
                <div className="flex items-center gap-3 text-xs text-ink-light/70">
                  <Link href={`/book/${bookId}/notes`} className="hover:text-bamboo-dark">
                    笔记
                  </Link>
                  <span>·</span>
                  <Link href={`/book/${bookId}/summary`} className="hover:text-bamboo-dark">
                    总结
                  </Link>
                  <span>·</span>
                  <Link href="/library" className="hover:text-bamboo-dark">
                    书架
                  </Link>
                </div>
                <button
                  onClick={() => goChapter(chapterIdx + 1)}
                  disabled={!hasNext}
                  className="px-4 py-2 rounded text-sm text-ink-light hover:text-ink disabled:opacity-30"
                >
                  下一章 →
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 目录抽屉 */}
      {tocOpen && (
        <Drawer title="目录" onClose={() => setTocOpen(false)}>
          <ol className="space-y-1">
            {chapters.map((c) => (
              <li key={c.index}>
                <button
                  onClick={() => goChapter(c.index)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                    c.index === chapterIdx
                      ? "bg-bamboo/15 text-bamboo-dark font-medium"
                      : "text-ink-light hover:bg-paper-dark"
                  )}
                >
                  <span className="text-ink-light/50 mr-2">{c.index + 1}.</span>
                  {c.title}
                </button>
              </li>
            ))}
          </ol>
        </Drawer>
      )}

      {/* 设置抽屉 */}
      {settingsOpen && (
        <Drawer title="阅读设置" onClose={() => setSettingsOpen(false)}>
          <Setting label={`字号 · ${fontSize}px`}>
            <input
              type="range" min={14} max={28} step={1}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full accent-bamboo"
            />
          </Setting>
          <Setting label={`行距 · ${lineHeight.toFixed(1)}`}>
            <input
              type="range" min={1.6} max={2.8} step={0.1}
              value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
              className="w-full accent-bamboo"
            />
          </Setting>
          <Setting label="竖排">
            <button
              onClick={() => setVertical((v) => !v)}
              className={cn(
                "px-4 py-1.5 rounded text-sm",
                vertical ? "bg-bamboo text-paper" : "bg-paper-dark text-ink-light"
              )}
            >
              {vertical ? "已开启" : "关闭"}
            </button>
          </Setting>
        </Drawer>
      )}

      {/* 选区操作气泡 */}
      {sel && (
        <SelectionPopover
          sel={sel}
          onAsk={askAI}
          onNote={makeNote}
          onClose={clearSel}
        />
      )}

      {/* 边读边聊抽屉 - 移动端全屏,桌面端右侧 */}
      {chatOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="hidden sm:block flex-1 bg-ink/30"
            onClick={() => setChatOpen(false)}
          />
          <aside className="w-full sm:w-96 max-w-[100vw] bg-paper border-l border-wood/20 shadow-xl flex flex-col">
            <ChatPanel
              bookId={bookId}
              chapterIndex={chapterIdx}
              initialAsk={initialAsk}
              onInitialAskConsumed={() => setInitialAsk(null)}
              onClose={() => setChatOpen(false)}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-ink/30" onClick={onClose} />
      <aside className="w-80 max-w-[80vw] bg-paper border-l border-wood/20 shadow-xl overflow-auto p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-ink tracking-widest">{title}</h3>
          <button onClick={onClose} className="text-ink-light hover:text-ink text-xl">
            ×
          </button>
        </div>
        <div className="space-y-5">{children}</div>
      </aside>
    </div>
  );
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-ink-light mb-2 tracking-wider">{label}</p>
      {children}
    </div>
  );
}
