"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Note = {
  id: string;
  chapterIndex: number;
  quote: string;
  note: string | null;
  createdAt: Date | string;
};

export function NotesList({ bookId, notes: initial }: { bookId: string; notes: Note[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState(initial);

  async function remove(id: string) {
    if (!confirm("删除这条摘录?")) return;
    await fetch(`/api/books/${bookId}/notes?id=${id}`, { method: "DELETE" });
    setNotes(notes.filter((n) => n.id !== id));
    router.refresh();
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="seal w-14 h-14 rounded-full text-xl mx-auto mb-4 opacity-70">笺</div>
        <p className="text-ink-light">尚未摘录。读书时选中文字,点击「🖋 摘录」即可。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notes.map((n) => (
        <article key={n.id} className="ink-card p-5">
          <div className="flex items-center justify-between text-xs text-ink-light mb-2">
            <span>第 {n.chapterIndex + 1} 章</span>
            <span>{new Date(n.createdAt).toLocaleString("zh-CN")}</span>
          </div>
          <p className="text-ink italic border-l-2 border-seal/40 pl-3 mb-2">"{n.quote}"</p>
          {n.note && <p className="text-sm text-ink-light">{n.note}</p>}
          <div className="mt-3 text-right">
            <button onClick={() => remove(n.id)} className="text-xs text-ink-light/60 hover:text-seal">
              删除
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}