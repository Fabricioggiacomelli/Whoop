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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-apex-border bg-apex-bg/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150",
                  isActive ? "text-apex-text-primary" : "text-apex-text-tertiary",
                )}
              >
                <Icon
                  className="size-5"
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
