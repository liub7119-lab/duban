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
    <header className="border-b border-wood/20 bg-paper/80 backdrop-blur-sm sticky top-0 z-20 safe-top">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        <Link href="/library" className="flex items-baseline gap-2 shrink-0">
          <span className="seal px-2 py-0.5 text-sm">读</span>
          <span className="text-xl sm:text-2xl font-bold tracking-wider text-ink">读伴</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 sm:px-4 py-1.5 rounded text-sm tracking-widest transition-colors",
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
            <span className="ml-2 text-sm text-ink-light hidden md:inline">
              {userName}
            </span>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="ml-1 sm:ml-2 px-3 py-1.5 rounded text-sm text-ink-light hover:text-seal transition-colors"
            title="退出"
          >
            <span className="hidden sm:inline">退出</span>
            <span className="sm:hidden">⎋</span>
          </button>
        </nav>
      </div>
    </header>
  );
}