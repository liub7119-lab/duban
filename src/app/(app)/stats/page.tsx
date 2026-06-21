import { requireUserOrRedirect } from "@/server/guard";
import { StatsView } from "@/components/stats/StatsView";

export default async function StatsPage() {
  const user = await requireUserOrRedirect();
  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-ink tracking-widest mb-2">阅读数据</h1>
      <p className="text-ink-light mb-8">展卷有迹,一沙一世界</p>
      <StatsView userId={user.id} />
    </main>
  );
}
