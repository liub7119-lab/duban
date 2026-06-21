import { requireUserOrRedirect } from "@/server/guard";
import { AppNav } from "@/components/AppNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUserOrRedirect();
  return (
    <div className="min-h-screen flex flex-col">
      <AppNav userName={user.name} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
