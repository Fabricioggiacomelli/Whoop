import { BottomNav } from "@/components/layout/bottom-nav";
import { PullToRefresh } from "@/components/layout/pull-to-refresh";
import { requireUser } from "@/server/services/auth-guard";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-apex-bg">
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <PullToRefresh>{children}</PullToRefresh>
      </main>
      <BottomNav />
    </div>
  );
}
