import Link from "next/link";
import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          <span className="text-2xl font-semibold tracking-tight text-apex-text-primary">
            APEX<span className="text-apex-accent">4</span>
          </span>
          <p className="mt-2 text-sm text-apex-text-secondary">Compete. Recover. Evolve.</p>
        </div>

        <LoginForm />

        <div className="mt-6 flex flex-col items-center gap-4 text-sm">
          <Link
            href="/login/esqueci-senha"
            className="text-apex-text-secondary transition-colors hover:text-apex-text-primary"
          >
            Esqueci minha senha
          </Link>
          <p className="text-xs text-apex-text-tertiary">Acesso somente por convite.</p>
        </div>
      </div>
    </div>
  );
}
