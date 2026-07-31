import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como o APEX 4 trata os dados dos participantes.",
};

const CONTACT_EMAIL = "fabricioggiacomelli@gmail.com";
const LAST_UPDATED = "31 de julho de 2026";

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 bg-apex-bg px-6 py-12 text-apex-text-primary">
      <header>
        <span className="text-xl font-semibold tracking-tight">
          APEX<span className="text-apex-accent">4</span>
        </span>
        <h1 className="mt-4 text-2xl font-semibold">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-apex-text-tertiary">Última atualização: {LAST_UPDATED}</p>
      </header>

      <section className="flex flex-col gap-4 text-sm leading-relaxed text-apex-text-secondary">
        <p>
          O APEX 4 é uma plataforma <strong className="text-apex-text-primary">privada e fechada</strong>,
          usada por um grupo pequeno e conhecido de participantes que se convidam mutuamente. Não é
          um produto público, não tem cadastro aberto e não exibe anúncios ou rastreadores de
          terceiros.
        </p>

        <h2 className="mt-2 text-base font-semibold text-apex-text-primary">Quais dados coletamos</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-apex-text-primary">Dados da conta:</strong> e-mail, nome, apelido,
            foto/avatar, cor escolhida, data de nascimento, peso e altura informados por você.
          </li>
          <li>
            <strong className="text-apex-text-primary">Dados da WHOOP</strong> (somente se você conectar
            sua conta): Recovery, ciclos fisiológicos, sono, treinos e medidas corporais, obtidos via
            OAuth com a sua autorização explícita.
          </li>
          <li>
            <strong className="text-apex-text-primary">Respostas do Journal:</strong> hábitos diários
            que você registra no app (água, sono, álcool, cafeína, mobilidade, etc.).
          </li>
        </ul>

        <h2 className="mt-2 text-base font-semibold text-apex-text-primary">Como usamos esses dados</h2>
        <p>
          Os dados alimentam uma engine de pontuação que calcula uma nota diária, rankings e
          gráficos de evolução para o grupo. Nada é usado para publicidade, perfilamento comercial
          ou repassado a terceiros com fins de marketing.
        </p>

        <h2 className="mt-2 text-base font-semibold text-apex-text-primary">Com quem os dados são compartilhados</h2>
        <p>
          Dentro do grupo, os outros participantes podem ver seu apelido, cor, pontuação, ranking,
          conquistas e respostas do Journal — essa visibilidade compartilhada é o propósito central
          do produto e foi combinada entre os participantes. Fora do grupo,{" "}
          <strong className="text-apex-text-primary">seus dados não são vendidos, alugados ou
          compartilhados com terceiros</strong>. A WHOOP em si só recebe as chamadas de leitura
          padrão da própria API dela, conforme os escopos que você autorizou.
        </p>

        <h2 className="mt-2 text-base font-semibold text-apex-text-primary">Segurança e armazenamento</h2>
        <p>
          Tokens de acesso à WHOOP são armazenados criptografados (AES-256-GCM) e nunca expostos ao
          navegador. Senhas são armazenadas com hash Argon2id. O banco de dados fica em um provedor
          gerenciado com backups automáticos.
        </p>

        <h2 className="mt-2 text-base font-semibold text-apex-text-primary">Seus direitos</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Desconectar sua conta WHOOP a qualquer momento, pela tela de Perfil.</li>
          <li>Pedir a exclusão da sua conta e de todos os seus dados a qualquer momento.</li>
          <li>Pedir uma cópia dos seus dados.</li>
        </ul>

        <h2 className="mt-2 text-base font-semibold text-apex-text-primary">Contato</h2>
        <p>
          Dúvidas, pedidos de exclusão ou exportação de dados:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-apex-accent underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </div>
  );
}
