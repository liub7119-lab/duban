import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  const href = user ? "/library" : "/login";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-8 flex items-baseline gap-3">
        <span className="seal px-4 py-2 text-3xl">读</span>
        <h1 className="text-6xl font-bold tracking-widest text-ink">读伴</h1>
      </div>
      <p className="text-ink-light text-lg tracking-widest mb-2">
        展卷有益 · 与 AI 共读
      </p>
      <p className="text-ink-light/70 max-w-md mb-10 leading-relaxed">
        导入你的书籍,边读边与 AI 交谈,获取智能总结,记录每一段阅读时光。
      </p>
      <Link
        href={href}
        className="rounded bg-bamboo text-paper px-10 py-3 font-medium tracking-widest hover:bg-bamboo-dark transition-colors"
      >
        {user ? "进入书架" : "开 始 阅 读"}
      </Link>
    </main>
  );
}
