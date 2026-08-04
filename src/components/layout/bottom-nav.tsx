"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, TrendingUp, Target, CircleUser } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/evolucao", label: "Evolução", icon: TrendingUp },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/perfil", label: "Perfil", icon: CircleUser },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between gap-1 rounded-2xl border border-apex-border bg-apex-surface/85 p-1.5 shadow-[0_16px_40px_-14px_rgba(0,0,0,0.75)] backdrop-blur-xl">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition-all duration-150",
                  isActive
                    ? "bg-gradient-to-b from-apex-accent/20 to-apex-accent/5 text-apex-text-primary shadow-[inset_0_0_0_1px_rgba(77,123,255,0.35)]"
                    : "text-apex-text-tertiary hover:text-apex-text-secondary",
                )}
              >
                <Icon
                  className={cn("size-5", isActive && "text-apex-accent")}
                  strokeWidth={isActive ? 2.25 : 1.75}
                  aria-hidden="true"
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
