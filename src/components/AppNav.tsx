"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/library", label: "书架" },
  { href: "/stats", label: "数据" },
];

export function AppNav({ userName }: { userName?: string | null }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-wood/20 bg-paper/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/library" className="flex items-baseline gap-2">
          <span className="seal px-2 py-0.5 text-sm">读</span>
          <span className="text-2xl font-bold tracking-wider text-ink">读伴</span>
        </Link>
        <nav className="flex items-center gap-2">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-1.5 rounded text-sm tracking-widest transition-colors",
                  active
                    ? "bg-bamboo text-paper"
                    : "text-ink-light hover:bg-paper-dark"
                )}
              >
                {item.label}
              </Link>
            );
          })}
          {userName && (
            <span className="ml-3 text-sm text-ink-light hidden sm:inline">
              {userName}
            </span>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="ml-2 px-3 py-1.5 rounded text-sm text-ink-light hover:text-seal transition-colors"
          >
            退出
          </button>
        </nav>
      </div>
    </header>
  );
}
