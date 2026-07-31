import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Esqueci minha senha",
};

/**
 * MVP: sem serviço de e-mail transacional configurado ainda (ver PLAN.md §4 e ROADMAP.md).
 * O admin gera um link de redefinição assinado, de uso único, pela área /admin/usuarios.
 * Este ponto será substituído por um fluxo de e-mail automático quando houver domínio de
 * produção e provedor de e-mail definidos.
 */
export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-semibold text-apex-text-primary">Esqueceu sua senha?</h1>
        <p className="mt-3 text-sm text-apex-text-secondary">
          Como o APEX 4 é fechado por convite, a redefinição de senha é feita diretamente pelo
          administrador do grupo. Peça a ele um novo link de acesso.
        </p>
        <Button asChild variant="outline" size="lg" className="mt-8 w-full">
          <Link href="/login">Voltar para o login</Link>
        </Button>
      </div>
    </div>
  );
}
