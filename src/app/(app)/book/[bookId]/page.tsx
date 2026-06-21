import { requireUserOrRedirect, assertOwned } from "@/server/guard";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Reader } from "@/components/reader/Reader";

export default async function BookPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const user = await requireUserOrRedirect();
  const { bookId } = await params;

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      chapters: {
        orderBy: { index: "asc" },
        select: { index: true, title: true, charCount: true },
      },
      progress: { where: { userId: user.id } },
    },
  });
  if (!book) notFound();
  assertOwned(user.id, book.userId);

  return (
    <Reader
      bookId={book.id}
      title={book.title}
      author={book.author}
      chapters={book.chapters}
      initialChapterIndex={book.progress[0]?.chapterIndex ?? 0}
    />
  );
}
