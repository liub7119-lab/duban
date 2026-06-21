"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Book } from "@prisma/client";

type BookWithCount = Book & { _count: { chapters: number } };

export function Library({ books }: { books: BookWithCount[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/books", { method: "POST", body: form });
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "上传失败");
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-8 border-b border-wood/20 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-widest text-ink">书架</h1>
          <p className="text-sm text-ink-light mt-1 tracking-wider">
            共 {books.length} 卷 · 支持导入 EPUB / TXT / PDF
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded bg-bamboo text-paper px-5 py-2 text-sm tracking-widest hover:bg-bamboo-dark disabled:opacity-50 transition-colors"
        >
          {uploading ? "导入中…" : "＋ 导入书籍"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".epub,.txt,.pdf"
          className="hidden"
          onChange={onFile}
        />
      </div>

      {error && (
        <p className="text-seal text-sm mb-4 bg-seal/10 px-4 py-2 rounded">{error}</p>
      )}

      {books.length === 0 ? (
        <EmptyState onPick={() => inputRef.current?.click()} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </main>
  );
}

function BookCard({ book }: { book: BookWithCount }) {
  return (
    <Link href={`/book/${book.id}`} className="group block">
      <div className="relative aspect-[3/4] ink-card overflow-hidden">
        {book.coverPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/books/${book.id}/cover`}
            alt={book.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-paper-dark to-paper p-3 text-center">
            <div className="seal w-10 h-10 rounded-full text-lg mb-3">书</div>
            <p className="text-sm text-ink font-medium line-clamp-3 leading-relaxed">
              {book.title}
            </p>
          </div>
        )}
        {book.status !== "READY" && (
          <div className="absolute inset-0 bg-ink/50 flex items-center justify-center">
            <span className="text-paper text-sm">
              {book.status === "PROCESSING" ? "解析中…" : "解析失败"}
            </span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/80 to-transparent p-2">
          <span className="text-paper text-xs">{book.format}</span>
        </div>
      </div>
      <div className="mt-2 px-1">
        <p className="text-sm font-medium text-ink line-clamp-1 group-hover:text-bamboo-dark transition-colors">
          {book.title}
        </p>
        <p className="text-xs text-ink-light mt-0.5">
          {book.author || "佚名"} · {book._count.chapters} 章
        </p>
      </div>
    </Link>
  );
}

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <div className="text-center py-24">
      <div className="seal w-16 h-16 rounded-full text-2xl mx-auto mb-6 opacity-70">
        空
      </div>
      <p className="text-ink-light tracking-widest mb-1">书架空空,何不展卷?</p>
      <p className="text-ink-light/60 text-sm mb-8">
        导入 EPUB 体验最佳 · TXT 自动识别章节 · PDF 可读但体验一般
      </p>
      <button
        onClick={onPick}
        className="rounded bg-bamboo text-paper px-8 py-2.5 text-sm tracking-widest hover:bg-bamboo-dark transition-colors"
      >
        导入第一本书
      </button>
    </div>
  );
}
