import Link from "next/link";

import { requireAdmin } from "@/server/services/auth-guard";

const ADMIN_NAV = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/convites", label: "Convites" },
  { href: "/admin/usuarios", label: "Usuários" },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-1 flex-col gap-6 bg-apex-bg px-5 py-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-apex-text-tertiary">
          Administração
        </p>
        <h1 className="mt-1 text-xl font-semibold text-apex-text-primary">APEX 4</h1>
      </header>

      <nav className="flex gap-2 border-b border-apex-border pb-4">
        {ADMIN_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-apex-text-secondary transition-colors hover:bg-apex-surface hover:text-apex-text-primary"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex-1">{children}</div>
    </div>
  );
}
