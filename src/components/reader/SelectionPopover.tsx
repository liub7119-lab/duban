"use client";

import { useEffect, useState } from "react";

export type SelectionInfo = {
  text: string;
  rect: { top: number; left: number };
};

// 监听容器内的文字选区,选中后浮出操作气泡
export function useSelectionPopover(containerSelector: string) {
  const [sel, setSel] = useState<SelectionInfo | null>(null);

  useEffect(() => {
    function handler() {
      const s = window.getSelection();
      if (!s || s.isCollapsed || s.rangeCount === 0) {
        setSel(null);
        return;
      }
      const text = s.toString().trim();
      if (text.length < 1 || text.length > 2000) {
        setSel(null);
        return;
      }
      // 确认选区在阅读容器内
      const container = document.querySelector(containerSelector);
      const range = s.getRangeAt(0);
      if (!container || !container.contains(range.commonAncestorContainer)) {
        setSel(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setSel({ text, rect: { top: rect.top, left: rect.left + rect.width / 2 } });
    }
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [containerSelector]);

  function clear() {
    window.getSelection()?.removeAllRanges();
    setSel(null);
  }

  return { sel, clear, setSel };
}

export function SelectionPopover({
  sel,
  onAsk,
  onNote,
  onClose,
}: {
  sel: SelectionInfo;
  onAsk: (text: string) => void;
  onNote: (text: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed z-50 -translate-x-1/2 flex gap-1 bg-ink text-paper rounded shadow-lg px-1 py-1"
      style={{ top: sel.rect.top - 44, left: sel.rect.left }}
      onMouseDown={(e) => e.preventDefault()} // 防止选区丢失
    >
      <button
        onClick={() => onAsk(sel.text)}
        className="px-3 py-1 text-sm hover:bg-bamboo rounded transition-colors"
      >
        💬 问 AI
      </button>
      <button
        onClick={() => onNote(sel.text)}
        className="px-3 py-1 text-sm hover:bg-seal rounded transition-colors"
      >
        🖋 摘录
      </button>
      <button
        onClick={onClose}
        className="px-2 py-1 text-sm text-paper/70 hover:text-paper"
      >
        ×
      </button>
    </div>
  );
}
