import { redirect } from "next/navigation";

/** Evolução foi incorporada à aba Análise — mantém o link antigo funcionando. */
export default function EvolucaoRedirectPage() {
  redirect("/analysis/evolucao");
}
