import { requireUser } from "@/server/services/auth-guard";

export default async function DisplayLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="min-h-screen bg-apex-bg">{children}</div>;
}
