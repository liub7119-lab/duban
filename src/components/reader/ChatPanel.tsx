"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Msg = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  selection?: string;
};
type Session = {
  id: string;
  title: string | null;
  chapterIndex: number | null;
  createdAt: string;
  _count?: { messages: number };
};

export function ChatPanel({
  bookId,
  chapterIndex,
  initialAsk,
  onInitialAskConsumed,
  onClose,
}: {
  bookId: string;
  chapterIndex: number;
  initialAsk?: string | null;
  onInitialAskConsumed: () => void;
  onClose: () => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const r = await fetch(`/api/books/${bookId}/chat/sessions`);
      const d = await r.json();
      setSessions(d.sessions || []);
    } finally {
      setLoadingSessions(false);
    }
  }, [bookId]);

  // 加载会话历史
  const loadHistory = useCallback(async (sid: string) => {
    setLoadingHistory(true);
    try {
      const r = await fetch(`/api/books/${bookId}/chat/${sid}`);
      const d = await r.json();
      const msgs: Msg[] = (d.messages || [])
        .filter((m: any) => m.role === "user" || m.role === "assistant")
        .map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          selection: m.selection ?? undefined,
        }));
      setMessages(msgs);
    } finally {
      setLoadingHistory(false);
    }
  }, [bookId]);

  // 初始:打开抽屉时拉会话列表
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 创建新会话(切到新对话)
  const createNewSession = useCallback(async () => {
    const r = await fetch(`/api/books/${bookId}/chat/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterIndex }),
    });
    const d = await r.json();
    setActiveSessionId(d.session.id);
    setMessages([]);
    // 重新拉列表(让新会话出现在最前)
    loadSessions();
    return d.session.id as string;
  }, [bookId, chapterIndex, loadSessions]);

  // 切换会话
  async function switchSession(sid: string) {
    if (sending) return;
    setActiveSessionId(sid);
    setError("");
    await loadHistory(sid);
  }

  // 删除会话
  async function deleteSession(sid: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("删除这条对话?此操作不可恢复。")) return;
    await fetch(`/api/books/${bookId}/chat/${sid}`, { method: "DELETE" });
    if (activeSessionId === sid) {
      setActiveSessionId(null);
      setMessages([]);
    }
    await loadSessions();
  }

  // 流式发送
  const send = useCallback(
    async (text: string, sid: string, selectionQuote?: string | null) => {
      setSending(true);
      setError("");
      const userMsg: Msg = { role: "user", content: text };
      const assistantMsg: Msg = { role: "assistant", content: "" };
      setMessages((m) => [...m, userMsg, assistantMsg]);

      try {
        const res = await fetch(`/api/books/${bookId}/chat/${sid}/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            chapterIndex,
            selection: selectionQuote
              ? { chapterIndex, start: 0, end: selectionQuote.length, quote: selectionQuote }
              : undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `请求失败(${res.status})`);
        }
        if (!res.body) throw new Error("无响应流");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";
          for (const block of blocks) {
            const lines = block.split("\n");
            let event = "message";
            let dataStr = "";
            for (const ln of lines) {
              if (ln.startsWith("event:")) event = ln.slice(6).trim();
              else if (ln.startsWith("data:")) dataStr += ln.slice(5).trim();
            }
            if (!dataStr) continue;
            const data = JSON.parse(dataStr);
            if (event === "delta") {
              acc += data.text;
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            } else if (event === "error") {
              throw new Error(data.message);
            }
          }
        }
        // 流结束:刷新会话列表(标题/顺序可能变化)
        loadSessions();
      } catch (e: any) {
        setError(e?.message || "发送失败");
        setMessages((m) =>
          m[m.length - 1]?.content === "" && m[m.length - 1].role === "assistant"
            ? m.slice(0, -1)
            : m
        );
      } finally {
        setSending(false);
        setPendingSelection(null);
      }
    },
    [bookId, chapterIndex, loadSessions]
  );

  // 初始提问(从选区 "问 AI" 触发)
  useEffect(() => {
    if (!initialAsk) return;
    (async () => {
      const sid = activeSessionId || (await createNewSession());
      await send(initialAsk, sid, pendingSelection);
      onInitialAskConsumed();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAsk]);

  // 自动滚到底
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const sid = activeSessionId || (await createNewSession());
    await send(text, sid);
  }

  const activeTitle =
    sessions.find((s) => s.id === activeSessionId)?.title || (activeSessionId ? "对话" : "新对话");

  return (
    <div className="flex h-full">
      {/* 会话列表侧栏 */}
      <aside className="w-44 border-r border-wood/20 bg-paper-dark/30 flex flex-col shrink-0">
        <div className="p-2 border-b border-wood/15">
          <button
            onClick={createNewSession}
            disabled={sending}
            className="w-full text-xs bg-bamboo text-paper rounded py-1.5 hover:bg-bamboo-dark disabled:opacity-50"
          >
            + 新对话
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {loadingSessions && sessions.length === 0 ? (
            <p className="text-xs text-ink-light/60 p-3 text-center">载入中…</p>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-ink-light/60 p-3 text-center">暂无对话</p>
          ) : (
            <ul>
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => switchSession(s.id)}
                    className={cn(
                      "w-full text-left px-2.5 py-2 text-xs group flex items-start gap-1",
                      s.id === activeSessionId
                        ? "bg-bamboo/15 text-bamboo-dark"
                        : "hover:bg-paper text-ink-light"
                    )}
                  >
                    <span className="flex-1 truncate">
                      {s.title || "新对话"}
                    </span>
                    <span
                      onClick={(e) => deleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-ink-light hover:text-seal shrink-0"
                      title="删除"
                    >
                      ×
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* 主对话区 */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between px-4 h-12 border-b border-wood/20 shrink-0">
          <h3 className="font-bold text-ink tracking-wider truncate" title={activeTitle}>
            {activeTitle}
          </h3>
          <button onClick={onClose} className="text-ink-light hover:text-ink text-xl shrink-0 ml-2">
            ×
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-4 space-y-4">
          {loadingHistory ? (
            <p className="text-center text-ink-light/70 text-sm py-10">载入对话中…</p>
          ) : messages.length === 0 && !sending ? (
            <div className="text-center text-ink-light/70 text-sm py-10">
              <p className="mb-2">{activeSessionId ? "这条对话还没有消息。" : "读至兴处,不妨问问「读伴」。"}</p>
              <p className="text-xs">可解读人物、赏析文笔、答疑典故……</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={m.id ?? i}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-auto bg-bamboo text-paper"
                    : "mr-auto bg-paper-dark text-ink whitespace-pre-wrap"
                )}
              >
                {m.content || (sending && i === messages.length - 1 ? "…" : "")}
              </div>
            ))
          )}
          {error && <p className="text-seal text-xs text-center">{error}</p>}
        </div>

        <form onSubmit={onSubmit} className="border-t border-wood/20 p-3 shrink-0">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={sending ? "回答中…" : "说点什么…"}
              disabled={sending}
              className="flex-1 rounded border border-wood/30 bg-paper px-3 py-2 text-sm outline-none focus:border-bamboo"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded bg-bamboo text-paper px-4 text-sm disabled:opacity-50"
            >
              发送
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}