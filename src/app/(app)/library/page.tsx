import { requireUserOrRedirect } from "@/server/guard";
import { prisma } from "@/lib/db";
import { Library } from "@/components/library/Library";

export default async function LibraryPage() {
  const user = await requireUserOrRedirect();
  const books = await prisma.book.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { chapters: true } } },
  });
  return <Library books={books} />;
}
