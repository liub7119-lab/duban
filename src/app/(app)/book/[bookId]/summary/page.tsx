import { requireUserOrRedirect, assertOwned } from "@/server/guard";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { AI_ENABLED } from "@/lib/ai/client";
import { SummaryView } from "@/components/reader/SummaryView";

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const user = await requireUserOrRedirect();
  const { bookId } = await params;
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      chapters: { orderBy: { index: "asc" }, select: { index: true, title: true } },
      summaries: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!book) notFound();
  assertOwned(user.id, book.userId);

  const bookSummary = book.summaries.find((s) => s.scope === "BOOK") || null;

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-6">
        <a href={`/book/${book.id}`} className="text-ink-light text-sm hover:text-ink">
          ← 返回阅读
        </a>
      </div>
      <h1 className="text-3xl font-bold text-ink tracking-widest mb-2">{book.title}</h1>
      <p className="text-ink-light mb-8">智能总结 · 愿君了然于胸</p>

      <SummaryView
        bookId={book.id}
        bookSummary={bookSummary}
        chapters={book.chapters}
        aiEnabled={AI_ENABLED}
      />
    </main>
  );
}
