import { BottomNav } from "@/components/layout/bottom-nav";
import { requireUser } from "@/server/services/auth-guard";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-apex-bg">
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}
