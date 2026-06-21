"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Msg = { id?: string; role: "user" | "assistant"; content: string };

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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // 创建新会话
  const newSession = useCallback(async () => {
    const res = await fetch(`/api/books/${bookId}/chat/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterIndex }),
    });
    const data = await res.json();
    setSessionId(data.session.id);
    setMessages([]);
    return data.session.id as string;
  }, [bookId, chapterIndex]);

  // 发送(流式)
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

        // 解析 SSE
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
      } catch (e: any) {
        setError(e?.message || "发送失败");
        // 移除空的 assistant 占位
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
    [bookId, chapterIndex]
  );

  // 初始提问(从选区 "问 AI" 触发)
  useEffect(() => {
    if (!initialAsk) return;
    (async () => {
      const sid = sessionId || (await newSession());
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
    const sid = sessionId || (await newSession());
    await send(text, sid);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 h-12 border-b border-wood/20 shrink-0">
        <h3 className="font-bold text-ink tracking-widest">边读边聊</h3>
        <button onClick={onClose} className="text-ink-light hover:text-ink text-xl">
          ×
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !sending && (
          <div className="text-center text-ink-light/70 text-sm py-10">
            <p className="mb-2">读至兴处,不妨问问「读伴」。</p>
            <p className="text-xs">可解读人物、赏析文笔、答疑典故……</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
              m.role === "user"
                ? "ml-auto bg-bamboo text-paper"
                : "mr-auto bg-paper-dark text-ink whitespace-pre-wrap"
            )}
          >
            {m.content || (sending && i === messages.length - 1 ? "…" : "")}
          </div>
        ))}
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
  );
}
