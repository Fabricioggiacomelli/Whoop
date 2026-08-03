export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-apex-bg pt-[env(safe-area-inset-top)]">
      {children}
    </div>
  );
}
