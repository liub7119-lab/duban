import { requireUserOrRedirect, assertOwned } from "@/server/guard";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { NotesList } from "@/components/reader/NotesList";

export default async function NotesPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const user = await requireUserOrRedirect();
  const { bookId } = await params;
  const book = await prisma.book.findUnique({ where: { id: bookId }, select: { userId: true, title: true } });
  if (!book) notFound();
  assertOwned(user.id, book.userId);

  const notes = await prisma.note.findMany({
    where: { bookId, userId: user.id },
    orderBy: [{ chapterIndex: "asc" }, { startChar: "asc" }],
  });

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-6">
        <a href={`/book/${bookId}`} className="text-ink-light text-sm hover:text-ink">
          ← 返回阅读
        </a>
      </div>
      <h1 className="text-3xl font-bold text-ink tracking-widest mb-2">读书笔记</h1>
      <p className="text-ink-light mb-8">{book.title} · 共 {notes.length} 则</p>
      <NotesList bookId={bookId} notes={notes} />
    </main>
  );
}
