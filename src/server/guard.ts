import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

// 仅服务端调用:取登录用户,未登录抛错(API 用)
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

// 受保护页面用
export async function requireUserOrRedirect() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// 检查资源归属
export function assertOwned(userId: string, ownerId: string) {
  if (userId !== ownerId) throw new Error("FORBIDDEN");
}
